import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import type { DbNft, DbOrder } from './db/types'
import { nowIso } from './lib'

/**
 * Barramento dos eventos gerados pelo domínio simulado. Quem entrega ao cliente é o servidor
 * Socket.IO simulado (MSW), nunca a interface: aqui só se publica.
 */
type Listener = (event: RealtimeEvent) => void
const listeners = new Set<Listener>()
const history: RealtimeEvent[] = []
const HISTORY_LIMIT = 200

export const mockEvents = {
  publish(event: RealtimeEvent) {
    history.push(event)
    if (history.length > HISTORY_LIMIT) history.shift()
    listeners.forEach((listener) => listener(event))
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  history: () => [...history],
  clear: () => {
    history.length = 0
  },
}

export function nftUpdated(nft: DbNft, summary: { priceEth: string; available: number }): NftUpdatedEvent {
  return {
    id: `nft:${nft.id}:v${nft.version}`,
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: nowIso(),
    data: {
      priceEth: summary.priceEth,
      available: summary.available,
      editions: nft.editions.map(({ id, priceEth, available }) => ({ id, priceEth, available })),
    },
  }
}

export function orderUpdated(order: DbOrder): OrderUpdatedEvent {
  return {
    id: `order:${order.id}:v${order.version}`,
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    userId: order.userId,
    version: order.version,
    occurredAt: order.updatedAt,
    data: { status: order.status, transaction: order.transaction, declineReason: order.declineReason },
  }
}
