import { useQuery } from '@tanstack/react-query'
import { usePrivateScope } from '@/features/session/use-session'
import { cartQuery } from './queries'

/** Unidades no carrinho, para os badges do cabeçalho e da tab bar. */
export function useCartCount() {
  const scope = usePrivateScope()
  const { data } = useQuery({ ...cartQuery(scope), select: (cart) => cart.items.reduce((sum, line) => sum + line.quantity, 0) })
  return data ?? 0
}
