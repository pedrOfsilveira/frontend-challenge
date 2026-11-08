import { z } from 'zod'
import { ethAmount, isoDate, paymentNetwork, walletProvider } from './common'
import { quoteLine } from './quote'
import { addressOrEnsRule, addressRule, displayNameRule, emailRule, ensNameRule, profileNameRule, referralCodeRule } from './fields'
import { usernameRule } from './auth'

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'
export const idempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/)

export const orderStatus = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatus>

/** Dados do colecionador do formulário de Pagamento. */
export const collectorDetails = z.object({
  displayName: displayNameRule,
  username: usernameRule,
  network: paymentNetwork,
  profileName: profileNameRule,
  address: addressRule,
  secondaryAddressOrEns: addressOrEnsRule.nullable(),
  provider: walletProvider,
  referralCode: referralCodeRule,
  email: emailRule,
  ensName: ensNameRule,
})
export type CollectorDetails = z.infer<typeof collectorDetails>

export const createOrderRequest = z.object({
  quoteId: z.string(),
  walletId: z.string(),
  collector: collectorDetails,
  note: z.string().trim().max(500, 'Use no máximo 500 caracteres.').nullable(),
})
export type CreateOrderRequest = z.infer<typeof createOrderRequest>

export const order = z.object({
  id: z.string(),
  userId: z.string(),
  status: orderStatus,
  version: z.number().int().min(1),
  /** Snapshot dos itens e valores no momento da compra (o recibo nunca lê o catálogo). */
  lines: z.array(quoteLine),
  subtotalEth: ethAmount,
  discountEth: ethAmount,
  networkFeeEth: ethAmount,
  totalEth: ethAmount,
  couponCode: z.string().nullable(),
  network: paymentNetwork,
  wallet: z.object({ id: z.string(), provider: walletProvider, address: z.string(), nickname: z.string() }),
  collector: collectorDetails,
  note: z.string().nullable(),
  transaction: z
    .object({ hash: z.string(), explorerUrl: z.string() })
    .nullable(),
  declineReason: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
})
export type Order = z.infer<typeof order>

export const ordersResponse = z.object({ items: z.array(order) })
