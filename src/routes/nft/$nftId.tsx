import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { cn } from 'cn'
import { useState } from 'react'
import { z } from 'zod'
import backArrow from '@/assets/figma/md-arrow-left.svg'
import shopIcon from '@/assets/figma/md-shop.svg'
import starIcon from '@/assets/figma/d-star.svg'
import type { Edition, NftDetail } from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { MaskIcon } from '@/components/mask-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { nftDetailQuery, relatedNftsQuery } from '@/features/catalog/queries'
import { useAddToCart } from '@/features/cart/use-add-to-cart'
import { FavoriteButton } from '@/features/favorites/favorite-button'
import { MobileGallery, NftGallery } from '@/features/nft/nft-gallery'
import { NftDetailsTabs, RelatedNfts, ShareLinks } from '@/features/nft/nft-sections'
import { EditionPicker, QuantityStepper, RatingStars } from '@/features/nft/purchase-controls'
import { eth } from '@/lib/eth'
import { formatEth } from '@/lib/format'

/** `?edicao=<id>`: a edição escolhida sobrevive a refresh e ao compartilhar o link. */
const searchSchema = z.object({ edicao: z.string().max(80).optional().catch(undefined) })

export const Route = createFileRoute('/nft/$nftId')({
  validateSearch: searchSchema,
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
    void context.queryClient.prefetchQuery(relatedNftsQuery(params.nftId))
  },
  component: NftDetailPage,
})

const MAX_PER_LINE = 99
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

/** Edição pedida na URL; se não existir ou esgotou, a padrão; se a padrão esgotou, a primeira disponível. */
function pickEdition(nft: NftDetail, requested: string | undefined): Edition {
  const byId = (id: string | undefined) => nft.editions.find((e) => e.id === id)
  const requestedEdition = byId(requested)
  if (requestedEdition) return requestedEdition
  const fallback = byId(nft.defaultEditionId)
  if (fallback && fallback.available > 0) return fallback
  return nft.editions.find((e) => e.available > 0) ?? fallback ?? (nft.editions[0] as Edition)
}

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const detail = useQuery(nftDetailQuery(nftId))

  return (
    <>
      <SiteHeader section="market" divider={false} />
      <main className="page-container flex flex-col gap-16 pb-[200px] lg:gap-24 lg:pt-8 lg:pb-24">
        {detail.data ? (
          <NftPurchase key={nftId} nft={detail.data} />
        ) : detail.isError ? (
          <DetailError notFound={isApiError(detail.error) && detail.error.code === 'NOT_FOUND'} onRetry={() => void detail.refetch()} />
        ) : (
          <DetailSkeleton />
        )}
        {detail.data && <NftDetailsTabs nft={detail.data} />}
        {!detail.isError && <RelatedNfts nftId={nftId} />}
      </main>
      <SiteFooter />
    </>
  )
}

function NftPurchase({ nft }: { nft: NftDetail }) {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/nft/$nftId' })
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const addToCart = useAddToCart()
  const [quantity, setQuantity] = useState(1)
  const [status, setStatus] = useState<string | null>(null)

  const edition = pickEdition(nft, search.edicao)
  const soldOut = edition.available === 0
  const max = Math.max(1, Math.min(edition.available, MAX_PER_LINE))
  const qty = Math.min(quantity, max)

  // Preço/estoque mudou (evento Socket.IO ou refetch) enquanto a pessoa olha: avisa em vez de trocar em silêncio.
  const [seen, setSeen] = useState({ id: edition.id, price: edition.priceEth, available: edition.available })
  if (seen.id !== edition.id) {
    setSeen({ id: edition.id, price: edition.priceEth, available: edition.available })
  } else if (seen.price !== edition.priceEth || seen.available !== edition.available) {
    setSeen({ id: edition.id, price: edition.priceEth, available: edition.available })
    setStatus(
      seen.price !== edition.priceEth
        ? `O preço da edição ${edition.label} mudou de ${formatEth(seen.price)} para ${formatEth(edition.priceEth)}.`
        : edition.available === 0
          ? `A edição ${edition.label} esgotou.`
          : `Agora restam ${edition.available} unidades da edição ${edition.label}.`,
    )
  }

  const selectEdition = (id: string) => {
    setQuantity(1)
    setStatus(null)
    void navigate({ search: { edicao: id === nft.defaultEditionId ? undefined : id }, replace: true, resetScroll: false })
  }

  const add = (then: 'cart' | 'stay') => {
    if (soldOut) return
    setStatus(null)
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty },
      {
        onSuccess: () => {
          if (then === 'cart') void navigate({ to: '/carrinho' })
          else setStatus(`${qty} × ${nft.name} (${edition.label}) no carrinho.`)
        },
      },
    )
  }

  const errorMessage = addToCart.error ? addToCart.error.message : null
  const total = eth.times(edition.priceEth, qty)
  const availability = soldOut ? 'Esgotado' : `${edition.available} ${edition.available === 1 ? 'disponível' : 'disponíveis'}`
  const feedback = (
    <>
      <p role="status" className="text-sm text-sand-light empty:hidden">
        {status}
      </p>
      {errorMessage && (
        <p role="alert" className="text-sm text-[#ff8a7a]">
          {errorMessage}
        </p>
      )}
    </>
  )

  return (
    <>
      {/* ---------- Desktop (Figma 1440) ---------- */}
      <div className="hidden flex-col gap-3 lg:flex">
        <nav aria-label="Trilha" className="text-[15px] leading-4 font-bold text-cream">
          <Link to="/" className={cn('hover:text-copper-light', focusRing)}>
            Início
          </Link>
          {' / '}
          <Link to="/" hash="catalogo" className={cn('hover:text-copper-light', focusRing)}>
            Mercado
          </Link>
        </nav>
        <article className="flex gap-8">
          <div className="w-[573px] shrink-0">
            <NftGallery images={nft.images} name={nft.name} />
          </div>
          <div className="flex min-h-[448px] min-w-0 flex-1 flex-col justify-between gap-4">
            <div className="flex flex-col gap-3 border-b border-copper/35 pb-3">
              <h1 className="text-[28px] font-bold text-cream">{nft.name}</h1>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[22px] leading-4 font-bold text-copper-light">
                  <span className="sr-only">Preço da edição {edition.label}: </span>
                  {formatEth(edition.priceEth)}
                </p>
                <p className="flex items-center gap-1 text-[15px] text-cream">
                  <RatingStars average={nft.rating.average} />
                  <span className="sr-only">Nota {nft.rating.average.replace('.', ',')} de 5, </span>
                  {nft.rating.count} avaliações de colecionadores
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-[15px] leading-4 font-bold text-cream">Sobre este NFT:</h2>
              <p className="text-sm leading-6 text-sand-light">{nft.description}</p>
            </div>
            <div className="flex items-end justify-between gap-4">
              <EditionPicker editions={nft.editions} value={edition.id} onChange={selectEdition} idPrefix="ed" />
              <p className="pb-1 text-sm text-sand">{availability}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <QuantityStepper value={qty} max={max} onChange={setQuantity} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => add('cart')}
                  disabled={soldOut || addToCart.isPending}
                  className={cn('h-10 w-[130px] rounded-md bg-copper text-sm leading-5 font-bold text-ink hover:bg-copper-light disabled:opacity-60', focusRing)}
                >
                  {soldOut ? 'ESGOTADO' : addToCart.isPending ? 'ADICIONANDO…' : 'COMPRAR'}
                </button>
                <FavoriteButton nftId={nft.id} nftName={nft.name} variant="labeled" />
              </div>
            </div>
            {feedback}
            <div className="flex flex-col gap-3">
              <dl className="flex flex-col gap-3 text-[15px] text-sand">
                <TokenFacts nft={nft} />
              </dl>
              <ShareLinks name={nft.name} />
            </div>
          </div>
        </article>
      </div>

      {/* ---------- Mobile (Figma 414) ---------- */}
      <article className="-mx-6 lg:hidden">
        <div className="bg-linear-[137.6deg] from-surface-card from-12% to-surface-raised px-7 pt-[23px] pb-[84px]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Voltar"
              onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}
              className={cn('grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised', focusRing)}
            >
              <img src={backArrow} alt="" width={13} height={7} className="rotate-90" />
            </button>
            <FavoriteButton nftId={nft.id} nftName={nft.name} variant="hero" />
          </div>
          <MobileGallery images={nft.images} name={nft.name} />
        </div>
        <div className="-mt-[114px] flex flex-col gap-3 rounded-t-[31px] bg-surface-card px-6 pt-8 pb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl leading-4 font-bold text-cream">{nft.name}</h1>
            <p className="flex h-[27px] shrink-0 items-center gap-1 rounded-[32px] border border-copper px-1.5 text-sm leading-4">
              <MaskIcon src={starIcon} width={11.7} height={11.1} className="text-[#e3a44e]" />
              <span className="sr-only">Nota </span>
              <span className="font-medium text-cream">{nft.rating.average}</span>
              <span className="text-sand-light">
                ({nft.rating.count}
                <span className="sr-only"> avaliações</span>)
              </span>
            </p>
          </div>
          <p className="text-sm leading-6 text-sand-light">{nft.description}</p>
          <EditionPicker editions={nft.editions} value={edition.id} onChange={selectEdition} idPrefix="ed-m" />
          <p className="text-sm text-sand">{availability}</p>
          <dl className="flex flex-col gap-3 text-[15px] text-sand">
            <TokenFacts nft={nft} />
          </dl>
          <ShareLinks name={nft.name} />
        </div>
      </article>

      {/* Barra de compra fixa (Figma "Buy Bar"). */}
      <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[40px] bg-surface-card px-6 pt-5 pb-9 shadow-[0_0_10px_rgba(10,6,4,0.45)] lg:hidden">
        <div className="mx-auto flex max-w-[480px] flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[15px] leading-4 font-medium text-sand-light" aria-hidden>
                Qtd.
              </span>
              <QuantityStepper value={qty} max={max} onChange={setQuantity} size="sm" />
            </div>
            <p className="text-right text-xl leading-4 font-bold text-copper-light">
              <span className="sr-only">Total: </span>
              {formatEth(total)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => add('cart')}
              disabled={soldOut || addToCart.isPending}
              className={cn('h-[60px] flex-1 rounded-[40px] bg-linear-[100deg] from-copper from-4% to-copper/80 text-base leading-5 font-bold text-ink disabled:opacity-60 sm:w-[196px] sm:flex-none', focusRing)}
            >
              {soldOut ? 'Esgotado' : addToCart.isPending ? 'Adicionando…' : 'Comprar NFT'}
            </button>
            <button
              type="button"
              onClick={() => add('stay')}
              disabled={soldOut || addToCart.isPending}
              aria-label="Adicionar ao carrinho e continuar aqui"
              className={cn('grid size-[60px] place-items-center rounded-[40px] border border-border bg-surface-raised disabled:opacity-60', focusRing)}
            >
              <img src={shopIcon} alt="" width={20} height={20} />
            </button>
          </div>
          <div className="lg:hidden">{feedback}</div>
        </div>
      </div>
    </>
  )
}

function TokenFacts({ nft }: { nft: NftDetail }) {
  return (
    <>
      <div className="flex gap-1">
        <dt>ID do token:</dt>
        <dd>{nft.tokenId}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Coleção:</dt>
        <dd>{nft.collection.name}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Atributos:</dt>
        <dd>{nft.attributes.join(', ')}</dd>
      </div>
    </>
  )
}

function DetailError({ notFound, onRetry }: { notFound: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface-card p-6 lg:mt-8">
      <h1 className="text-heading font-bold text-cream">{notFound ? 'NFT não encontrado' : 'Não foi possível carregar este NFT'}</h1>
      <p className="text-sand-light">{notFound ? 'O link pode estar errado ou o NFT saiu do mercado.' : 'Confira sua conexão e tente de novo.'}</p>
      <div className="flex gap-3">
        {!notFound && (
          <button type="button" onClick={onRetry} className={cn('rounded-md bg-copper px-4 py-2 text-sm font-bold text-ink', focusRing)}>
            Tentar de novo
          </button>
        )}
        <Link to="/" hash="catalogo" className={cn('rounded-md border border-border-soft px-4 py-2 text-sm text-cream', focusRing)}>
          Voltar ao catálogo
        </Link>
      </div>
    </div>
  )
}

/** Mesmo esqueleto da tela real (galeria 573 + detalhes), para não haver salto quando os dados chegam. */
function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando NFT">
      <div className="hidden flex-col gap-3 lg:flex">
        <Skeleton className="h-4 w-36" />
        <div className="flex gap-8">
          <div className="flex w-[573px] shrink-0 items-center gap-7">
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="size-[100px] rounded-lg" />
              ))}
            </div>
            <Skeleton className="size-[444px] rounded-md" />
          </div>
          <div className="flex h-[448px] flex-1 flex-col justify-between">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-1/2" />
          </div>
        </div>
      </div>
      <div className="-mx-6 lg:hidden">
        <div className="bg-surface-card px-7 pt-[66px] pb-[84px]">
          <Skeleton className="mx-auto aspect-[361/356] w-full max-w-[480px] rounded-3xl" />
        </div>
        <div className="-mt-[114px] flex flex-col gap-3 rounded-t-[31px] bg-surface-card px-6 pt-8 pb-6">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-7 w-1/2" />
        </div>
      </div>
    </div>
  )
}
