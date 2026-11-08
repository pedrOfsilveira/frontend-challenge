import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quote as quoteSchema, type CreateOrderRequest, type Order, type Quote } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import { isApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { usePrivateScope, useSession } from '@/features/session/use-session'
import { mapApiFields, type FieldErrors } from './form'
import { idempotency } from './idempotency'

/** O que a tela faz com cada recusa do servidor. */
export type PlaceOrderFailure =
  | { kind: 'quote-changed'; message: string; quote: Quote | null }
  | { kind: 'order-pending'; message: string; orderId: string | null }
  | { kind: 'wallet'; message: string }
  | { kind: 'fields'; message: string; fields: FieldErrors }
  | { kind: 'retry'; message: string }
  | { kind: 'other'; message: string }

export function describeFailure(error: unknown): PlaceOrderFailure {
  if (!isApiError(error)) return { kind: 'other', message: 'Não foi possível concluir a compra.' }
  const details = (error.details ?? {}) as { quote?: unknown; orderId?: unknown }
  switch (error.code) {
    case 'QUOTE_OUTDATED': {
      const parsed = quoteSchema.safeParse(details.quote)
      return { kind: 'quote-changed', message: error.message, quote: parsed.success ? parsed.data : null }
    }
    case 'IDEMPOTENCY_CONFLICT':
      return { kind: 'quote-changed', message: error.message, quote: null }
    case 'ORDER_PENDING':
      return { kind: 'order-pending', message: error.message, orderId: typeof details.orderId === 'string' ? details.orderId : null }
    case 'WALLET_DISCONNECTED':
    case 'WALLET_REJECTED':
      return { kind: 'wallet', message: error.message }
    case 'VALIDATION_FAILED':
      return { kind: 'fields', message: error.message, fields: mapApiFields(error.fields) }
  }
  if (error.isTransient) {
    return { kind: 'retry', message: `${error.message} Seu pedido não será duplicado: pode tentar de novo com segurança.` }
  }
  return { kind: 'other', message: error.message }
}

/**
 * Cria o pedido com chave de idempotência derivada do corpo. Falhas transitórias (rede, timeout, 5xx)
 * são repetidas automaticamente com a mesma chave: se a primeira chegou e só a resposta se perdeu,
 * o servidor devolve o mesmo pedido.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient()
  const scope = usePrivateScope()
  const session = useSession()

  return useMutation({
    mutationFn: (body: CreateOrderRequest) => {
      if (!session) throw new Error('Sessão encerrada.')
      return ordersApi.create(body, idempotency.keyFor(session.userId, body))
    },
    retry: (count, error) => isApiError(error) && error.isTransient && count < 2,
    retryDelay: (attempt) => 600 * 2 ** attempt,
    onSuccess: (order: Order, body) => {
      // A tentativa terminou: uma compra futura com o mesmo conteúdo (ex.: depois de um pagamento
      // recusado) é outra compra e precisa de chave nova, senão o servidor devolveria este pedido.
      if (session) idempotency.discard(session.userId, body)
      queryClient.setQueryData(queryKeys.private.order(scope, order.id), order)
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.pendingOrders(scope) })
    },
    onError: (error, body) => {
      if (!session || !isApiError(error)) return
      // Esta chave não serve mais para este corpo (o servidor guardou outro conteúdo com ela).
      if (error.code === 'IDEMPOTENCY_CONFLICT') idempotency.discard(session.userId, body)
      if (error.code === 'QUOTE_OUTDATED' || error.code === 'IDEMPOTENCY_CONFLICT') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.private.cart(scope) })
      }
      if (error.code === 'WALLET_DISCONNECTED') void queryClient.invalidateQueries({ queryKey: queryKeys.private.wallets(scope) })
      if (error.code === 'ORDER_PENDING') void queryClient.invalidateQueries({ queryKey: queryKeys.private.pendingOrders(scope) })
    },
  })
}
