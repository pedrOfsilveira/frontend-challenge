import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemRequest } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { usePrivateScope } from '@/features/session/use-session'

/**
 * Adiciona ao carrinho. A resposta é o carrinho completo: vai direto para o cache (sem refetch)
 * e a cotação fica velha, porque o subtotal mudou.
 */
export function useAddToCart() {
  const queryClient = useQueryClient()
  const scope = usePrivateScope()
  return useMutation({
    mutationFn: (input: AddCartItemRequest) => cartApi.addItem(input),
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKeys.private.cart(scope), cart)
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.quotes(scope) })
    },
  })
}
