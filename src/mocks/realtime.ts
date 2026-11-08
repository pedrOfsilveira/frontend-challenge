import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { REALTIME_PATH, type RealtimeEvent } from '@/api/contracts'
import { store } from './db/store'
import { authenticate } from './domain/auth'
import { mockEvents } from './events'
import { network } from './network'

/**
 * Servidor Socket.IO simulado: MSW intercepta o WebSocket do `socket.io-client` e o
 * `@mswjs/socket.io-binding` codifica/decodifica o protocolo (engine.io + socket.io).
 *
 * O binding cobre só o básico, então três coisas ficam aqui:
 * - Autenticação: o binding confirma o CONNECT sozinho, sem olhar o `auth`. Lemos o pacote
 *   CONNECT do cliente (`40{...}`) para saber quem está conectado; token inválido = visitante.
 * - Heartbeat: o binding anuncia pingInterval 25 s / pingTimeout 5 s mas nunca manda ping.
 *   Sem isso o cliente derruba a conexão a cada 30 s ("ping timeout").
 * - Roteamento: `nft.updated` vai para todos; `order.updated` só para o dono do pedido.
 */

const PING_EVERY_MS = 20_000
/** Faixa de códigos de fechamento livre para aplicações (RFC 6455). */
const CLOSE_DROPPED = 4000

const wsOrigin = location.origin.replace(/^http/, 'ws')
const realtimeUrl = (import.meta.env.VITE_REALTIME_URL ?? wsOrigin).replace(/^http/, 'ws').replace(/\/$/, '')

interface Peer {
  id: string
  token: string | null
  emit: (event: string, payload: unknown) => void
  close: () => void
}

const peers = new Map<string, Peer>()
let accepting = true

/** Dono atual da conexão. Revalidado a cada envio: sessão vencida ou encerrada deixa de receber pedidos. */
function peerUserId(peer: Peer) {
  if (!peer.token) return null
  return authenticate(store.get(), `Bearer ${peer.token}`)?.user.id ?? null
}

function deliver(event: RealtimeEvent, peer: Peer, { unfiltered = false } = {}) {
  if (!unfiltered && event.type === 'order.updated' && peerUserId(peer) !== event.userId) return
  peer.emit(event.type, event)
}

function broadcast(event: RealtimeEvent, options?: { unfiltered?: boolean }) {
  // Fora da pilha do handler REST: o evento chega como chegaria de um servidor real, sem ordem garantida
  // em relação à resposta HTTP que o causou (o cliente resolve pela versão).
  setTimeout(() => peers.forEach((peer) => deliver(event, peer, options)), 0)
}

/** Lê o token do pacote CONNECT do socket.io (`40` ou `40{"token":"..."}`). */
function readConnectToken(data: unknown): string | null | undefined {
  if (typeof data !== 'string' || !data.startsWith('40')) return undefined
  try {
    const auth = data.length > 2 ? (JSON.parse(data.slice(2)) as { token?: unknown }) : {}
    return typeof auth.token === 'string' && auth.token ? auth.token : null
  } catch {
    return null
  }
}

const link = ws.link(`${realtimeUrl}${REALTIME_PATH}/`)

export const realtimeHandler = link.addEventListener('connection', (connection) => {
  const { client } = connection
  // Sem rede (cenário offline) ou servidor "fora do ar": recusa, e o cliente tenta de novo com backoff.
  if (!accepting || network.scenario === 'offline') {
    // Como uma conexão recusada de verdade: `error` e depois `close`. Só o `close`, antes do handshake,
    // deixa o Manager do socket.io-client preso em "reconectando" sem nunca tentar de novo.
    ;(client as unknown as { socket: WebSocket }).socket.dispatchEvent(new Event('error'))
    client.close(CLOSE_DROPPED, 'unavailable')
    return
  }

  const io = toSocketIo(connection)
  const peer: Peer = {
    id: client.id,
    token: null,
    emit: (event, payload) => io.client.emit(event, payload),
    close: () => client.close(CLOSE_DROPPED, 'dropped'),
  }

  client.addEventListener('message', (message) => {
    const token = readConnectToken(message.data)
    if (token === undefined) return
    peer.token = token
    peers.set(peer.id, peer)
  })

  const heartbeat = window.setInterval(() => client.send('2'), PING_EVERY_MS)
  client.addEventListener('close', () => {
    window.clearInterval(heartbeat)
    peers.delete(peer.id)
  })
})

mockEvents.subscribe((event) => broadcast(event))

/** Controles de tempo real (expostos em `window.__kurioMock.realtime`). */
export const realtimeControls = {
  /** Conexões ativas e o usuário de cada uma (`null` = visitante). */
  connections: () => [...peers.values()].map((peer) => ({ id: peer.id, userId: peerUserId(peer) })),
  /** Derruba as conexões; o cliente reconecta sozinho (como uma queda de rede). */
  drop: () => peers.forEach((peer) => peer.close()),
  /** Fica fora do ar: derruba tudo e recusa novas conexões até `resume()`. Eventos do período se perdem. */
  pause() {
    accepting = false
    peers.forEach((peer) => peer.close())
  },
  resume() {
    accepting = true
  },
  /**
   * Reenvia um evento do histórico (duplicata ou evento antigo).
   * `unfiltered` ignora o filtro por usuário, para testar a defesa do cliente contra eventos de outra conta.
   */
  replay(eventId: string, options: { unfiltered?: boolean } = {}) {
    const event = mockEvents.history().find((e) => e.id === eventId)
    if (!event) throw new Error(`Evento não encontrado no histórico: ${eventId}`)
    broadcast(event, options)
    return event
  },
  reset() {
    accepting = true
    peers.forEach((peer) => peer.close())
  },
}
