import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { nftUpdatedEvent, orderUpdatedEvent, REALTIME_EVENTS, REALTIME_PATH, type RealtimeEvent } from '@/api/contracts'
import { whenTransportReady } from '@/api/http'
import { privateScope } from '@/api/query-keys'
import { sessionStore } from '@/api/session-store'
import { applyRealtimeEvent, type RealtimeNotice } from './apply'
import { createLedger } from './ledger'
import { createRefresher, reconcileAfterConnect } from './refresh'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

// Estado observável da conexão (para o aviso de "reconectando" na interface).
let status: RealtimeStatus = 'idle'
const statusListeners = new Set<() => void>()
function setStatus(next: RealtimeStatus) {
  if (next === status) return
  status = next
  statusListeners.forEach((listener) => listener())
}
export const realtimeStatus = {
  get: () => status,
  subscribe(listener: () => void) {
    statusListeners.add(listener)
    return () => statusListeners.delete(listener)
  },
}

// Avisos para a interface anunciar (toast + aria-live).
const noticeListeners = new Set<(notice: RealtimeNotice) => void>()
export function onRealtimeNotice(listener: (notice: RealtimeNotice) => void) {
  noticeListeners.add(listener)
  return () => noticeListeners.delete(listener)
}

const realtimeUrl = import.meta.env.VITE_REALTIME_URL ?? location.origin

/**
 * Liga o Socket.IO ao cache do TanStack Query e devolve a função que desliga tudo.
 *
 * - `socket.io-client` é importado só depois do MSW ativo: o engine.io guarda a referência de
 *   `WebSocket` ao carregar o módulo, e o MSW só troca essa classe dentro do `worker.start()`.
 * - Só transporte WebSocket: o binding do MSW simula WebSocket, não long-polling.
 * - `auth` é uma função, então cada (re)conexão manda o token atual.
 * - Ao (re)conectar, reconcilia com o REST: eventos perdidos durante a queda não voltam.
 */
export function startRealtime(queryClient: QueryClient): () => void {
  let disposed = false
  let socket: Socket | null = null
  let lastToken = sessionStore.getToken()
  const ledger = createLedger()
  const refresher = createRefresher(queryClient)

  const handle = (event: RealtimeEvent) => {
    const session = sessionStore.get()
    applyRealtimeEvent(event, {
      queryClient,
      ledger,
      userId: session?.userId ?? null,
      scope: privateScope(session),
      notify: (notice) => noticeListeners.forEach((listener) => listener(notice)),
      refresh: (filters) => refresher.refresh(filters),
    })
  }
  const validated =
    <T extends RealtimeEvent>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false } }) =>
    (payload: unknown) => {
      const result = schema.safeParse(payload)
      if (result.success) handle(result.data)
      else if (import.meta.env.DEV) console.warn('[realtime] evento fora do contrato ignorado', payload)
    }

  setStatus('connecting')
  void whenTransportReady()
    .then(() => import('socket.io-client'))
    .then(({ io }) => {
      if (disposed) return
      const s = io(realtimeUrl, {
        path: REALTIME_PATH,
        transports: ['websocket'],
        auth: (cb) => cb({ token: sessionStore.getToken() }),
        reconnectionDelay: 500,
        reconnectionDelayMax: 5_000,
      })
      socket = s
      s.on('connect', () => {
        setStatus('connected')
        reconcileAfterConnect(refresher, privateScope())
      })
      s.on('disconnect', () => setStatus(s.active ? 'reconnecting' : 'offline'))
      s.on('connect_error', () => setStatus(s.active ? 'reconnecting' : 'offline'))
      s.on(REALTIME_EVENTS.nftUpdated, validated(nftUpdatedEvent))
      s.on(REALTIME_EVENTS.orderUpdated, validated(orderUpdatedEvent))
    })
    .catch((error: unknown) => {
      console.error('[realtime] não foi possível iniciar o Socket.IO', error)
      setStatus('offline')
    })

  // Troca de usuário (login, logout, outra aba): esquece o que foi visto e reconecta com o token novo.
  const unsubscribeSession = sessionStore.subscribe(() => {
    const token = sessionStore.getToken()
    if (token === lastToken) return
    lastToken = token
    ledger.reset()
    if (socket) {
      socket.disconnect()
      socket.connect()
    }
  })

  return () => {
    disposed = true
    unsubscribeSession()
    refresher.dispose()
    socket?.removeAllListeners()
    socket?.disconnect()
    socket = null
    setStatus('idle')
  }
}
