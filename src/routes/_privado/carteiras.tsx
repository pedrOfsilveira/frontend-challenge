import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AccountError, AccountLayout, AccountLoading } from '@/features/account/account-layout'
import { WalletForms } from '@/features/account/wallet-form'
import { profileQuery, walletsQuery } from '@/features/checkout/queries'
import { usePrivateScope } from '@/features/session/use-session'

export const Route = createFileRoute('/_privado/carteiras')({
  component: WalletsPage,
})

function WalletsPage() {
  const scope = usePrivateScope()
  const profile = useQuery(profileQuery(scope))
  const wallets = useQuery(walletsQuery(scope))
  return <AccountLayout active="wallets">{profile.isError || wallets.isError ? <AccountError retry={() => { void profile.refetch(); void wallets.refetch() }} /> : profile.data && wallets.data ? <WalletForms key={profile.data.userId} profile={profile.data} wallets={wallets.data} /> : <AccountLoading title="Carteiras" />}</AccountLayout>
}
