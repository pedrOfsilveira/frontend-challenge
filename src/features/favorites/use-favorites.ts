import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FavoritesResponse } from '@/api/contracts'
import { favoritesApi } from '@/api/endpoints'
import { queryKeys, type PrivateScope } from '@/api/query-keys'
import { usePrivateScope, useSession } from '@/features/session/use-session'

export const favoritesQuery = (scope: PrivateScope) =>
  queryOptions({
    queryKey: queryKeys.private.favorites(scope),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    select: (data: FavoritesResponse) => new Set(data.ids),
  })

/** Ids favoritados pela sessão atual (vazio para visitante: favoritos exigem conta). */
export function useFavoriteIds() {
  const session = useSession()
  const scope = usePrivateScope()
  const { data } = useQuery({ ...favoritesQuery(scope), enabled: session !== null })
  return data ?? new Set<string>()
}

/**
 * Liga/desliga favorito com atualização otimista: o coração muda na hora e volta se a API falhar.
 * A resposta do servidor substitui o palpite (ela traz a lista completa e atual).
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const scope = usePrivateScope()
  const key = queryKeys.private.favorites(scope)

  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      if (previous) {
        const ids = favorite ? [...new Set([...previous.ids, nftId])] : previous.ids.filter((id) => id !== nftId)
        queryClient.setQueryData<FavoritesResponse>(key, { ...previous, ids })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (data) => queryClient.setQueryData(key, data),
  })
}
