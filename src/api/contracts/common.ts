import { z } from 'zod'
import { eth } from '@/lib/eth'

export const ethAmount = z.string().refine(eth.isValid, 'Valor ETH inválido')
export const isoDate = z.iso.datetime({ offset: true })

export const networkIds = ['ethereum', 'polygon', 'solana'] as const
export const network = z.enum(networkIds)
export type Network = z.infer<typeof network>

/** Redes em que é possível pagar (as carteiras suportadas não operam em Solana). */
export const paymentNetworkIds = ['ethereum', 'polygon'] as const
export const paymentNetwork = z.enum(paymentNetworkIds)
export type PaymentNetwork = z.infer<typeof paymentNetwork>

export const walletProviderIds = ['metamask', 'coinbase', 'walletconnect'] as const
export const walletProvider = z.enum(walletProviderIds)
export type WalletProvider = z.infer<typeof walletProvider>

export const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
