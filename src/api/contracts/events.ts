import { z } from 'zod'
import { ethAmount, isoDate } from './common'
import { orderStatus } from './order'

export const REALTIME_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
} as const

const envelope = <T extends string, R extends string, D extends z.ZodType>(type: T, resource: R, data: D) =>
  z.object({
    /** Identidade estável: o mesmo evento reenviado tem o mesmo id. */
    id: z.string(),
    type: z.literal(type),
    resource: z.object({ type: z.literal(resource), id: z.string() }),
    /** Versão do recurso após a mudança. Eventos com versão ≤ à conhecida são ignorados. */
    version: z.number().int().min(1),
    occurredAt: isoDate,
    data,
  })

export const nftUpdatedEvent = envelope(
  'nft.updated',
  'nft',
  z.object({
    priceEth: ethAmount,
    available: z.number().int().min(0),
    editions: z.array(z.object({ id: z.string(), priceEth: ethAmount, available: z.number().int().min(0) })),
  }),
)
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEvent>

export const orderUpdatedEvent = envelope(
  'order.updated',
  'order',
  z.object({
    status: orderStatus,
    transaction: z.object({ hash: z.string(), explorerUrl: z.string() }).nullable(),
    declineReason: z.string().nullable(),
  }),
).extend({ userId: z.string() })
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEvent>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent
