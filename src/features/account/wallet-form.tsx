import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { cn } from 'cn'
import { saveWalletRequest, type Profile, type Wallet, type WalletFields, type WalletSlot, type WalletsResponse } from '@/api/contracts'
import { walletsApi } from '@/api/endpoints'
import { isApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { SelectField, TextField, focusRing } from '@/features/checkout/fields'
import { networkOptions, providerOptions } from '@/features/checkout/form'
import { usePrivateScope } from '@/features/session/use-session'
import { accountButton, fieldErrors, focusError } from './form'
import { AccountEnsField } from './ens-field'

const fieldsOf = (wallet: WalletFields): WalletFields => saveWalletRequest.parse(wallet)
const defaults = (profile: Profile): WalletFields => ({
  displayName: profile.displayName, nickname: '', network: 'ethereum', profileName: profile.username,
  address: '', secondaryAddressOrEns: null, provider: 'metamask', referralCode: '', email: profile.email, ensName: profile.ensName ?? '',
})

export function WalletForms({ wallets, profile }: { wallets: WalletsResponse; profile: Profile }) {
  const [secondaryOpen, setSecondaryOpen] = useState(Boolean(wallets.secondary))
  const [copyPrimary, setCopyPrimary] = useState(false)
  return <div className="flex flex-col gap-8">
    <h1 className="sr-only">Carteiras</h1>
    <WalletForm slot="primary" initial={wallets.primary ?? defaults(profile)} wallet={wallets.primary} />
    <section aria-labelledby="secondary-wallet" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 id="secondary-wallet" className="text-[17px] leading-4 font-bold">Carteira secundária</h2>
        <div className="flex flex-wrap items-center gap-6">
          {wallets.primary && <label className="flex min-h-6 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={copyPrimary} onChange={(event) => { setCopyPrimary(event.target.checked); setSecondaryOpen(true) }} className="size-4 accent-copper" />Igual à carteira principal</label>}
          {!secondaryOpen && <button type="button" disabled={!wallets.primary} onClick={() => setSecondaryOpen(true)} className={cn('min-h-6 text-base font-medium text-copper-light disabled:opacity-50', focusRing)}>Adicionar</button>}
        </div>
      </div>
      {secondaryOpen ? <WalletForm key={copyPrimary ? 'copy-primary' : 'secondary'} slot="secondary" initial={copyPrimary && wallets.primary ? fieldsOf(wallets.primary) : wallets.secondary ?? defaults(profile)} wallet={wallets.secondary} onRemove={() => { setSecondaryOpen(false); setCopyPrimary(false) }} /> : <p className="text-sm leading-5 text-sand-light">{wallets.primary ? 'Você ainda não adicionou uma carteira secundária.' : 'Cadastre a carteira principal antes da secundária.'}</p>}
    </section>
  </div>
}

function WalletForm({ slot, initial, wallet, onRemove }: { slot: WalletSlot; initial: WalletFields; wallet: Wallet | null; onRemove?: () => void }) {
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const queryClient = useQueryClient()
  const key = queryKeys.private.wallets(usePrivateScope())
  const [draft, setDraft] = useState({ ...initial, secondaryAddressOrEns: initial.secondaryAddressOrEns ?? '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const save = useMutation({
    mutationFn: (body: WalletFields) => walletsApi.save(slot, body),
    onSuccess: (updated) => {
      queryClient.setQueryData<WalletsResponse>(key, (old) => old ? { ...old, [slot]: updated } : old)
      setDraft({ ...fieldsOf(updated), secondaryAddressOrEns: updated.secondaryAddressOrEns ?? '' })
      setStatus(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
    },
    onError: (error) => { if (isApiError(error)) setErrors(error.fields); focusError(form.current) },
  })
  const remove = useMutation({
    mutationFn: () => walletsApi.remove(slot),
    onSuccess: (updated) => { queryClient.setQueryData(key, updated); onRemove?.() },
  })
  const busy = save.isPending || remove.isPending
  const update = <K extends keyof typeof draft>(field: K, value: (typeof draft)[K]) => {
    setDraft((old) => ({ ...old, [field]: value }))
    setErrors((old) => ({ ...old, [field]: '' }))
    setStatus(null)
    save.reset()
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    const parsed = saveWalletRequest.safeParse({ ...draft, secondaryAddressOrEns: draft.secondaryAddressOrEns.trim() || null })
    setErrors(parsed.success ? {} : fieldErrors(parsed.error))
    if (!parsed.success) { focusError(form.current); return }
    setStatus(null)
    save.mutate(parsed.data)
  }
  const text = (field: keyof Omit<typeof draft, 'provider' | 'network'>, label: string, required = true, placeholder?: string) => <TextField id={`${id}-${field}`} label={label} required={required} value={draft[field]} onChange={(v) => update(field, v)} error={errors[field]} placeholder={placeholder} className="gap-1.5" />

  return <form ref={form} onSubmit={submit} noValidate aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} className="flex flex-col gap-8">
    {slot === 'primary' && <header className="flex flex-col gap-2"><h2 className="text-[17px] leading-4 font-bold">Carteira principal</h2><p className="text-sm leading-5 text-sand-light">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p></header>}
    <fieldset disabled={busy} className="grid min-w-0 gap-x-7 gap-y-6 md:grid-cols-2">
      <legend className="sr-only">Dados da carteira {slot === 'primary' ? 'principal' : 'secundária'}</legend>
      {text('displayName', 'Nome de exibição')}
      {text('nickname', 'Apelido da carteira')}
      <SelectField id={`${id}-network`} label="Rede" required value={draft.network} options={networkOptions} onChange={(value) => update('network', value)} error={errors.network} className="gap-1.5" />
      {text('profileName', 'Nome do perfil')}
      {text('address', 'Endereço da carteira', true, 'Endereço 0x da carteira')}
      {text('secondaryAddressOrEns', 'ENS ou carteira secundária (opcional)', false)}
      <SelectField id={`${id}-provider`} label="Tipo de carteira" required value={draft.provider} options={providerOptions} onChange={(value) => update('provider', value)} error={errors.provider} className="gap-1.5" />
      {text('referralCode', 'Código de indicação')}
      {text('email', 'E-mail')}
      <AccountEnsField id={`${id}-ensName`} value={draft.ensName} onChange={(value) => update('ensName', value)} error={errors.ensName} className="gap-1.5" />
    </fieldset>
    {status && <p role="status" className="text-sm text-copper-light">{status}</p>}
    {(save.error || remove.error) && <p role="alert" className="text-sm text-[#ff8a7a]">{save.error?.message ?? remove.error?.message}</p>}
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={busy} className={accountButton}>{save.isPending ? 'Salvando…' : 'Salvar carteira'}</button>
      {slot === 'secondary' && (wallet ? <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className={cn('min-h-10 text-sm text-sand-light', focusRing)}>Remover carteira secundária</button> : <button type="button" onClick={onRemove} className={cn('min-h-10 text-sm text-sand-light', focusRing)}>Cancelar</button>)}
    </div>
    {confirmRemove && <div role="group" aria-label="Confirmar remoção" className="flex flex-wrap items-center gap-4 rounded border border-border-soft p-4 text-sm"><p>Remover a carteira secundária? A carteira principal será preservada.</p><button type="button" disabled={busy} onClick={() => remove.mutate()} className={accountButton}>Sim, remover</button><button type="button" disabled={busy} onClick={() => setConfirmRemove(false)} className={cn('min-h-10 text-sand-light', focusRing)}>Manter carteira</button></div>}
  </form>
}
