import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useId, useRef, useState } from 'react'
import backArrow from '@/assets/figma/md-arrow-left.svg'
import toggleOff from '@/assets/figma/toggle-off.svg'
import radioOn from '@/assets/figma/radio-on.svg'
import type { Cart, CollectorDetails, Profile, Wallet, WalletsResponse } from '@/api/contracts'
import { privateScope } from '@/api/query-keys'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { MaskIcon } from '@/components/mask-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { QuoteTotals, type QuoteState } from '@/features/cart/cart-summary'
import { cartQuery, cartQuoteQuery } from '@/features/cart/queries'
import { describeIssue } from '@/features/cart/quote-issues'
import { NftImage } from '@/features/catalog/nft-image'
import { EnsField, focusRing, ProviderOptions, SelectField, TextField, WalletCards } from '@/features/checkout/fields'
import { FIELD_ORDER, initialDraft, networkOptions, providerOptions, validateDraft, walletFieldsOf, type CheckoutDraft, type CheckoutField, type FieldErrors } from '@/features/checkout/form'
import { pendingOrdersQuery, profileQuery, useWalletConnection, walletsQuery } from '@/features/checkout/queries'
import { ReviewDialog } from '@/features/checkout/review-dialog'
import { describeFailure, usePlaceOrder } from '@/features/checkout/use-place-order'
import { sessionDrafts } from '@/features/session/session'
import { usePrivateScope, useSession } from '@/features/session/use-session'
import { formatEth } from '@/lib/format'

export const Route = createFileRoute('/_privado/pagamento')({
  loader: ({ context }) => {
    const scope = privateScope()
    void context.queryClient.prefetchQuery(cartQuery(scope))
    void context.queryClient.prefetchQuery(walletsQuery(scope))
    void context.queryClient.prefetchQuery(profileQuery(scope))
  },
  component: CheckoutPage,
})

function CheckoutPage() {
  const scope = usePrivateScope()
  const session = useSession()
  const cart = useQuery(cartQuery(scope))
  const wallets = useQuery(walletsQuery(scope))
  const profile = useQuery(profileQuery(scope))
  const pending = useQuery(pendingOrdersQuery(scope))

  const failed = [cart, wallets, profile].find((q) => q.isError)
  const pendingOrder = pending.data?.items[0]

  let body: React.ReactNode
  if (failed) {
    body = (
      <Notice title="Não foi possível carregar o pagamento" action={<RetryButton onClick={() => [cart, wallets, profile].forEach((q) => q.isError && void q.refetch())} />}>
        Seu carrinho continua salvo. Confira sua conexão e tente de novo.
      </Notice>
    )
  } else if (!cart.data || !wallets.data || !profile.data || !session) {
    body = <CheckoutSkeleton />
  } else if (cart.data.items.length === 0) {
    body = (
      <Notice title="Seu carrinho está vazio" action={<CtaLink to="/">Explorar o mercado</CtaLink>}>
        Adicione NFTs ao carrinho para finalizar uma compra.
      </Notice>
    )
  } else {
    const draft = initialDraft(wallets.data, profile.data)
    body = draft ? (
      <CheckoutForm key={session.userId} userId={session.userId} cart={cart.data} wallets={wallets.data} profile={profile.data} />
    ) : (
      <Notice title="Cadastre uma carteira para pagar" action={<CtaLink to="/carteiras">Cadastrar carteira</CtaLink>}>
        O pagamento usa a carteira principal ou a secundária da sua conta.
      </Notice>
    )
  }

  return (
    <>
      <SiteHeader section="market" />
      <main className="page-container flex flex-col gap-4 pt-8 max-lg:min-h-dvh lg:gap-8 lg:pb-24">
        <MobileHeader />
        <nav aria-label="Trilha" className="hidden text-[15px] leading-4 font-bold text-cream lg:block">
          <Link to="/" className={cn('hover:text-copper-light', focusRing)}>
            Início
          </Link>
          {' / '}
          <Link to="/carrinho" className={cn('hover:text-copper-light', focusRing)}>
            Mercado
          </Link>
          {' / '}
          <span aria-current="page">Pagamento</span>
        </nav>
        <h1 className="sr-only">Pagamento com carteira</h1>
        {pendingOrder && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-copper bg-surface-dark p-4 text-sm">
            <p>Você tem um pedido em processamento ({formatEth(pendingOrder.totalEth)}). Aguarde o resultado antes de comprar de novo.</p>
            <Link to="/pedido/$orderId" params={{ orderId: pendingOrder.id }} className={cn('font-bold text-copper-light underline underline-offset-4', focusRing)}>
              Acompanhar pedido
            </Link>
          </div>
        )}
        {body}
      </main>
      <div className="hidden lg:block">
        <SiteFooter />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Formulário                                                          */
/* ------------------------------------------------------------------ */

const walletList = (wallets: WalletsResponse) => [wallets.secondary, wallets.primary].filter((w): w is Wallet => w !== null)

function CheckoutForm({ userId, cart, wallets, profile }: { userId: string; cart: Cart; wallets: WalletsResponse; profile: Profile }) {
  const scope = usePrivateScope()
  const navigate = useNavigate()
  const ids = useId()
  const draftKey = sessionDrafts.key(userId, 'checkout')

  // Rascunho por usuário: sobrevive ao refresh e à volta do login (sessão expirada no meio do checkout).
  const [draft, setDraft] = useState<CheckoutDraft>(() => {
    const saved = sessionDrafts.read<CheckoutDraft>(draftKey)
    const fresh = initialDraft(wallets, profile) as CheckoutDraft
    return saved && wallets[saved.walletSlot] ? { ...fresh, ...saved } : fresh
  })
  useEffect(() => sessionDrafts.write(draftKey, draft), [draftKey, draft])

  const [errors, setErrors] = useState<FieldErrors>({})
  const [showCollector, setShowCollector] = useState(false)
  const wallet = wallets[draft.walletSlot] ?? walletList(wallets)[0] ?? null
  const otherWallet = wallet ? wallets[wallet.slot === 'primary' ? 'secondary' : 'primary'] : null

  const quoteQuery = useQuery(cartQuoteQuery(scope, draft.network, cart.version))
  const quoteState: QuoteState = {
    quote: quoteQuery.data,
    stale: quoteQuery.isPlaceholderData || quoteQuery.isFetching,
    error: quoteQuery.error,
    retry: () => void quoteQuery.refetch(),
  }

  const placeOrder = usePlaceOrder()
  const failure = placeOrder.error ? describeFailure(placeOrder.error) : null
  const { connect, disconnect } = useWalletConnection()

  // Revisão: guarda os dados validados e a cotação que a pessoa viu ao abrir.
  const [review, setReview] = useState<{ collector: CollectorDetails; note: string | null; seenQuoteId: string | null } | null>(null)
  const quoteChanged = review !== null && quoteQuery.data !== undefined && !quoteState.stale && quoteQuery.data.id !== review.seenQuoteId

  const update = <K extends CheckoutField>(field: K, value: CheckoutDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }
  const selectWallet = (next: Wallet) => {
    setDraft((d) => ({ ...d, walletSlot: next.slot, ...walletFieldsOf(next) }))
    setErrors({})
  }
  // Rede e carteira andam juntas (o servidor exige a mesma rede): se a outra carteira opera na rede escolhida, troca.
  const changeNetwork = (network: CheckoutDraft['network']) => {
    if (wallet && wallet.network !== network && otherWallet?.network === network) selectWallet(otherWallet)
    else update('network', network)
  }

  const focusFirstError = (fieldErrors: FieldErrors) => {
    const first = FIELD_ORDER.find((field) => fieldErrors[field])
    if (!first) return
    setShowCollector(true)
    requestAnimationFrame(() => document.getElementById(`${ids}-${first}`)?.focus())
  }

  // Foco volta para quem abriu a revisão: o diálogo desmonta ao fechar e o Radix não consegue restaurar.
  const reviewOpener = useRef<HTMLElement | null>(null)
  const openReview = () => {
    const result = validateDraft(draft, wallet)
    if (!result.ok) {
      setErrors(result.errors)
      focusFirstError(result.errors)
      return
    }
    placeOrder.reset()
    connect.reset()
    reviewOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setReview({ collector: result.collector, note: result.note, seenQuoteId: quoteQuery.data?.id ?? null })
    // Revalida na hora de revisar: preço, estoque, cupom e taxa atuais (R-6.3).
    void quoteQuery.refetch()
  }

  const acknowledge = () => {
    placeOrder.reset()
    setReview((r) => (r ? { ...r, seenQuoteId: quoteQuery.data?.id ?? null } : r))
  }

  const confirm = () => {
    const quote = quoteQuery.data
    if (!review || !quote || !wallet) return
    placeOrder.mutate(
      { quoteId: quote.id, walletId: wallet.id, collector: review.collector, note: review.note },
      {
        onSuccess: (order) => {
          sessionDrafts.write(draftKey, null)
          void navigate({ to: '/pedido/$orderId', params: { orderId: order.id }, replace: true })
        },
        onError: (error) => {
          const described = describeFailure(error)
          if (described.kind === 'fields') {
            setReview(null)
            setErrors(described.fields)
            focusFirstError(described.fields)
          }
        },
      },
    )
  }

  const id = (field: CheckoutField) => `${ids}-${field}`
  const issues = quoteState.stale ? [] : (quoteQuery.data?.issues ?? []).map((issue) => describeIssue(issue, cart))
  // Placeholder é a cotação da rede anterior: revisar sobre ela registraria como "vista" uma cotação
  // que não vale para a rede escolhida e acusaria mudança falsa quando a nova chegasse (bug C-1).
  const canReview = Boolean(quoteQuery.data && !quoteQuery.isPlaceholderData && quoteQuery.data.lines.length > 0)

  const collectorFields = (
    <div className="grid gap-x-6 gap-y-3 lg:grid-cols-2">
      <TextField id={id('displayName')} label="Nome de exibição" required value={draft.displayName} onChange={(v) => update('displayName', v)} error={errors.displayName} autoComplete="name" />
      <TextField id={id('username')} label="Nome de usuário" required value={draft.username} onChange={(v) => update('username', v)} error={errors.username} autoComplete="username" spellCheck={false} />
      <SelectField id={id('network')} label="Rede" required value={draft.network} options={networkOptions} onChange={changeNetwork} error={errors.network} />
      <TextField id={id('profileName')} label="Nome do perfil" required value={draft.profileName} onChange={(v) => update('profileName', v)} error={errors.profileName} />
      <TextField
        id={id('address')}
        label="Endereço da carteira"
        required
        value={draft.address}
        onChange={(v) => update('address', v)}
        error={errors.address}
        placeholder="Endereço 0x da carteira"
        spellCheck={false}
        autoComplete="off"
        className="font-mono"
      />
      <TextField
        id={id('secondaryAddressOrEns')}
        srLabel="ENS ou carteira secundária (opcional)"
        value={draft.secondaryAddressOrEns}
        onChange={(v) => update('secondaryAddressOrEns', v)}
        error={errors.secondaryAddressOrEns}
        placeholder="ENS ou carteira secundária (opcional)"
        spellCheck={false}
        autoComplete="off"
      />
      <SelectField id={id('provider')} label="Tipo de carteira" required value={draft.provider} options={providerOptions} onChange={(v) => update('provider', v)} error={errors.provider} />
      <TextField id={id('referralCode')} label="Código de indicação" required value={draft.referralCode} onChange={(v) => update('referralCode', v)} error={errors.referralCode} autoCapitalize="characters" spellCheck={false} />
      <TextField id={id('email')} label="E-mail" required type="email" value={draft.email} onChange={(v) => update('email', v)} error={errors.email} autoComplete="email" />
      <EnsField id={id('ensLabel')} value={draft.ensLabel} onChange={(v) => update('ensLabel', v)} error={errors.ensLabel} />
    </div>
  )

  const note = (
    <div className="flex flex-col gap-3 lg:w-[350px]">
      <label htmlFor={id('note')} className="text-[15px] leading-[15px] text-cream">
        Observação do colecionador (opcional)
      </label>
      <textarea
        id={id('note')}
        value={draft.note}
        onChange={(event) => update('note', event.target.value)}
        maxLength={500}
        aria-invalid={errors.note ? true : undefined}
        className="h-[152px] resize-none rounded-[3px] border border-border bg-transparent p-3 text-sm text-cream focus-visible:border-copper focus-visible:outline-none"
      />
      {errors.note && <p className="text-xs text-[#ff8a7a]">{errors.note}</p>}
    </div>
  )

  const cta = (className: string) => (
    <button type="button" onClick={openReview} disabled={!canReview} className={cn('font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50', focusRing, className)}>
      Confirmar compra
    </button>
  )

  const errorCount = Object.values(errors).filter(Boolean).length

  return (
    <>
      <p role="alert" className="sr-only">
        {errorCount ? `Revise ${errorCount} campo(s) destacado(s).` : ''}
      </p>
      <div className="flex flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_405px] lg:items-start lg:gap-8">
        {/* ---------- Coluna do formulário (desktop) / fluxo inteiro (mobile) ---------- */}
        <div className="flex flex-1 flex-col gap-4 lg:gap-6">
          {/* Mobile: carteiras cadastradas como cartões. */}
          <section aria-labelledby="mobile-wallets" className="flex flex-col gap-4 lg:hidden">
            <div className="flex items-center justify-between">
              <h2 id="mobile-wallets" className="text-base leading-4 font-bold text-cream">
                Carteira conectada
              </h2>
              <Link to="/carteiras" className={cn('text-sm font-bold text-copper-light', focusRing)}>
                Trocar carteira
              </Link>
            </div>
            <WalletCards wallets={walletList(wallets)} value={draft.walletSlot} onChange={selectWallet} />
          </section>
          <div className="lg:hidden">
            <ProviderOptions name={`${ids}-provider-m`} value={draft.provider} onChange={(v) => update('provider', v)} variant="mobile" />
          </div>

          <section aria-labelledby="collector-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="collector-title" className="text-base leading-4 font-bold text-cream lg:text-[17px]">
                Perfil do colecionador
              </h2>
              <button
                type="button"
                aria-expanded={showCollector}
                aria-controls={`${ids}-collector`}
                onClick={() => setShowCollector((v) => !v)}
                className={cn('text-sm font-bold text-copper-light lg:hidden', focusRing)}
              >
                {showCollector ? 'Ocultar' : 'Revisar dados'}
              </button>
            </div>
            <div id={`${ids}-collector`} className={cn('flex-col gap-6', showCollector ? 'flex' : 'hidden', 'lg:flex')}>
              {collectorFields}
              {otherWallet ? (
                <label className="flex w-fit cursor-pointer items-center gap-2 text-[15px] text-cream has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-copper-light max-lg:hidden">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={draft.walletSlot === 'secondary'}
                    onChange={() => wallet && otherWallet && selectWallet(otherWallet)}
                  />
                  <img src={draft.walletSlot === 'secondary' ? radioOn : toggleOff} alt="" width={15} height={15} />
                  Usar outra carteira? <span className="text-sand-light">({(draft.walletSlot === 'secondary' ? wallet : otherWallet)?.nickname})</span>
                </label>
              ) : (
                <Link to="/carteiras" className={cn('w-fit text-[15px] text-copper-light underline-offset-4 hover:underline max-lg:hidden', focusRing)}>
                  Cadastrar outra carteira
                </Link>
              )}
              {note}
            </div>
          </section>

          {issues.length > 0 && (
            <ul aria-label="Ajustes na cotação" className="flex flex-col gap-1 text-sm text-copper-light lg:hidden">
              {issues.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}

          {/* Mobile: total + botão no fim da tela. */}
          <div className="mt-auto flex flex-col gap-6 pt-4 pb-8 lg:hidden">
            <p className="flex items-center justify-end gap-7 font-bold" aria-busy={quoteState.stale}>
              <span className="text-base leading-4 text-cream">Total:</span>
              <span aria-busy={quoteState.stale} className="text-lg leading-4 text-copper-light">{quoteQuery.data ? formatEth(quoteQuery.data.totalEth) : '…'}</span>
            </p>
            {cta('h-[60px] w-full rounded-[40px] bg-linear-[108deg] from-copper from-4% to-copper/80 text-[15px] leading-4')}
            <p aria-live="polite" className="sr-only">
              {quoteQuery.data && !quoteState.stale ? `Total atualizado: ${formatEth(quoteQuery.data.totalEth)}` : ''}
            </p>
          </div>
        </div>

        {/* ---------- Resumo (desktop) ---------- */}
        <aside aria-labelledby="summary-title" className="hidden flex-col gap-3 lg:flex">
          <h2 id="summary-title" className="text-[17px] leading-4 font-bold text-cream">
            Seus NFTs
          </h2>
          <div className="flex items-center justify-between border-b border-copper/35 pb-3 text-base leading-4 text-cream">
            <span className="font-bold">NFTs</span>
            <span className="font-medium">Subtotal</span>
          </div>
          <ul aria-busy={quoteState.stale} className="flex flex-col gap-3">
            {(quoteQuery.data?.lines ?? []).map((line) => (
              <li key={`${line.nftId}:${line.editionId}`} className="flex h-[70px] items-center gap-2 bg-surface-card pr-4 pl-1">
                <NftImage src={line.image} alt="" sizes="66px" className="size-[66px] shrink-0 rounded-lg object-cover" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5 leading-4">
                  <span className="truncate text-base font-bold text-cream">{line.name}</span>
                  <span className="truncate text-sm text-sand">ID do token: {line.tokenId}</span>
                </span>
                <span className="text-sm whitespace-nowrap text-sand-light">(x {line.quantity})</span>
                <span className="text-lg leading-4 font-bold whitespace-nowrap text-copper-light">{formatEth(line.lineTotalEth)}</span>
              </li>
            ))}
            {!quoteQuery.data && Array.from({ length: Math.min(cart.items.length, 3) }, (_, i) => <Skeleton key={i} className="h-[70px] w-full rounded-none" />)}
          </ul>
          {issues.length > 0 && (
            <ul aria-label="Ajustes na cotação" className="flex flex-col gap-1 text-sm text-copper-light">
              {issues.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
          <p className="text-center text-sm leading-4 text-cream">
            Tem um código promocional?{' '}
            <Link to="/carrinho" className={cn('text-copper-light underline underline-offset-4', focusRing)}>
              Aplique aqui
            </Link>
          </p>
          <QuoteTotals state={quoteState} variant="desktop" />
          <div className="mt-3 flex flex-col gap-6">
            <ProviderOptions name={`${ids}-provider`} value={draft.provider} onChange={(v) => update('provider', v)} variant="desktop" />
            {cta('h-[45px] w-full rounded-[8px] bg-copper text-[15px] leading-4 hover:bg-copper-light')}
          </div>
        </aside>
      </div>

      {review && wallet && (
        <ReviewDialog
          open
          onOpenChange={(open) => {
            if (open) return
            setReview(null)
            requestAnimationFrame(() => reviewOpener.current?.focus())
          }}
          quote={quoteQuery.data}
          changed={quoteChanged || failure?.kind === 'quote-changed'}
          onAcknowledge={acknowledge}
          refreshing={quoteState.stale}
          collector={review.collector}
          wallet={wallet}
          connection={{
            connecting: connect.isPending,
            disconnecting: disconnect.isPending,
            error: connect.error?.message ?? disconnect.error?.message ?? null,
            onConnect: () => connect.mutate(wallet.id),
            onDisconnect: () => disconnect.mutate(wallet.id),
          }}
          submitting={placeOrder.isPending}
          failure={failure}
          onConfirm={confirm}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Peças da página                                                      */
/* ------------------------------------------------------------------ */

function MobileHeader() {
  const router = useRouter()
  const navigate = useNavigate()
  const canGoBack = useCanGoBack()
  return (
    <div className="flex h-11 items-start gap-6 lg:hidden">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/carrinho' }))}
        className={cn('grid size-[35px] shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-sand', focusRing)}
      >
        <MaskIcon src={backArrow} width={13.17} height={7.33} className="rotate-90" />
      </button>
      <p aria-hidden className="pt-[9px] text-xl leading-4 font-bold text-cream">
        Pagamento com carteira
      </p>
    </div>
  )
}

function Notice({ title, children, action }: { title: string; children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface-card p-6">
      <h2 className="text-heading font-bold text-cream">{title}</h2>
      <p className="text-sand-light">{children}</p>
      {action}
    </div>
  )
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-[3px] bg-copper px-4 py-2 text-sm font-bold text-ink', focusRing)}>
      Tentar de novo
    </button>
  )
}

function CtaLink({ to, children }: { to: '/' | '/carteiras'; children: React.ReactNode }) {
  return (
    <Link to={to} className={cn('rounded-[3px] bg-copper px-6 py-3 text-[15px] font-bold text-ink hover:bg-copper-light', focusRing)}>
      {children}
    </Link>
  )
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando pagamento" className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_405px] lg:gap-8">
      <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-[69px] w-full" />
        ))}
      </div>
      <div className="hidden flex-col gap-3 lg:flex">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full rounded-none" />
        ))}
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}
