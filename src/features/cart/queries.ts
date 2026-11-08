import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { PaymentNetwork } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { queryKeys, type PrivateScope } from '@/api/query-keys'

export const cartQuery = (scope: PrivateScope) =>
  queryOptions({
    queryKey: queryKeys.private.cart(scope),
    queryFn: ({ signal }) => cartApi.get({ signal }),
  })

/**
 * Cotação do carrinho: subtotal, desconto, taxa e total vêm daqui, nunca de conta feita na tela.
 * A chave inclui a versão do carrinho, então cada mudança pede uma cotação nova e uma resposta
 * atrasada de uma versão anterior grava numa chave que ninguém mais lê. Enquanto a nova não chega,
 * a anterior continua visível (esmaecida) em vez de piscar o resumo.
 */
export const cartQuoteQuery = (scope: PrivateScope, network: PaymentNetwork, cartVersion: number) =>
  queryOptions({
    queryKey: [...queryKeys.private.quote(scope, network), cartVersion] as const,
    queryFn: ({ signal }) => cartApi.quote(network, { signal }),
    placeholderData: keepPreviousData,
    // A cotação vence no servidor em 10 min; 1 min de folga evita mostrar valor velho.
    staleTime: 60_000,
  })
