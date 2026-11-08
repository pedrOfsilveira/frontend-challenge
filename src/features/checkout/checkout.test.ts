import { describe, expect, it } from 'vitest'
import type { Profile, Wallet, WalletsResponse } from '@/api/contracts'
import { initialDraft, mapApiFields, validateDraft, walletFieldsOf } from './form'
import { idempotency } from './idempotency'

const wallet = (slot: Wallet['slot'], overrides: Partial<Wallet> = {}): Wallet => ({
  id: `wallet_nova_${slot}`,
  slot,
  connection: 'disconnected',
  version: 1,
  updatedAt: '2026-11-08T12:00:00.000Z',
  displayName: 'Nova Sato',
  nickname: slot === 'primary' ? 'Principal' : 'Reserva',
  network: 'ethereum',
  profileName: 'nova',
  provider: 'metamask',
  address: '0x7a42c9d1e8b3f40a6c2d9e1b7f3a8c4d2e6b19e8',
  secondaryAddressOrEns: null,
  referralCode: 'NOVA2026',
  email: 'nova@kurio.dev',
  ensName: 'nova.kurio.eth',
  ...overrides,
})

const profile = { userId: 'user_nova', username: 'nova.sato', displayName: 'Nova Sato', email: 'nova@kurio.dev', ensName: null, nickname: null, avatarUrl: null, version: 1 } satisfies Profile

describe('formulário de pagamento', () => {
  it('preenche com a carteira principal e o usuário do perfil', () => {
    const wallets: WalletsResponse = { primary: wallet('primary'), secondary: null }
    const draft = initialDraft(wallets, profile)
    expect(draft).toMatchObject({ walletSlot: 'primary', username: 'nova.sato', ensLabel: 'nova.kurio', network: 'ethereum' })
  })

  it('sem carteira cadastrada não há formulário', () => {
    expect(initialDraft({ primary: null, secondary: null }, profile)).toBeNull()
  })

  it('valida com as regras do contrato e devolve o pedido normalizado', () => {
    const w = wallet('primary')
    const draft = { ...initialDraft({ primary: w, secondary: null }, profile)!, referralCode: 'nova2026', note: '  ' }
    const result = validateDraft(draft, w)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.collector.referralCode).toBe('NOVA2026')
      expect(result.collector.ensName).toBe('nova.kurio.eth')
      expect(result.collector.secondaryAddressOrEns).toBeNull()
      expect(result.note).toBeNull()
    }
  })

  it('aponta erros por campo, com a mensagem do rótulo ENS (sufixo fixo)', () => {
    const w = wallet('primary')
    const draft = { ...initialDraft({ primary: w, secondary: null }, profile)!, email: 'nova@', ensLabel: 'x', address: '0x123' }
    const result = validateDraft(draft, w)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['address', 'email', 'ensLabel'])
      expect(result.errors.ensLabel).not.toMatch(/\.eth/)
    }
  })

  it('recusa rede diferente da rede da carteira', () => {
    const w = wallet('primary')
    const draft = { ...initialDraft({ primary: w, secondary: null }, profile)!, network: 'polygon' as const }
    const result = validateDraft(draft, w)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.network).toMatch(/Principal/)
  })

  it('trocar de carteira troca os campos que vêm dela', () => {
    const reserva = wallet('secondary', { network: 'polygon', provider: 'walletconnect', address: '0x9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b' })
    expect(walletFieldsOf(reserva)).toMatchObject({ network: 'polygon', provider: 'walletconnect', address: reserva.address })
  })

  it('mapeia erros da API (inclusive `collector.*` e `ensName`) para os campos da tela', () => {
    expect(mapApiFields({ 'collector.email': 'E-mail inválido.', ensName: 'ENS inválido.', walletId: 'Outra rede.' })).toEqual({
      email: 'E-mail inválido.',
      ensLabel: 'ENS inválido.',
      walletId: 'Outra rede.',
    })
  })
})

describe('chave de idempotência', () => {
  const body = { quoteId: 'q_1', walletId: 'w_1', collector: { email: 'a@b.c', displayName: 'A' }, note: null }

  it('o mesmo conteúdo (em qualquer ordem de chaves) reaproveita a chave', () => {
    const key = idempotency.keyFor('user_a', body)
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/)
    expect(idempotency.keyFor('user_a', { note: null, collector: { displayName: 'A', email: 'a@b.c' }, walletId: 'w_1', quoteId: 'q_1' })).toBe(key)
  })

  it('conteúdo diferente ou outro usuário geram chave nova', () => {
    const key = idempotency.keyFor('user_a', body)
    expect(idempotency.keyFor('user_a', { ...body, quoteId: 'q_2' })).not.toBe(key)
    expect(idempotency.keyFor('user_b', body)).not.toBe(key)
  })

  it('depois de descartada (pedido criado ou conflito), a próxima tentativa usa outra chave', () => {
    const key = idempotency.keyFor('user_c', body)
    idempotency.discard('user_c', body)
    expect(idempotency.keyFor('user_c', body)).not.toBe(key)
  })
})
