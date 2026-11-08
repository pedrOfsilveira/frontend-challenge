import { Link } from '@tanstack/react-router'
import { SiteHeader, type HeaderSection } from './site-header'

/** Página provisória enquanto a tela correspondente não é construída (substituída nas próximas etapas). */
export function PendingPage({ title, section = 'market' }: { title: string; section?: HeaderSection }) {
  return (
    <>
      <SiteHeader section={section} />
      <main className="page-container flex flex-col items-start gap-4 py-24">
        <h1 className="text-heading font-bold text-cream">{title}</h1>
        <p className="text-sand-light">Esta tela ainda está em construção.</p>
        <Link to="/" className="text-copper-light underline underline-offset-4">
          Voltar ao catálogo
        </Link>
      </main>
    </>
  )
}
