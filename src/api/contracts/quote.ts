import { z } from 'zod'
import { ethAmount, isoDate, paymentNetwork } from './common'

export const quoteLine = z.object({
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  quantity: z.number().int().min(1),
  unitPriceEth: ethAmount,
  lineTotalEth: ethAmount,
})
export type QuoteLine = z.infer<typeof quoteLine>

export const quoteIssue = z.discriminatedUnion('type', [
  z.object({ type: z.literal('price_changed'), nftId: z.string(), editionId: z.string(), fromEth: ethAmount, toEth: ethAmount }),
  z.object({ type: z.literal('quantity_reduced'), nftId: z.string(), editionId: z.string(), from: z.number().int(), to: z.number().int() }),
  z.object({ type: z.literal('sold_out'), nftId: z.string(), editionId: z.string() }),
  z.object({ type: z.literal('coupon_removed'), code: z.string(), reason: z.enum(['invalid', 'expired', 'minimum_not_met']) }),
])
export type QuoteIssue = z.infer<typeof quoteIssue>

export const quote = z.object({
  /** Muda sempre que preço, estoque, cupom, rede ou itens mudam. */
  id: z.string(),
  cartId: z.string(),
  cartVersion: z.number().int(),
  network: paymentNetwork,
  lines: z.array(quoteLine),
  subtotalEth: ethAmount,
  discountEth: ethAmount,
  networkFeeEth: ethAmount,
  totalEth: ethAmount,
  coupon: z.object({ code: z.string(), label: z.string() }).nullable(),
  /** Ajustes que o servidor aplicou ao montar esta cotação (o usuário precisa ver). */
  issues: z.array(quoteIssue),
  issuedAt: isoDate,
  expiresAt: isoDate,
})
export type Quote = z.infer<typeof quote>
