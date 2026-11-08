import { z } from 'zod'
import { isoDate } from './common'
import { walletFields } from './fields'

export const walletSlot = z.enum(['primary', 'secondary'])
export type WalletSlot = z.infer<typeof walletSlot>

export const wallet = walletFields.extend({
  id: z.string(),
  slot: walletSlot,
  /** Conexão simulada usada no pagamento. */
  connection: z.enum(['disconnected', 'connected']),
  version: z.number().int().min(1),
  updatedAt: isoDate,
})
export type Wallet = z.infer<typeof wallet>

export const walletsResponse = z.object({
  primary: wallet.nullable(),
  secondary: wallet.nullable(),
})
export type WalletsResponse = z.infer<typeof walletsResponse>

export const saveWalletRequest = walletFields
export type SaveWalletRequest = z.infer<typeof saveWalletRequest>
