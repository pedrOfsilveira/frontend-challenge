import { beforeEach, describe, expect, it } from 'vitest'
import { store } from '../db/store'
import type { Db, DbUser } from '../db/types'
import { MockError } from '../lib'
import { connectWallet } from './account'
import { addItem, getCart } from './cart'
import { changeEdition, findNft } from './catalog'
import { createOrder, settleOrder } from './orders'
import { computeQuote, issueQuote } from './quote'

const NFT = 'emerald-ape-042'
const EDITION = 'emerald-ape-042-1-50'

let db: Db
let nova: DbUser

function checkoutBody(quoteId: string) {
  return {
    quoteId,
    walletId: 'wallet_user_nova_primary',
    note: null,
    collector: {
      displayName: 'Nova Sato', username: 'nova.sato', network: 'ethereum', profileName: 'nova',
      address: '0x7a42c9d1e8b3f40a6c2d9e1b7f3a8c4d2e6b19e8', secondaryAddressOrEns: null, provider: 'metamask',
      referralCode: 'NOVA2026', email: 'nova@kurio.dev', ensName: 'nova.kurio.eth',
    },
  }
}

function quoteNow() {
  return issueQuote(db, computeQuote(db, getCart(db, nova.id), 'ethereum')).id
}

const available = () => findNft(db, NFT).editions.find((e) => e.id === EDITION)!.available

beforeEach(async () => {
  await store.reset()
  db = store.get()
  db.settings.paymentOutcome = 'hold'
  nova = db.users.find((u) => u.id === 'user_nova')!
  connectWallet(db, nova.id, 'wallet_user_nova_primary')
  addItem(db, getCart(db, nova.id), { nftId: NFT, editionId: EDITION, quantity: 3 })
})

describe('pedido', () => {
  it('mesma chave e mesmo corpo devolvem o mesmo pedido; outro corpo gera conflito', () => {
    const body = checkoutBody(quoteNow())
    const first = createOrder(db, nova, 'chave-de-teste-0001', body)
    const retry = createOrder(db, nova, 'chave-de-teste-0001', structuredClone(body))
    expect(first.created).toBe(true)
    expect(retry).toEqual({ order: first.order, created: false })
    expect(() => createOrder(db, nova, 'chave-de-teste-0001', { ...body, note: 'outro' })).toThrow(
      expect.objectContaining({ code: 'IDEMPOTENCY_CONFLICT' }) as MockError,
    )
  })

  it('recusa cotação desatualizada e devolve a nova com a mudança de preço', () => {
    const quoteId = quoteNow()
    changeEdition(db, NFT, EDITION, { priceEth: '2' })
    try {
      createOrder(db, nova, 'chave-de-teste-0002', checkoutBody(quoteId))
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(MockError)
      const { code, details } = error as MockError
      expect(code).toBe('QUOTE_OUTDATED')
      expect((details as { quote: { issues: unknown[]; totalEth: string } }).quote.issues).toContainEqual(
        expect.objectContaining({ type: 'price_changed', fromEth: '1.19', toEth: '2' }),
      )
    }
  })

  it('reserva o estoque e, ao confirmar, remove do carrinho só o que foi comprado', () => {
    const before = available()
    const { order } = createOrder(db, nova, 'chave-de-teste-0003', checkoutBody(quoteNow()))
    expect(available()).toBe(before - 3)
    // Durante o pedido pendente o usuário adiciona mais uma unidade.
    getCart(db, nova.id).items[0]!.quantity += 1
    settleOrder(db, db.orders.find((o) => o.id === order.id)!, 'confirm')
    expect(getCart(db, nova.id).items).toEqual([expect.objectContaining({ nftId: NFT, quantity: 1 })])
    expect(available()).toBe(before - 3)
  })

  it('recusa devolve a reserva, mantém o carrinho e o estado final não muda mais', () => {
    const before = available()
    const { order } = createOrder(db, nova, 'chave-de-teste-0004', checkoutBody(quoteNow()))
    const stored = db.orders.find((o) => o.id === order.id)!
    expect(settleOrder(db, stored, 'decline')).toBe(true)
    expect(available()).toBe(before)
    expect(getCart(db, nova.id).items[0]!.quantity).toBe(3)
    expect(settleOrder(db, stored, 'confirm')).toBe(false)
    expect(stored.status).toBe('declined')
  })

  it('impede um segundo pedido enquanto há um pendente', () => {
    createOrder(db, nova, 'chave-de-teste-0005', checkoutBody(quoteNow()))
    expect(() => createOrder(db, nova, 'chave-de-teste-0006', checkoutBody(quoteNow()))).toThrow(
      expect.objectContaining({ code: 'ORDER_PENDING' }) as MockError,
    )
  })
})
