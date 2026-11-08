import { queryOptions } from '@tanstack/react-query'
import { ordersApi } from '@/api/endpoints'
import { queryKeys, type PrivateScope } from '@/api/query-keys'

/**
 * Pedido por id. O status chega pelo Socket.IO (`order.updated`); enquanto está pendente, uma
 * consulta a cada 4 s cobre o caso de o socket estar fora do ar. Estado final não muda mais:
 * fica em cache sem refetch (o recibo é um snapshot).
 */
export const orderQuery = (scope: PrivateScope, id: string) =>
  queryOptions({
    queryKey: queryKeys.private.order(scope, id),
    queryFn: ({ signal }) => ordersApi.get(id, { signal }),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 4_000 : false),
    staleTime: (query) => (query.state.data && query.state.data.status !== 'pending' ? Infinity : 0),
  })
