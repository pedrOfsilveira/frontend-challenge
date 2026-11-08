import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { cn } from 'cn'
import { useState } from 'react'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CatalogFilters, type CatalogPatch } from '@/features/catalog/catalog-filters'
import { CatalogPagination } from '@/features/catalog/catalog-pagination'
import { CatalogSort, CatalogTabs } from '@/features/catalog/catalog-toolbar'
import { Blog, FeaturedBanner, HomeHero, MobileHero, MobileSearchBar, Promos } from '@/features/catalog/home-sections'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { nftListQuery } from '@/features/catalog/queries'
import { CATALOG_PAGE_SIZE, catalogSearchSchema, toListParams, type CatalogSearch } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => toListParams(search),
  // Prefetch sem `await`: a página aparece já (com skeleton) e a lista chega quando chegar.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
  },
  component: HomePage,
})

const button = 'rounded-md bg-copper px-4 py-2 text-sm font-bold text-ink hover:bg-copper-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

function HomePage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const params = toListParams(search)
  const list = useQuery(nftListQuery(params))
  const [filtersOpen, setFiltersOpen] = useState(false)

  /** Toda mudança de filtro volta para a página 1 e não rola a página. */
  const update = (patch: Partial<CatalogSearch>, options: { replace?: boolean } = {}) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }), resetScroll: false, replace: options.replace })

  const activeFilters = [search.category, search.network].reduce((n, v) => n + (v?.split(',').length ?? 0), 0) + (search.min || search.max ? 1 : 0)
  const hasFilters = activeFilters > 0 || Boolean(search.q) || Boolean(search.tab)
  const clearFilters = () => navigate({ search: {}, resetScroll: false })

  const data = list.data
  const total = data?.total ?? 0

  return (
    <>
      <SiteHeader section="home" />
      <main className="page-container flex flex-col gap-4 pt-10 pb-[150px] lg:gap-24 lg:pt-8 lg:pb-24">
        <MobileSearchBar q={search.q} onSearch={(q) => void update({ q }, { replace: true })} onOpenFilters={() => setFiltersOpen(true)} activeFilters={activeFilters} />
        <MobileHero />
        <HomeHero />

        <section id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-6 lg:grid lg:grid-cols-[310px_1fr] lg:gap-12">
          <h2 id="catalog-title" className="sr-only">
            Catálogo de NFTs
          </h2>

          <aside aria-label="Filtros" className="hidden flex-col gap-6 lg:flex">
            <CatalogFilters search={search} facets={data?.facets} onChange={(patch: CatalogPatch) => void update(patch)} />
            <FeaturedBanner />
          </aside>

          <div className="flex flex-col items-end gap-10 lg:gap-[88px]">
            <div className="flex w-full flex-col gap-5 lg:gap-8">
              <div className="flex items-center justify-between gap-4 overflow-x-auto">
                <CatalogTabs value={params.tab ?? 'all'} onChange={(tab) => void update({ tab: tab === 'all' ? undefined : tab })} />
                <div className="hidden lg:block">
                  <CatalogSort value={params.sort ?? 'recent'} onChange={(sort) => void update({ sort: sort === 'recent' ? undefined : sort })} />
                </div>
              </div>

              <p role="status" className="sr-only">
                {list.isPending ? 'Carregando NFTs…' : data ? `${total} ${total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}` : ''}
              </p>

              {search.q && (
                <p className="text-sm text-sand-light">
                  Resultados para <strong className="text-cream">“{search.q}”</strong>{' '}
                  <button type="button" onClick={() => void update({ q: undefined })} className="ml-2 text-copper-light underline underline-offset-4">
                    limpar busca
                  </button>
                </p>
              )}

              {list.isError && !data ? (
                <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface-card p-6">
                  <p className="text-cream">Não foi possível carregar o catálogo. Confira sua conexão e tente de novo.</p>
                  <button type="button" onClick={() => void list.refetch()} className={button}>
                    Tentar de novo
                  </button>
                </div>
              ) : data && data.items.length === 0 ? (
                <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface-card p-6">
                  <p className="text-cream">{hasFilters ? 'Nenhum NFT combina com esses filtros.' : 'Ainda não há NFTs listados.'}</p>
                  {hasFilters && (
                    <button type="button" onClick={() => void clearFilters()} className={button}>
                      Limpar filtros
                    </button>
                  )}
                </div>
              ) : (
                <ul
                  aria-busy={list.isFetching}
                  className={cn(
                    'grid grid-cols-2 gap-x-4 gap-y-6 pb-8 md:grid-cols-3 md:pb-0 lg:gap-x-[34px] lg:gap-y-[72px]',
                    // Coluna da direita deslocada, como no Figma mobile.
                    'max-md:[&>li:nth-child(even)]:translate-y-8',
                    list.isPlaceholderData && 'opacity-60 transition-opacity motion-reduce:transition-none',
                  )}
                >
                  {data
                    ? data.items.map((nft, index) => (
                        <li key={nft.id}>
                          <NftCard nft={nft} priority={index < 2} />
                        </li>
                      ))
                    : Array.from({ length: CATALOG_PAGE_SIZE }, (_, index) => (
                        <li key={index}>
                          <NftCardSkeleton />
                        </li>
                      ))}
                </ul>
              )}

              {list.isError && data && (
                <p role="alert" className="text-sm text-sand-light">
                  Não foi possível atualizar a lista.{' '}
                  <button type="button" onClick={() => void list.refetch()} className="text-copper-light underline underline-offset-4">
                    Tentar de novo
                  </button>
                </p>
              )}
            </div>
            {data && <CatalogPagination page={data.page} totalPages={data.totalPages} />}
          </div>
        </section>

        <Promos />
        <Blog />
      </main>
      <SiteFooter />
      <MobileTabBar active="home" />

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto border-border bg-surface-card p-0 lg:hidden">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-lg text-cream">Filtros</SheetTitle>
            <SheetDescription className="text-sand-light">As mudanças são aplicadas na hora.</SheetDescription>
          </SheetHeader>
          <div className="px-5 pt-4">
            <CatalogSort value={params.sort ?? 'recent'} onChange={(sort) => void update({ sort: sort === 'recent' ? undefined : sort })} />
          </div>
          <CatalogFilters search={search} facets={data?.facets} onChange={(patch) => void update(patch)} />
          <div className="sticky bottom-0 flex gap-3 border-t border-border bg-surface-card p-5">
            <button type="button" onClick={() => void clearFilters()} disabled={!hasFilters} className="flex-1 rounded-md border border-border-soft px-4 py-2 text-sm text-cream disabled:opacity-50">
              Limpar
            </button>
            <button type="button" onClick={() => setFiltersOpen(false)} className={cn(button, 'flex-1')}>
              {list.isFetching ? 'Atualizando…' : `Ver ${total} ${total === 1 ? 'resultado' : 'resultados'}`}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
