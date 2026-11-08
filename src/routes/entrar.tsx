import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { SiteHeader } from '@/components/layout/site-header'
import { HomeHero } from '@/features/catalog/home-sections'
import { CatalogFilters } from '@/features/catalog/catalog-filters'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { nftListQuery } from '@/features/catalog/queries'
import { catalogSearchSchema, toListParams } from '@/features/catalog/search'
import { AuthForm } from '@/features/session/auth-form'
import { AccountMenu } from '@/features/session/account-menu'
import { useSession } from '@/features/session/use-session'

/** `redirect`: caminho interno para voltar depois do login (nunca uma URL externa). */
const searchSchema = z.object({
  redirect: z.string().startsWith('/').refine((path) =>
    !path.startsWith('//') && !path.includes('\\') &&
    Array.from(path).every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127),
  ).optional().catch(undefined),
  /** Por que caiu no login: sessão expirou no meio do uso (a tela explica e promete a volta). */
  motivo: z.enum(['expirada']).optional().catch(undefined),
  modo: z.enum(['cadastro']).optional().catch(undefined),
})

export const Route = createFileRoute('/entrar')({
  validateSearch: searchSchema,
  component: AuthPage,
})

function AuthPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const session = useSession()
  // Keep the form mounted while its successful mutation publishes the new session.
  const [startedSignedIn] = useState(Boolean(session))
  if (startedSignedIn && session) return <AccountMenu />
  return <>
    <MarketplaceBackdrop />
    <AuthForm key={search.modo ?? 'login'} register={search.modo === 'cadastro'} redirect={search.redirect ?? '/'} expired={search.motivo === 'expirada'}
      onModeChange={(register) => void navigate({ search: { ...search, modo: register ? 'cadastro' : undefined }, replace: true })} />
  </>
}

/** Reuses the live catalog beneath the desktop modal; no separate mock data. */
function MarketplaceBackdrop() {
  const search = catalogSearchSchema.parse({})
  const list = useQuery(nftListQuery(toListParams(search)))
  const navigate = Route.useNavigate()
  return <div className="hidden lg:block">
    <SiteHeader section="home" />
    <div className="page-container flex flex-col gap-24 pt-8 pb-24">
      <HomeHero />
      <div className="grid grid-cols-[310px_1fr] gap-12">
        <CatalogFilters search={search} facets={list.data?.facets} onChange={(search) => void navigate({ to: '/', search })} />
        <div className="grid grid-cols-3 gap-x-8 gap-y-16">{list.data ? list.data.items.map((nft) => <NftCard key={nft.id} nft={nft} />) : Array.from({ length: 9 }, (_, i) => <NftCardSkeleton key={i} />)}</div>
      </div>
    </div>
  </div>
}
