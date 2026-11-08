import { NETWORK_LABELS } from '@/features/catalog/search'
import {
  collectorDetails,
  ensLabelRule,
  walletProviderIds,
  createOrderRequest,
  type CollectorDetails,
  type PaymentNetwork,
  type Profile,
  type Wallet,
  type WalletProvider,
  type WalletSlot,
  type WalletsResponse,
} from '@/api/contracts'

/** Estado do formulário de Pagamento: tudo string (o que está nos inputs), validado só no envio. */
export interface CheckoutDraft {
  walletSlot: WalletSlot
  network: PaymentNetwork
  provider: WalletProvider
  displayName: string
  username: string
  profileName: string
  address: string
  secondaryAddressOrEns: string
  referralCode: string
  email: string
  /** Sem o sufixo: o `.eth` é fixo ao lado do campo, como no Figma. */
  ensLabel: string
  note: string
}

export type CheckoutField = keyof CheckoutDraft
export type FieldErrors = Partial<Record<CheckoutField | 'walletId', string>>

export const PROVIDER_LABELS: Record<WalletProvider, string> = {
  walletconnect: 'WalletConnect',
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
}

const ensLabelOf = (ens: string) => ens.replace(/\.eth$/i, '')

/** Campos que vêm da carteira cadastrada (trocar de carteira troca todos eles). */
export function walletFieldsOf(wallet: Wallet): Omit<CheckoutDraft, 'walletSlot' | 'username' | 'note'> {
  return {
    network: wallet.network,
    provider: wallet.provider,
    displayName: wallet.displayName,
    profileName: wallet.profileName,
    address: wallet.address,
    secondaryAddressOrEns: wallet.secondaryAddressOrEns ?? '',
    referralCode: wallet.referralCode,
    email: wallet.email,
    ensLabel: ensLabelOf(wallet.ensName),
  }
}

export function initialDraft(wallets: WalletsResponse, profile: Profile): CheckoutDraft | null {
  const wallet = wallets.primary ?? wallets.secondary
  if (!wallet) return null
  return { walletSlot: wallet.slot, username: profile.username, note: '', ...walletFieldsOf(wallet) }
}

export function toCollector(draft: CheckoutDraft): unknown {
  return {
    displayName: draft.displayName,
    username: draft.username,
    network: draft.network,
    profileName: draft.profileName,
    address: draft.address,
    secondaryAddressOrEns: draft.secondaryAddressOrEns.trim() || null,
    provider: draft.provider,
    referralCode: draft.referralCode,
    email: draft.email,
    ensName: `${draft.ensLabel.trim()}.eth`,
  }
}

/** `ensName` do contrato vira `ensLabel` no formulário; o resto tem o mesmo nome. */
const fieldOf = (path: PropertyKey | undefined): CheckoutField | 'walletId' | null => {
  if (path === 'ensName') return 'ensLabel'
  if (typeof path !== 'string') return null
  return path as CheckoutField | 'walletId'
}

export function mapApiFields(fields: Record<string, string>): FieldErrors {
  const out: FieldErrors = {}
  for (const [path, message] of Object.entries(fields)) {
    const field = fieldOf(path.replace(/^collector\./, ''))
    if (field) out[field] = message
  }
  return out
}

/**
 * Valida com as mesmas regras do servidor (`collectorDetails`) e confere a regra que liga
 * carteira e rede. Devolve os dados prontos para o pedido ou os erros por campo.
 */
export function validateDraft(draft: CheckoutDraft, wallet: Wallet | null):
  | { ok: true; collector: CollectorDetails; note: string | null }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const parsed = collectorDetails.safeParse(toCollector(draft))
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = fieldOf(issue.path[0])
      if (field && !errors[field]) errors[field] = issue.message
    }
  }
  // O sufixo `.eth` é fixo na tela: a mensagem fala do rótulo que a pessoa digita.
  if (errors.ensLabel) errors.ensLabel = ensLabelRule.safeParse(draft.ensLabel).error?.issues[0]?.message ?? errors.ensLabel
  const note = createOrderRequest.shape.note.safeParse(draft.note.trim() || null)
  if (!note.success) errors.note = note.error.issues[0]?.message
  if (!wallet) errors.walletId = 'Cadastre uma carteira para pagar.'
  else if (wallet.network !== draft.network) {
    errors.network = `A carteira ${wallet.nickname} opera na rede ${wallet.network === 'ethereum' ? 'Ethereum' : 'Polygon'}.`
  }
  if (!parsed.success || !note.success || Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, collector: parsed.data, note: note.data }
}

/** Ordem dos campos na tela, para focar o primeiro erro. */
export const FIELD_ORDER: CheckoutField[] = [
  'displayName',
  'username',
  'network',
  'profileName',
  'address',
  'secondaryAddressOrEns',
  'provider',
  'referralCode',
  'email',
  'ensLabel',
  'note',
]

export const networkOptions = [
  { value: 'ethereum' as const, label: NETWORK_LABELS.ethereum },
  { value: 'polygon' as const, label: NETWORK_LABELS.polygon },
]
export const providerOptions = walletProviderIds.map((value) => ({ value, label: PROVIDER_LABELS[value] }))

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`.replace(/^0x(.)/, (m) => m.toUpperCase().replace('X', 'x'))

export function walletSummary(wallet: Wallet) {
  return {
    id: wallet.secondaryAddressOrEns?.endsWith('.eth') ? wallet.secondaryAddressOrEns : wallet.ensName || shortAddress(wallet.address),
    network: `Rede ${wallet.slot === 'primary' ? 'principal ' : ''}${NETWORK_LABELS[wallet.network]}`,
  }
}
