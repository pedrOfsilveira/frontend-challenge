import { Link } from '@tanstack/react-router'
import { SiteHeader } from './site-header'
import { MobileTabBar } from './mobile-tab-bar'

export function NotFoundPage() {
  return <>
    <SiteHeader section="home" />
    <main className="page-container flex min-h-[70dvh] flex-col items-start justify-center gap-4 pt-8 pb-40">
      <h1 className="text-heading font-bold">Página não encontrada</h1>
      <p className="text-sand-light">Este endereço não existe. Volte ao mercado para continuar explorando.</p>
      <Link to="/" className="rounded-md bg-copper px-6 py-3 font-bold text-ink hover:bg-copper-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light">Voltar ao mercado</Link>
    </main>
    <MobileTabBar active="home" />
  </>
}
