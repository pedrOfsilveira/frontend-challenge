import type {
  Category,
  CollectorDetails,
  Network,
  Order,
  PaymentNetwork,
  Quote,
  WalletFields,
  WalletProvider,
} from '@/api/contracts'

export interface DbEdition {
  id: string
  label: string
  supply: number | null
  available: number
  priceEth: string
}

export interface DbNft {
  id: string
  name: string
  tokenId: string
  image: string
  images: string[]
  category: Category
  network: Network
  compareAtPriceEth: string | null
  badges: ('rare' | 'limited' | 'featured')[]
  description: string
  story: string[]
  collection: { id: string; name: string }
  creator: { name: string; royaltyBps: number }
  contractAddress: string
  attributes: string[]
  rating: { average: string; count: number }
  editions: DbEdition[]
  defaultEditionId: string
  listedAt: string
  trendingScore: number
  version: number
}

export interface PasswordHash {
  algorithm: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  hash: string
}

export interface DbUser {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  ensName: string | null
  nickname: string | null
  password: PasswordHash
  profileVersion: number
}

export interface DbSession {
  token: string
  userId: string
  expiresAt: string
}

export interface DbCartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
}

export interface DbCart {
  id: string
  /** userId ou id do visitante. */
  ownerId: string
  version: number
  items: DbCartItem[]
  couponCode: string | null
  updatedAt: string
}

export interface DbCoupon {
  code: string
  label: string
  kind: 'percent' | 'fixed'
  /** Basis points (percent) ou valor em ETH (fixed). */
  value: string
  minSubtotalEth: string
  expiresAt: string
}

export interface DbWallet extends WalletFields {
  id: string
  userId: string
  slot: 'primary' | 'secondary'
  connection: 'disconnected' | 'connected'
  version: number
  updatedAt: string
}

export type PaymentOutcome = 'confirm' | 'decline' | 'hold'

export interface DbOrder extends Order {
  idempotency: { scopedKey: string; fingerprint: string }
  cartId: string
  /** Momento previsto para a simulação decidir o pagamento; `null` = aguardando controle manual. */
  resolveAt: number | null
  outcome: PaymentOutcome
}

export interface DbQuote extends Quote {
  ownerId: string
}

export interface MockSettings {
  paymentOutcome: PaymentOutcome
  paymentDelayMs: number
  walletConnection: 'accept' | 'reject'
}

export interface Db {
  schemaVersion: number
  sequence: number
  nfts: DbNft[]
  users: DbUser[]
  sessions: DbSession[]
  carts: DbCart[]
  coupons: DbCoupon[]
  wallets: DbWallet[]
  favorites: Record<string, string[]>
  quotes: Record<string, DbQuote>
  orders: DbOrder[]
  settings: MockSettings
}

export type { CollectorDetails, PaymentNetwork, WalletProvider }
