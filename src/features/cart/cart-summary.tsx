import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { useId, useState } from 'react'
import { applyCouponRequest, type Cart, type Quote } from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/format'
import { useApplyCoupon, useRemoveCoupon } from './use-cart-mutations'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

type Variant = 'desktop' | 'mobile'

export interface QuoteState {
  quote: Quote | undefined
  /** Cotação exibida é de uma versão anterior do carrinho (a nova está a caminho). */
  stale: boolean
  error: Error | null
  retry: () => void
}

/* ------------------------------------------------------------------ */
/* Cupom                                                               */
/* ------------------------------------------------------------------ */

export function CouponForm({ cart, quote, variant }: { cart: Cart; quote: Quote | undefined; variant: Variant }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  const apiError = apply.error ? (isApiError(apply.error) ? (apply.error.fields.code ?? apply.error.message) : apply.error.message) : null
  const error = clientError ?? apiError
  const removeError = remove.error?.message ?? null

  if (cart.couponCode) {
    // Quem manda é a cotação: se ela não trouxe o cupom, ele foi recusado (o motivo aparece nos avisos).
    const label = quote?.coupon?.code === cart.couponCode ? quote.coupon.label : `Cupom ${cart.couponCode}`
    return (
      <div className="flex flex-col gap-2">
        {variant === 'desktop' && <p className="text-sm leading-4 font-bold text-cream">Código promocional</p>}
        <div className={cn('flex items-center justify-between gap-3 border border-copper', variant === 'desktop' ? 'h-10 rounded-[3px] pl-2' : 'h-[50px] rounded-[40px] pl-4')}>
          <p className="truncate text-sm text-cream">
            <span className="sr-only">Cupom aplicado: </span>
            {label}
          </p>
          <button
            type="button"
            onClick={() => remove.mutate(undefined)}
            disabled={remove.isPending}
            className={cn('h-full shrink-0 px-4 text-sm font-bold text-copper-light hover:text-cream disabled:opacity-60', focusRing)}
          >
            {remove.isPending ? 'Removendo…' : 'Remover'}
          </button>
        </div>
        {removeError && (
          <p role="alert" className="text-xs text-[#ff8a7a]">
            {removeError}
          </p>
        )}
      </div>
    )
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = applyCouponRequest.safeParse({ code })
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? 'Código inválido.')
      return
    }
    setClientError(null)
    apply.mutate(parsed.data.code, { onSuccess: () => setCode('') })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={inputId} className={cn('text-sm leading-4 font-bold text-cream', variant === 'mobile' && 'sr-only')}>
        Código promocional
      </label>
      <div
        className={cn(
          'flex items-center border has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-copper-light',
          variant === 'desktop'
            ? 'h-10 rounded-[3px] border-copper pl-2'
            : 'h-[50px] rounded-[40px] border-border bg-surface-card pl-4 shadow-[0_6px_10px_rgba(10,6,4,0.45)]',
          error && 'border-[#ff8a7a]',
        )}
      >
        <input
          id={inputId}
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            setClientError(null)
            apply.reset()
          }}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent text-cream uppercase outline-none placeholder:text-sand placeholder:normal-case',
            variant === 'desktop' ? 'text-xs leading-4' : 'text-[13px] leading-[22px]',
          )}
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className={cn(
            'h-full shrink-0 text-[15px] leading-4 font-bold disabled:opacity-60',
            variant === 'desktop'
              ? 'w-[102px] rounded-r-[3px] bg-copper text-ink hover:bg-copper-light'
              : 'w-[97px] rounded-[40px] bg-linear-[96deg] from-copper/55 from-1% to-copper text-cream',
            focusRing,
          )}
        >
          {apply.isPending ? '…' : 'Aplicar'}
          {apply.isPending && <span className="sr-only">Aplicando cupom</span>}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[#ff8a7a]">
          {error}
        </p>
      )}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Valores (sempre os da cotação)                                      */
/* ------------------------------------------------------------------ */

export function QuoteTotals({ state, variant }: { state: QuoteState; variant: Variant }) {
  const { quote, stale, error, retry } = state
  const value = variant === 'desktop' ? 'text-lg leading-4' : 'text-base leading-4'

  if (!quote && error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-sm text-sand-light">
        <p>Não foi possível calcular os valores do carrinho.</p>
        <button type="button" onClick={retry} className={cn('font-bold text-copper-light underline underline-offset-4', focusRing)}>
          Tentar de novo
        </button>
      </div>
    )
  }

  const amount = (eth: string | undefined, className?: string) =>
    eth === undefined ? <Skeleton className="h-4 w-20" /> : <span className={cn('text-right', className)}>{eth}</span>

  return (
    <div aria-busy={stale || !quote} className={cn('flex flex-col gap-3 transition-opacity', stale && 'opacity-60')}>
      <dl className="flex flex-col gap-3 text-[15px] whitespace-nowrap text-cream">
        <div className="flex items-start justify-between gap-3">
          <dt>Subtotal</dt>
          <dd className={value}>{amount(quote && formatEth(quote.subtotalEth))}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="truncate">{quote?.coupon?.label ?? 'Desconto do lançamento'}</dt>
          <dd>{amount(quote && `(-) ${formatEth(quote.discountEth)}`)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt>Taxa de rede</dt>
          <dd className="flex flex-col items-end gap-1 lg:gap-3">
            <span className={value}>{amount(quote && formatEth(quote.networkFeeEth))}</span>
            <span className="text-xs leading-4 text-copper-light">Taxa estimada</span>
          </dd>
        </div>
        <div className={cn('flex items-start justify-between gap-3 font-bold', variant === 'desktop' && 'mt-3')}>
          <dt className="text-base leading-4">Total</dt>
          <dd className="text-lg leading-4 text-copper-light">{amount(quote && formatEth(quote.totalEth))}</dd>
        </div>
      </dl>
      {/* Anuncia o total novo para leitor de tela quando a cotação muda (preço ao vivo, cupom, quantidade). */}
      <p aria-live="polite" className="sr-only">
        {quote && !stale ? `Total atualizado: ${formatEth(quote.totalEth)}` : ''}
      </p>
      {quote && error && (
        <p role="alert" className="text-xs text-[#ff8a7a]">
          Não foi possível atualizar os valores.{' '}
          <button type="button" onClick={retry} className={cn('font-bold underline', focusRing)}>
            Tentar de novo
          </button>
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Botão de finalizar                                                   */
/* ------------------------------------------------------------------ */

export function CheckoutCta({ disabled, signedIn, variant }: { disabled: boolean; signedIn: boolean; variant: Variant }) {
  const base = cn(
    'flex w-full items-center justify-center font-bold text-ink aria-disabled:pointer-events-none aria-disabled:opacity-50',
    variant === 'desktop' ? 'h-10 rounded-[3px] bg-copper text-[15px] leading-4 hover:bg-copper-light' : 'h-[60px] rounded-[40px] bg-linear-[109deg] from-copper from-4% to-copper/80 text-base leading-4',
    focusRing,
  )
  // Checkout é rota protegida: o visitante passa pelo login e volta para o pagamento com o carrinho mesclado.
  const link = signedIn ? (
    <Link to="/pagamento" aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} className={base}>
      Conectar e finalizar
    </Link>
  ) : (
    <Link to="/entrar" search={{ redirect: '/pagamento' }} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} className={base}>
      Conectar e finalizar
    </Link>
  )
  return (
    <div className="flex flex-col items-center gap-3">
      {link}
      {!signedIn && <p className="text-center text-xs text-sand-light">Você vai entrar na sua conta antes de pagar. O carrinho continua com você.</p>}
      {variant === 'desktop' && (
        <Link to="/" hash="catalogo" className={cn('text-[15px] text-copper-light hover:text-cream', focusRing)}>
          Continuar explorando
        </Link>
      )}
    </div>
  )
}
