import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/layout/site-header'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { focusRing } from '@/features/checkout/fields'
import { profileQuery } from '@/features/checkout/queries'
import { useLogout } from './use-logout'
import { usePrivateScope } from './use-session'

/** Account entry point shared by desktop and mobile navigation. */
export function AccountMenu() {
  const profile = useQuery(profileQuery(usePrivateScope()))
  const logout = useLogout()
  const link = `rounded-md border border-border p-4 text-sand-light hover:border-copper ${focusRing}`
  return <>
    <SiteHeader section="home" />
    <main className="page-container flex min-h-dvh max-w-xl flex-col gap-6 pt-16 pb-40">
      <h1 className="text-2xl font-bold">Sua conta</h1>
      <p role="status">{profile.data ? `${profile.data.displayName} · ${profile.data.email}` : profile.isError ? 'Não foi possível carregar sua conta.' : 'Carregando conta…'}</p>
      {profile.isError && <button type="button" onClick={() => void profile.refetch()} className={link}>Tentar novamente</button>}
      <Link to="/perfil" className={link}>Perfil do colecionador</Link>
      <Link to="/carteiras" className={link}>Carteiras</Link>
      <Link to="/" className={link}>Explorar o mercado</Link>
      <button type="button" disabled={logout.isPending} onClick={() => logout.mutate()} className={link}>{logout.isPending ? 'Saindo…' : 'Sair da conta'}</button>
      {logout.error && <p role="alert" className="text-sm text-[#ff8a7a]">{logout.error.message} Tente sair novamente.</p>}
    </main>
    <MobileTabBar active="account" />
  </>
}
