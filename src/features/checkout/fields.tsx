import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import kebab from '@/assets/figma/kebab.svg'
import radioOffCopper from '@/assets/figma/radio-off-copper.svg'
import radioOff from '@/assets/figma/radio-off.svg'
import radioOn from '@/assets/figma/radio-on.svg'
import selectArrow from '@/assets/figma/select-arrow.svg'
import walletIcon from '@/assets/figma/wallet.svg'
import walletBadge from '@/assets/figma/wallet-badge.svg'
import type { Wallet, WalletProvider } from '@/api/contracts'
import { MaskIcon } from '@/components/mask-icon'
import { providerOptions, walletSummary } from './form'

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'
const errorText = 'text-xs text-[#ff8a7a]'
const inputBase =
  'h-10 w-full rounded-[3px] border bg-transparent px-3 text-sm leading-[15px] text-cream placeholder:text-sand aria-invalid:border-[#ff8a7a] focus-visible:border-copper focus-visible:outline-none'

interface FieldShell {
  id: string
  label?: string
  /** Rótulo só para leitor de tela (o Figma mostra o placeholder no lugar do rótulo). */
  srLabel?: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
}

function Label({ id, label, srLabel, required }: Pick<FieldShell, 'id' | 'label' | 'srLabel' | 'required'>) {
  if (!label) return <label htmlFor={id} className="sr-only">{srLabel}</label>
  return (
    <label htmlFor={id} className="flex min-w-0 items-start gap-1 text-[15px] leading-5 text-cream">
      <span className="min-w-0">{label}</span>
      {required && (
        <span aria-hidden className="shrink-0 text-[22px] leading-5 text-[#f0805f]">
          *
        </span>
      )}
      {required && <span className="sr-only">(obrigatório)</span>}
    </label>
  )
}

function Message({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) return <p id={`${id}-msg`} className={cn(errorText, 'mt-1')}>{error}</p>
  if (hint) return <p id={`${id}-msg`} className="mt-1 text-xs text-sand">{hint}</p>
  return null
}

export function TextField({
  id,
  label,
  srLabel,
  required,
  error,
  hint,
  className,
  value,
  onChange,
  ...input
}: FieldShell & Omit<React.ComponentProps<'input'>, 'id' | 'onChange' | 'value'> & { value: string; onChange: (value: string) => void }) {
  return (
    <div className={cn('flex min-w-0 flex-col justify-end', !label && 'pt-[29px]', className)}>
      <Label id={id} label={label} srLabel={srLabel} required={required} />
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        aria-required={required}
        className={cn(inputBase, 'border-border')}
        {...input}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  )
}

export function SelectField<T extends string>({
  id,
  label,
  required,
  error,
  className,
  value,
  options,
  onChange,
}: FieldShell & { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <Label id={id} label={label} required={required} />
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-msg` : undefined}
          className={cn(inputBase, 'appearance-none border-border bg-ink pr-9 pl-3')}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <MaskIcon src={selectArrow} width={18} height={18} className="pointer-events-none absolute top-[11px] right-2 text-sand" />
      </div>
      <Message id={id} error={error} />
    </div>
  )
}

/** Nome ENS: rótulo + sufixo fixo `.eth` (no Figma o sufixo fica numa caixa ao lado). */
export function EnsField({ id, value, onChange, error }: { id: string; value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <div className="flex flex-col">
      <Label id={id} label="Nome ENS" required />
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="seunome"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-msg` : undefined}
          aria-required
          className={cn(inputBase, 'min-w-0 flex-1 border-border')}
        />
        <span className="flex h-10 w-[78px] shrink-0 items-center justify-center rounded-[3px] border border-border text-[15px] text-cream">
          .eth
        </span>
      </div>
      <Message id={id} error={error} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Provedor da carteira ("Carteira e rede")                            */
/* ------------------------------------------------------------------ */

const PROVIDER_MARK: Record<WalletProvider, string> = { walletconnect: 'W', metamask: 'M', coinbase: '' }

/**
 * Opções de provedor como rádios nativos (setas do teclado funcionam). Desktop: caixas com borda
 * (a escolhida em cobre); mobile: cartões com o selo redondo e o rádio à direita.
 */
export function ProviderOptions({ name, value, onChange, variant }: { name: string; value: WalletProvider; onChange: (value: WalletProvider) => void; variant: 'desktop' | 'mobile' }) {
  return (
    <fieldset className={cn('flex flex-col', variant === 'desktop' ? 'gap-4' : 'gap-4')}>
      <legend className={cn('mb-4 w-full font-bold text-cream', variant === 'desktop' ? 'mb-5 text-center text-[17px] leading-4' : 'text-base leading-4')}>
        Carteira e rede
      </legend>
      {providerOptions.map((option) => {
        const checked = option.value === value
        return (
          <label
            key={option.value}
            className={cn(
              'relative flex cursor-pointer items-center has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-copper-light',
              variant === 'desktop'
                ? cn('h-[45px] gap-2.5 rounded-[3px] border px-3', checked ? 'border-copper' : 'border-border')
                : 'h-[65px] gap-3 rounded-[15px] bg-surface-card pr-4 pl-3.5 shadow-[0_0_20px_rgba(10,6,4,0.45)]',
            )}
          >
            <input type="radio" name={name} value={option.value} checked={checked} onChange={() => onChange(option.value)} className="sr-only" />
            {variant === 'desktop' ? (
              <>
                <img src={checked ? radioOn : radioOffCopper} alt="" width={16} height={16} />
                <span className="text-[15px] text-cream">{option.label}</span>
              </>
            ) : (
              <>
                <span className="relative grid size-10 shrink-0 place-items-center">
                  <img src={walletBadge} alt="" width={40} height={40} className="absolute inset-0" />
                  {option.value === 'coinbase' ? (
                    <img src={walletIcon} alt="" width={20.1} height={18.58} className="relative" />
                  ) : (
                    <span aria-hidden className="relative text-sm font-bold text-copper-light">
                      {PROVIDER_MARK[option.value]}
                    </span>
                  )}
                </span>
                <span className="flex-1 text-sm leading-4 text-cream">{option.label}</span>
                <img src={checked ? radioOn : radioOff} alt="" width={16} height={16} />
              </>
            )}
          </label>
        )
      })}
    </fieldset>
  )
}

/* ------------------------------------------------------------------ */
/* Carteiras cadastradas (mobile: cartões Reserva / Principal)         */
/* ------------------------------------------------------------------ */

export function WalletCards({ wallets, value, onChange }: { wallets: Wallet[]; value: string; onChange: (wallet: Wallet) => void }) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="sr-only">Carteira usada no pagamento</legend>
      {wallets.map((wallet) => {
        const checked = wallet.slot === value
        const summary = walletSummary(wallet)
        return (
          <div key={wallet.id} className="relative">
            <label
              className={cn(
                'flex min-h-[93px] cursor-pointer items-center gap-4 rounded-[14px] bg-surface-card py-4 pr-12 pl-[19px] has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-copper-light',
                checked && 'shadow-[0_20px_20px_rgba(10,6,4,0.45)]',
              )}
            >
              <input type="radio" name="wallet-slot" value={wallet.slot} checked={checked} onChange={() => onChange(wallet)} className="sr-only" />
              <img src={checked ? radioOn : radioOff} alt="" width={16} height={16} />
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="text-base leading-4 font-bold text-cream">{wallet.nickname}</span>
                <span className="text-sm leading-[22px] text-sand-light">
                  <span className="block truncate">{summary.id}</span>
                  <span className="block">
                    {summary.network} · {wallet.connection === 'connected' ? 'conectada' : 'desconectada'}
                  </span>
                </span>
              </span>
            </label>
            <Link
              to="/carteiras"
              aria-label={`Editar a carteira ${wallet.nickname}`}
              className={cn('absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full', focusRing)}
            >
              <img src={kebab} alt="" width={3} height={15} />
            </Link>
          </div>
        )
      })}
    </fieldset>
  )
}
