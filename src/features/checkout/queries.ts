import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Wallet, WalletsResponse } from '@/api/contracts'
import { ordersApi, profileApi, walletsApi } from '@/api/endpoints'
import { queryKeys, type PrivateScope } from '@/api/query-keys'
import { usePrivateScope } from '@/features/session/use-session'

export const profileQuery = (scope: PrivateScope) =>
  queryOptions({ queryKey: queryKeys.private.profile(scope), queryFn: ({ signal }) => profileApi.get({ signal }) })

export const walletsQuery = (scope: PrivateScope) =>
  queryOptions({ queryKey: queryKeys.private.wallets(scope), queryFn: ({ signal }) => walletsApi.list({ signal }) })

/** Pedido em processamento: o checkout avisa e leva até ele em vez de deixar criar outro. */
export const pendingOrdersQuery = (scope: PrivateScope) =>
  queryOptions({
    queryKey: queryKeys.private.pendingOrders(scope),
    queryFn: ({ signal }) => ordersApi.pending({ signal }),
    staleTime: 0,
  })

/**
 * Conectar/desconectar a carteira (simulado). A resposta é a carteira atualizada: entra direto
 * no slot dela, sem refazer a lista.
 */
export function useWalletConnection() {
  const queryClient = useQueryClient()
  const scope = usePrivateScope()
  const key = queryKeys.private.wallets(scope)
  const write = (wallet: Wallet) =>
    queryClient.setQueryData<WalletsResponse>(key, (old) => (old ? { ...old, [wallet.slot]: wallet } : old))

  const connect = useMutation({
    mutationFn: (walletId: string) => walletsApi.connect(walletId),
    onSuccess: write,
    // Recusa também deixa a carteira desconectada no servidor: confere o estado real.
    onError: () => void queryClient.invalidateQueries({ queryKey: key }),
  })
  const disconnect = useMutation({
    mutationFn: (walletId: string) => walletsApi.disconnect(walletId),
    onSuccess: write,
  })
  return { connect, disconnect }
}
