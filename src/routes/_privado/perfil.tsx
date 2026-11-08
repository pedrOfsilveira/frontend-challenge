import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AccountError, AccountLayout, AccountLoading } from '@/features/account/account-layout'
import { ProfileForm } from '@/features/account/profile-form'
import { profileQuery } from '@/features/checkout/queries'
import { usePrivateScope } from '@/features/session/use-session'

export const Route = createFileRoute('/_privado/perfil')({
  component: ProfilePage,
})

function ProfilePage() {
  const profile = useQuery(profileQuery(usePrivateScope()))
  return <AccountLayout active="profile">{profile.isError ? <AccountError retry={() => void profile.refetch()} /> : profile.data ? <ProfileForm key={profile.data.userId} profile={profile.data} /> : <AccountLoading title="Perfil do colecionador" />}</AccountLayout>
}
