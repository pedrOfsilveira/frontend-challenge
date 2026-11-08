import { z } from 'zod'
import { ethAmount, isoDate } from './common'

export const cartLine = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  quantity: z.number().int().min(1),
  /** Preço atual do catálogo; o valor a pagar vem sempre da cotação. */
  unitPriceEth: ethAmount,
  /** Unidades disponíveis agora para esta edição (limite do seletor). */
  available: z.number().int().min(0),
})
export type CartLine = z.infer<typeof cartLine>

export const cart = z.object({
  id: z.string(),
  version: z.number().int().min(1),
  items: z.array(cartLine),
  couponCode: z.string().nullable(),
  updatedAt: isoDate,
})
export type Cart = z.infer<typeof cart>

export const addCartItemRequest = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1).max(99),
})
export type AddCartItemRequest = z.infer<typeof addCartItemRequest>

export const updateCartItemRequest = z.object({
  quantity: z.number().int().min(1).max(99),
})

export const applyCouponRequest = z.object({
  code: z.string().trim().min(1, 'Informe o código.').max(32).toUpperCase(),
})
