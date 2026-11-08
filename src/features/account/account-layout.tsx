import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import userIcon from '@/assets/figma/account-user.svg'
import locationIcon from '@/assets/figma/account-location.svg'
import shoppingIcon from '@/assets/figma/account-shopping.svg'
import heartIcon from '@/assets/figma/account-heart.svg'
import activityIcon from '@/assets/figma/account-activity.svg'
import downloadIcon from '@/assets/figma/account-download.svg'
import warningIcon from '@/assets/figma/account-warning.svg'
import logoutIcon from '@/assets/figma/account-logout.svg'
import { SiteHeader } from '@/components/layout/site-header'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { focusRing } from '@/features/checkout/fields'
import { useLogout } from '@/features/session/use-logout'

export function AccountLayout({ active, children }: { active: 'profile' | 'wallets'; children: React.ReactNode }) {
  const logout = useLogout()
  const item = 'flex min-h-[45px] items-center gap-4 px-4 text-[15px] text-copper-light'
  const link = (current: boolean) => cn(item, 'border-l-[6px]', current ? 'border-copper' : 'border-transparent', focusRing)
  return <>
    <SiteHeader section="home" />
    <main className="page-container flex min-h-dvh flex-col gap-7 pt-8 pb-40 lg:grid lg:min-h-0 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start lg:pb-16">
      <nav aria-label="Meu perfil" className="bg-surface-card py-2">
        <h2 className="px-2.5 py-2 text-lg leading-4 font-bold">Meu perfil</h2>
        <div className="flex flex-wrap lg:flex-col">
          <Link to="/perfil" aria-current={active === 'profile' ? 'page' : undefined} className={link(active === 'profile')}><img src={userIcon} alt="" width={18} height={18} />Dados do perfil</Link>
          <Link to="/carteiras" aria-current={active === 'wallets' ? 'page' : undefined} className={link(active === 'wallets')}><img src={locationIcon} alt="" width={20} height={20} />Carteiras</Link>
        </div>
        <div className="hidden lg:block">
          {[{ name: 'Atividade', icon: shoppingIcon }, { name: 'Lista de interesse', icon: heartIcon }, { name: 'Ofertas', icon: activityIcon }, { name: 'Arquivos baixados', icon: downloadIcon }, { name: 'Suporte', icon: warningIcon }].map(({ name, icon }) => <span key={name} className={item} title="Fora do escopo da demonstração"><img src={icon} alt="" width={18} height={18} />{name}</span>)}
        </div>
        <button type="button" disabled={logout.isPending} onClick={() => logout.mutate()} className={cn(item, 'w-full border-t border-border-soft text-left font-bold', focusRing)}><img src={logoutIcon} alt="" width={20} height={20} />{logout.isPending ? 'Saindo…' : 'Sair'}</button>
        {logout.error && <p role="alert" className="px-4 text-xs text-[#ff8a7a]">{logout.error.message}</p>}
      </nav>
      <div className="min-w-0">{children}</div>
    </main>
    <MobileTabBar active="account" />
  </>
}

export function AccountLoading({ title }: { title: string }) {
  return <section aria-busy="true" aria-label={`Carregando ${title}`} className="flex flex-col gap-8"><h1 className="text-base font-bold">{title}</h1><div className="grid gap-6 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex flex-col gap-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-full" /></div>)}</div></section>
}

export function AccountError({ retry }: { retry: () => void }) {
  return <div role="alert" className="flex flex-col items-start gap-4"><h1 className="font-bold">Não foi possível carregar seus dados</h1><p>Confira a conexão e tente novamente. Suas alterações salvas continuam disponíveis.</p><button type="button" onClick={retry} className={cn('rounded bg-copper p-3 font-bold text-ink', focusRing)}>Tentar novamente</button></div>
}
