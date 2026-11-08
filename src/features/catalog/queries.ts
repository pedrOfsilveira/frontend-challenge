import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { NftListParams } from '@/api/contracts'
import { nftsApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'

export const nftListQuery = (params: NftListParams) =>
  queryOptions({
    queryKey: queryKeys.nfts.list(params),
    queryFn: ({ signal }) => nftsApi.list(params, { signal }),
    // Ao trocar filtro/página a grade antiga fica visível (esmaecida) até a nova chegar.
    // Cada combinação tem a própria chave: resposta fora de ordem nunca aparece no filtro errado.
    placeholderData: keepPreviousData,
  })

export const featuredNftsQuery = () =>
  queryOptions({
    queryKey: queryKeys.nfts.featured(),
    queryFn: ({ signal }) => nftsApi.featured({ signal }),
    staleTime: 5 * 60_000,
  })

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: ({ signal }) => nftsApi.detail(id, { signal }),
  })

export const relatedNftsQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.related(id),
    queryFn: ({ signal }) => nftsApi.related(id, { signal }),
  })
