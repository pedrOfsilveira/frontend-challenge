import type { NftListParams, PaymentNetwork } from './contracts'
import { guestCart, sessionStore, type StoredSession } from './session-store'

/**
 * Escopo dos dados privados: `user:<id>` ou `guest:<carrinho>`.
 * Uma resposta atrasada do usuário anterior grava numa chave que ninguém mais lê, então
 * não vaza para a sessão nova.
 */
export type PrivateScope = `user:${string}` | `guest:${string}`

export function privateScope(session: StoredSession | null = sessionStore.get()): PrivateScope {
  return session ? `user:${session.userId}` : `guest:${guestCart.id()}`
}

/**
 * Fábrica única de query keys. Público em `['nfts', ...]`; tudo que depende de quem está
 * logado fica sob `['private', escopo, ...]`, e o logout remove esse prefixo inteiro.
 */
export const queryKeys = {
  nfts: {
    all: ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    list: (params: NftListParams) => ['nfts', 'list', params] as const,
    featured: () => ['nfts', 'featured'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
    related: (id: string) => ['nfts', 'related', id] as const,
  },
  private: {
    all: ['private'] as const,
    scope: (scope: PrivateScope) => ['private', scope] as const,
    cart: (scope: PrivateScope) => ['private', scope, 'cart'] as const,
    quote: (scope: PrivateScope, network: PaymentNetwork) => ['private', scope, 'cart', 'quote', network] as const,
    quotes: (scope: PrivateScope) => ['private', scope, 'cart', 'quote'] as const,
    orders: (scope: PrivateScope) => ['private', scope, 'orders'] as const,
    order: (scope: PrivateScope, id: string) => ['private', scope, 'orders', 'detail', id] as const,
    pendingOrders: (scope: PrivateScope) => ['private', scope, 'orders', 'pending'] as const,
    favorites: (scope: PrivateScope) => ['private', scope, 'favorites'] as const,
  },
}
