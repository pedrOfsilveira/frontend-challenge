import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Cart } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { usePrivateScope } from '@/features/session/use-session'

/**
 * Mutações da tela do carrinho. Quantidade e remoção são otimistas (a linha muda na hora) e voltam
 * ao estado anterior se a API recusar. A resposta é sempre o carrinho completo: vai direto para o
 * cache, e o `structuralSharing` global descarta uma resposta de versão menor que chegue fora de ordem
 * (dois cliques rápidos no +). Qualquer mudança deixa a cotação velha.
 */
function useCartMutation<TInput>(request: (input: TInput) => Promise<Cart>, optimistic?: (cart: Cart, input: TInput) => Cart) {
  const queryClient = useQueryClient()
  const scope = usePrivateScope()
  const key = queryKeys.private.cart(scope)

  return useMutation({
    mutationKey: [...key, 'mutation'],
    mutationFn: request,
    onMutate: async (input) => {
      if (!optimistic) return { previous: undefined }
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      const previous = queryClient.getQueryData<Cart>(key)
      if (previous) queryClient.setQueryData<Cart>(key, optimistic(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      // O estado real pode ter mudado por outro motivo (estoque, outra aba): confere com o servidor.
      void queryClient.invalidateQueries({ queryKey: key, exact: true })
    },
    onSuccess: (cart) => {
      // Com outra mudança ainda em voo, esta resposta já está velha para a tela: grava só a última,
      // senão o "4" otimista volta para "3" por um instante.
      if (queryClient.isMutating({ mutationKey: [...key, 'mutation'] }) > 1) return
      queryClient.setQueryData(key, cart)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.quotes(scope) })
    },
  })
}

export function useUpdateCartLine() {
  return useCartMutation(
    ({ lineId, quantity }: { lineId: string; quantity: number }) => cartApi.updateItem(lineId, quantity),
    (cart, { lineId, quantity }) => ({ ...cart, items: cart.items.map((line) => (line.id === lineId ? { ...line, quantity } : line)) }),
  )
}

export function useRemoveCartLine() {
  return useCartMutation(
    (lineId: string) => cartApi.removeItem(lineId),
    (cart, lineId) => ({ ...cart, items: cart.items.filter((line) => line.id !== lineId) }),
  )
}

/** Cupom não é otimista: só a API sabe se o código vale (inválido, expirado, mínimo). */
export function useApplyCoupon() {
  return useCartMutation((code: string) => cartApi.applyCoupon(code))
}

export function useRemoveCoupon() {
  return useCartMutation(() => cartApi.removeCoupon())
}
