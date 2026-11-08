import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useState } from 'react'
import backArrow from '@/assets/figma/md-arrow-left.svg'
import type { Cart, CartLine } from '@/api/contracts'
import { privateScope } from '@/api/query-keys'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { MaskIcon } from '@/components/mask-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { CartCards, CartTable, type CartLineActions } from '@/features/cart/cart-lines'
import { CheckoutCta, CouponForm, QuoteTotals, type QuoteState } from '@/features/cart/cart-summary'
import { describeIssue } from '@/features/cart/quote-issues'
import { cartQuery, cartQuoteQuery } from '@/features/cart/queries'
import { useRemoveCartLine, useUpdateCartLine } from '@/features/cart/use-cart-mutations'
import { RelatedNfts } from '@/features/nft/nft-sections'
import { usePrivateScope, useSession } from '@/features/session/use-session'
import { formatEth } from '@/lib/format'
import { onRealtimeNotice } from '@/realtime/client'

/** O carrinho mostra a taxa estimada na rede padrão; a rede de fato é escolhida no pagamento. */
const SUMMARY_NETWORK = 'ethereum' as const

export const Route = createFileRoute('/carrinho')({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(cartQuery(privateScope()))
  },
  component: CartPage,
})

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

function CartPage() {
  const scope = usePrivateScope()
  const cart = useQuery(cartQuery(scope))

  return (
    <>
      <SiteHeader section="market" />
      <main className="page-container flex flex-col gap-3 pt-8 max-lg:min-h-dvh lg:gap-24 lg:pb-24">
        <MobileHeader />
        {cart.data ? (
          <CartContent cart={cart.data} />
        ) : cart.isError ? (
          <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface-card p-6">
            <h1 className="text-heading font-bold text-cream">Não foi possível carregar o carrinho</h1>
            <p className="text-sand-light">Seus itens continuam salvos. Confira sua conexão e tente de novo.</p>
            <button type="button" onClick={() => void cart.refetch()} className={cn('rounded-md bg-copper px-4 py-2 text-sm font-bold text-ink', focusRing)}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <CartSkeleton />
        )}
        <div className="hidden lg:block">
          <RelatedNfts nftId={cart.data?.items[0]?.nftId} title="Colecionadores também viram" />
        </div>
      </main>
      <div className="hidden lg:block">
        <SiteFooter />
      </div>
    </>
  )
}

/** Cabeçalho mobile do Figma: voltar (círculo 35 px) + título centralizado. */
function MobileHeader() {
  const router = useRouter()
  const navigate = useNavigate()
  const canGoBack = useCanGoBack()
  return (
    <div className="grid h-11 grid-cols-[35px_1fr_35px] items-start lg:hidden">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}
        className={cn('grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised text-sand', focusRing)}
      >
        <MaskIcon src={backArrow} width={13.17} height={7.33} className="rotate-90" />
      </button>
      <p aria-hidden className="pt-[9px] text-center text-xl leading-4 font-bold text-cream">
        Carrinho de NFTs
      </p>
    </div>
  )
}

/** Último aviso ao vivo sobre um item do carrinho; some quando o item sai do carrinho. */
function useLiveNotices(cart: Cart) {
  const [notice, setNotice] = useState<{ nftId: string; text: string } | null>(null)
  useEffect(() => {
    const unsubscribe = onRealtimeNotice((event) => {
      if (event.kind !== 'cart-line-changed') return
      const text =
        event.after.available === 0
          ? `${event.name} esgotou enquanto estava no carrinho.`
          : event.before.priceEth !== event.after.priceEth
            ? `O preço de ${event.name} mudou de ${formatEth(event.before.priceEth)} para ${formatEth(event.after.priceEth)}. O total foi recalculado.`
            : `Agora restam ${event.after.available} unidade(s) de ${event.name}.`
      setNotice({ nftId: event.nftId, text })
    })
    return () => void unsubscribe()
  }, [])
  return notice && cart.items.some((line) => line.nftId === notice.nftId) ? notice.text : null
}

function CartContent({ cart }: { cart: Cart }) {
  const scope = usePrivateScope()
  const session = useSession()
  const update = useUpdateCartLine()
  const remove = useRemoveCartLine()
  const notice = useLiveNotices(cart)
  const [removed, setRemoved] = useState<string | null>(null)

  const quoteQuery = useQuery({ ...cartQuoteQuery(scope, SUMMARY_NETWORK, cart.version), enabled: cart.items.length > 0 })
  const quoteState: QuoteState = {
    quote: quoteQuery.data,
    // Placeholder (versão anterior do carrinho) ou refazendo após preço ao vivo: os valores ainda não valem.
    stale: quoteQuery.isPlaceholderData || quoteQuery.isFetching,
    error: quoteQuery.error,
    retry: () => void quoteQuery.refetch(),
  }

  const actions: CartLineActions = {
    onQuantity: (line, quantity) => update.mutate({ lineId: line.id, quantity }),
    onRemove: (line: CartLine) => {
      setRemoved(`${line.name} (${line.editionLabel}) saiu do carrinho.`)
      remove.mutate(line.id)
    },
  }

  const mutationError = update.error ?? remove.error
  const issues = quoteState.stale ? [] : (quoteQuery.data?.issues ?? []).map((issue) => describeIssue(issue, cart))
  const canCheckout = Boolean(quoteQuery.data && !quoteState.stale && quoteQuery.data.lines.length > 0) && !update.isPending && !remove.isPending

  if (cart.items.length === 0) return <EmptyCart message={removed} />

  const feedback = (
    <div className="flex flex-col gap-2 empty:hidden">
      <p role="status" className="text-sm text-sand-light empty:hidden">
        {notice ?? removed}
      </p>
      {mutationError && (
        <p role="alert" className="text-sm text-[#ff8a7a]">
          {mutationError.message}
        </p>
      )}
      {issues.length > 0 && (
        <ul aria-label="Ajustes na cotação" className="flex flex-col gap-1 text-sm text-copper-light">
          {issues.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </div>
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
          {' / '}
          <span aria-current="page">Carrinho</span>
        </nav>
        <h1 className="sr-only">Carrinho de NFTs</h1>
        <div className="grid grid-cols-[minmax(0,782px)_332px] items-start justify-between gap-10">
          <div className="-mt-3 flex flex-col gap-4">
            <CartTable lines={cart.items} quoteLines={quoteState.stale ? undefined : quoteQuery.data?.lines} actions={actions} />
            {feedback}
          </div>
          <section aria-labelledby="summary-title" className="flex flex-col gap-6">
            <h2 id="summary-title" className="border-b border-copper/35 pb-3 text-lg leading-4 font-bold text-cream">
              Resumo da carteira
            </h2>
            <CouponForm cart={cart} quote={quoteQuery.data} variant="desktop" />
            <QuoteTotals state={quoteState} variant="desktop" />
            <CheckoutCta disabled={!canCheckout} signedIn={session !== null} variant="desktop" />
          </section>
        </div>
      </div>

      {/* ---------- Mobile (Figma 414) ---------- */}
      <div className="flex flex-1 flex-col gap-1 lg:hidden">
        <h1 className="sr-only">Carrinho de NFTs</h1>
        <div className="flex flex-col gap-4 pb-4">
          <CartCards lines={cart.items} quoteLines={quoteState.stale ? undefined : quoteQuery.data?.lines} actions={actions} />
          {feedback}
        </div>
        <section aria-label="Resumo do pedido" className="-mx-6 mt-auto flex flex-col gap-8 rounded-t-[40px] bg-surface-card px-6 pt-6 pb-9">
          <div className="mx-auto flex w-full max-w-[480px] flex-col gap-3">
            <CouponForm cart={cart} quote={quoteQuery.data} variant="mobile" />
            <QuoteTotals state={quoteState} variant="mobile" />
          </div>
          <div className="mx-auto w-full max-w-[480px]">
            <CheckoutCta disabled={!canCheckout} signedIn={session !== null} variant="mobile" />
          </div>
        </section>
      </div>
    </>
  )
}

function EmptyCart({ message }: { message: string | null }) {
  return (
    <div className="flex flex-col items-start gap-4 lg:py-8">
      <h1 className="text-heading font-bold text-cream">Seu carrinho está vazio</h1>
      <p role="status" className="text-sand-light">
        {message ? `${message} ` : ''}Explore o mercado e adicione os NFTs que quiser colecionar.
      </p>
      <Link to="/" hash="catalogo" className={cn('rounded-[3px] bg-copper px-6 py-3 text-[15px] font-bold text-ink hover:bg-copper-light', focusRing)}>
        Explorar o mercado
      </Link>
    </div>
  )
}

/** Mesmo esqueleto da tela real (tabela 782 + resumo 332 no desktop, cartões no mobile). */
function CartSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando carrinho">
      <div className="hidden flex-col gap-3 lg:flex">
        <Skeleton className="h-4 w-60" />
        <div className="grid grid-cols-[minmax(0,782px)_332px] justify-between gap-10">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[70px] w-full rounded-none" />
            ))}
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-5 lg:hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded-[14px]" />
        ))}
      </div>
    </div>
  )
}
