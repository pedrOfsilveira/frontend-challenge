import { queryOptions } from '@tanstack/react-query'
import { cartApi } from '@/api/endpoints'
import { queryKeys, type PrivateScope } from '@/api/query-keys'

export const cartQuery = (scope: PrivateScope) =>
  queryOptions({
    queryKey: queryKeys.private.cart(scope),
    queryFn: ({ signal }) => cartApi.get({ signal }),
  })
