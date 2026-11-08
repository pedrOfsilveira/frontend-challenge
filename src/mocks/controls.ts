import type { PaymentOutcome } from './db/types'
import { DEMO_USERS } from './db/seed'
import { store } from './db/store'
import { mockEvents } from './events'
import { serialized } from './handlers'
import { network, type FailureKind, type ScenarioId } from './network'
import { realtimeControls } from './realtime'
import { changeEdition, findNft } from './domain/catalog'
import { settleOrder } from './domain/orders'

/** Mutação controlada: mesma fila e mesma persistência que as requisições. */
const mutate = <T>(fn: () => T) =>
  serialized(async () => {
    const result = fn()
    store.persist()
    return result
  })

/**
 * Controles da simulação, expostos em `window.__kurioMock` (demo e testes Playwright).
 * Nada aqui fala com a interface: tudo muda o estado do servidor simulado, e a interface
 * só fica sabendo pelo REST ou pelos eventos Socket.IO.
 */
export const controls = {
  users: DEMO_USERS,
  scenarios: network.scenarios,
  get scenario() {
    return network.scenario
  },

  /** Restaura tudo: banco, cenário, latências, falhas injetadas e histórico de eventos. */
  reset: (options: { scenario?: ScenarioId } = {}) =>
    serialized(async () => {
      await store.reset()
      network.reset()
      network.setScenario(options.scenario ?? 'default')
      mockEvents.clear()
      realtimeControls.reset()
    }),
  setScenario(id: ScenarioId) {
    if (!network.isScenario(id)) throw new Error(`Cenário desconhecido: ${String(id)}`)
    network.setScenario(id)
  },
  setLatency: (ms: number | null) => network.setLatency(ms),
  failNext: (route: string, kind: FailureKind, count = 1) => network.failNext(route, kind, count),

  setPaymentOutcome: (outcome: PaymentOutcome) => mutate(() => void (store.get().settings.paymentOutcome = outcome)),
  setPaymentDelay: (ms: number) => mutate(() => void (store.get().settings.paymentDelayMs = Math.max(0, ms))),
  /** Decide agora os pedidos pendentes (inclusive os segurados com `hold`). */
  settlePendingOrders: (outcome: 'confirm' | 'decline') =>
    mutate(() => store.get().orders.filter((o) => o.status === 'pending').map((o) => settleOrder(store.get(), o, outcome))),

  setWalletConnection: (mode: 'accept' | 'reject') => mutate(() => void (store.get().settings.walletConnection = mode)),
  disconnectWallets: () => mutate(() => store.get().wallets.forEach((w) => (w.connection = 'disconnected'))),

  /** Vence todas as sessões: a próxima chamada autenticada recebe SESSION_EXPIRED. */
  expireSessions: () => mutate(() => store.get().sessions.forEach((s) => (s.expiresAt = new Date(0).toISOString()))),
  expireCoupon: (code: string) =>
    mutate(() => {
      const coupon = store.get().coupons.find((c) => c.code === code.toUpperCase())
      if (coupon) coupon.expiresAt = new Date(Date.now() - 1000).toISOString()
    }),

  /** Muda preço e/ou estoque de uma edição (padrão: a edição padrão) e publica `nft.updated`. */
  updateNft: (nftId: string, patch: { editionId?: string; priceEth?: string; available?: number }) =>
    mutate(() => {
      const db = store.get()
      const nft = findNft(db, nftId)
      return changeEdition(db, nftId, patch.editionId ?? nft.defaultEditionId, patch)
    }),

  /** Socket.IO simulado: conexões, queda, indisponibilidade e reenvio de eventos. */
  realtime: realtimeControls,
  events: () => mockEvents.history(),
  snapshot: () => structuredClone(store.get()),
}

export type MockControls = typeof controls

declare global {
  interface Window {
    __kurioMock?: MockControls
  }
}
