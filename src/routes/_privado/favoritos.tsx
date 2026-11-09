import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { FavoriteButton } from '@/features/favorites/favorite-button'
import { favoritesQuery } from '@/features/favorites/use-favorites'
import { usePrivateScope } from '@/features/session/use-session'

export const Route = createFileRoute('/_privado/favoritos')({
  component: FavoritesPage,
})

const action = 'rounded-md bg-copper px-4 py-3 text-sm font-bold text-ink hover:bg-copper-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

function FavoritesPage() {
  // Mantém o card durante a remoção otimista, permitindo mostrar uma falha e tentar novamente.
  const favorites = useQuery({ ...favoritesQuery(usePrivateScope()), select: (data) => data.items })

  return <>
    <SiteHeader section="favorites" />
    <main className="page-container flex min-h-[70dvh] flex-col gap-8 pt-10 pb-40 lg:pt-12 lg:pb-24">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-cream lg:text-3xl">Favoritos</h1>
        <p className="text-sm text-sand-light">Os NFTs que você salvou para ver depois.</p>
        <p role="status" className="text-sm text-sand-light">{favorites.isPending ? 'Carregando favoritos…' : favorites.data ? `${favorites.data.length} ${favorites.data.length === 1 ? 'NFT salvo' : 'NFTs salvos'}` : ''}</p>
      </div>

      {favorites.isError && <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface-card p-6">
        <p>Não foi possível {favorites.data ? 'atualizar' : 'carregar'} seus favoritos.</p>
        <button type="button" onClick={() => void favorites.refetch()} className={action}>Tentar novamente</button>
      </div>}

      {favorites.data?.length === 0 ? <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface-card p-6">
        <h2 className="text-lg font-bold text-cream">Você ainda não tem favoritos</h2>
        <p className="text-sm text-sand-light">Toque no coração de um NFT para salvá-lo aqui.</p>
        <Link to="/" hash="catalogo" className={action}>Explorar catálogo</Link>
      </div> : (favorites.data || favorites.isPending) && <ul aria-label="NFTs favoritos" aria-busy={favorites.isFetching} className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12">
        {favorites.data ? favorites.data.map((nft, index) => <li key={nft.id} className="flex min-w-0 flex-col gap-4">
          <NftCard nft={nft} priority={index < 2} />
          <div className="hidden lg:block"><FavoriteButton nftId={nft.id} nftName={nft.name} variant="labeled" /></div>
        </li>) : Array.from({ length: 4 }, (_, index) => <li key={index}><NftCardSkeleton /></li>)}
      </ul>}
    </main>
    <SiteFooter />
    <MobileTabBar active="favorites" />
  </>
}
