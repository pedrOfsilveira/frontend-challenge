import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { FavoriteButton } from '@/features/favorites/favorite-button'
import { formatEth } from '@/lib/format'
import { NftImage } from './nft-image'

const BADGE_LABELS = { rare: 'RARO', limited: 'OFERTA LIMITADA', featured: 'DESTAQUE' } as const

/**
 * Card do catálogo. Desktop (Figma 258 × 300): caixa sem raio e arte de 250 px.
 * Mobile: caixa arredondada com gradiente, arte de 168 px, selo e favorito.
 * O card inteiro é clicável por um link esticado; o favorito fica por cima, fora do `<a>`.
 */
export function NftCard({ nft, priority = false }: { nft: NftSummary; priority?: boolean }) {
  const badge = nft.badges.includes('rare') ? 'rare' : null
  const soldOut = nft.available === 0

  return (
    <article className="group relative flex flex-col gap-2 lg:gap-3">
      <div
        className={cn(
          'relative flex aspect-[175/200] items-center justify-center overflow-hidden rounded-[20px] bg-linear-[139.5deg] from-surface-card from-12% to-surface-raised px-1',
          'lg:aspect-[258/300] lg:rounded-none lg:bg-none lg:bg-surface-card',
        )}
      >
        <NftImage
          src={nft.image}
          alt=""
          sizes="(min-width: 1024px) 250px, (min-width: 768px) 30vw, 45vw"
          priority={priority}
          className="aspect-square w-full rounded-2xl object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none lg:w-[96.9%] lg:rounded-[15px]"
        />
        {badge && (
          <span className="absolute top-4 left-0 flex h-8 items-center bg-copper px-2 text-[13px] leading-4 font-medium text-ink lg:hidden">
            {BADGE_LABELS[badge]}
          </span>
        )}
      </div>

      <div className="flex flex-col pl-2 lg:gap-3 lg:pl-0">
        <h3 className="text-[15px] text-cream lg:text-base lg:leading-4">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="after:absolute after:inset-0 after:z-0 focus-visible:outline-none after:focus-visible:rounded-[20px] after:focus-visible:outline-2 after:focus-visible:outline-copper-light lg:after:focus-visible:rounded-none"
          >
            {nft.name}
          </Link>
        </h3>
        <p className="flex flex-wrap items-center gap-x-3 text-base leading-4 lg:text-lg">
          <span className="font-bold text-copper-light">
            <span className="sr-only">Preço: </span>
            {formatEth(nft.priceEth)}
          </span>
          {nft.compareAtPriceEth && (
            <span className="text-sand">
              <span className="sr-only">Preço anterior: </span>
              {formatEth(nft.compareAtPriceEth)}
            </span>
          )}
          {soldOut && <span className="text-sm text-sand">Esgotado</span>}
        </p>
      </div>

      <FavoriteButton nftId={nft.id} nftName={nft.name} className="absolute top-3 right-3 z-10 lg:hidden" />
    </article>
  )
}

/** Mesmas dimensões do card: a grade não "pula" quando os dados chegam. */
export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 lg:gap-3" aria-hidden>
      <Skeleton className="aspect-[175/200] w-full rounded-[20px] lg:aspect-[258/300] lg:rounded-none" />
      <div className="flex flex-col gap-1.5 pl-2 lg:gap-3 lg:pl-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}
