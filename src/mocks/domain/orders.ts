import { createOrderRequest, idempotencyKey, type Order } from '@/api/contracts'
import type { Db, DbOrder, DbUser } from '../db/types'
import { store } from '../db/store'
import { mockEvents, orderUpdated } from '../events'
import { canonicalJson, MockError, nowIso, randomHex, validate } from '../lib'
import { ownWallet } from './account'
import { getCart } from './cart'
import { changeEdition, findEdition, findNft } from './catalog'
import { computeQuote, issueQuote, publicQuote } from './quote'

const EXPLORERS = {
  ethereum: 'https://sepolia.etherscan.io/tx/',
  polygon: 'https://amoy.polygonscan.com/tx/',
} as const

export function viewOrder({ idempotency: _i, cartId: _c, resolveAt: _r, outcome: _o, ...order }: DbOrder): Order {
  return order
}

export function findOrder(db: Db, userId: string, orderId: string) {
  const order = db.orders.find((o) => o.id === orderId)
  // Pedido de outro usuário responde 404: não revela que existe.
  if (!order || order.userId !== userId) throw new MockError('NOT_FOUND', 'Pedido não encontrado.')
  return order
}

export function pendingOrders(db: Db, userId: string) {
  return db.orders.filter((o) => o.userId === userId && o.status === 'pending').map(viewOrder)
}

export interface CreateOrderResult {
  order: Order
  created: boolean
}

/**
 * Criação idempotente. A chave tem escopo por usuário e é comparada com a impressão digital
 * canônica do corpo: mesma chave + mesmo corpo = o mesmo pedido (inclusive depois de resposta
 * perdida); mesma chave + outro corpo = 409.
 */
export function createOrder(db: Db, user: DbUser, key: string | null, body: unknown): CreateOrderResult {
  if (!key || !idempotencyKey.safeParse(key).success) {
    throw new MockError('VALIDATION_FAILED', 'Envie o cabeçalho Idempotency-Key (16 a 128 caracteres).')
  }
  const scopedKey = `${user.id}:${key}`
  const fingerprint = canonicalJson(body)
  const previous = db.orders.find((o) => o.idempotency.scopedKey === scopedKey)
  if (previous) {
    if (previous.idempotency.fingerprint !== fingerprint) {
      throw new MockError('IDEMPOTENCY_CONFLICT', 'Esta tentativa de compra já foi usada com outros dados. Revise e confirme de novo.')
    }
    return { order: viewOrder(previous), created: false }
  }

  const input = validate(createOrderRequest, body)
  const cart = getCart(db, user.id)

  const pending = db.orders.find((o) => o.userId === user.id && o.status === 'pending')
  if (pending) {
    throw new MockError('ORDER_PENDING', 'Você já tem um pedido em processamento. Aguarde o resultado.', { details: { orderId: pending.id } })
  }

  const wallet = ownWallet(db, user.id, input.walletId)
  if (wallet.connection !== 'connected') {
    throw new MockError('WALLET_DISCONNECTED', 'Conecte a carteira selecionada antes de confirmar.')
  }

  // Revalidação: a cotação confirmada precisa ser exatamente a atual (preço, estoque, cupom, taxa).
  const submitted = db.quotes[input.quoteId]
  if (!submitted || submitted.ownerId !== user.id) {
    throw new MockError('QUOTE_OUTDATED', 'A cotação não é mais válida. Revise os valores atualizados.', {
      details: { quote: publicQuote(issueQuote(db, computeQuote(db, cart, wallet.network))) },
    })
  }
  const fresh = computeQuote(db, cart, submitted.network, submitted)
  const expired = Date.parse(submitted.expiresAt) <= Date.now()
  // Ajustes que o usuário já viu (ex.: quantidade reduzida) fazem parte da cotação e do id;
  // só bloqueia se algo mudou desde a cotação confirmada.
  if (expired || fresh.id !== submitted.id || fresh.lines.length === 0) {
    throw new MockError('QUOTE_OUTDATED', expired ? 'A cotação expirou. Confira os valores e confirme de novo.' : 'Preço, disponibilidade ou cupom mudaram. Revise e confirme de novo.', {
      details: { quote: publicQuote(issueQuote(db, fresh)) },
    })
  }
  if (wallet.network !== submitted.network) {
    throw new MockError('VALIDATION_FAILED', 'A carteira selecionada não opera na rede da cotação.', { fields: { walletId: 'Escolha uma carteira na mesma rede.' } })
  }

  const now = nowIso()
  const order: DbOrder = {
    id: store.nextId('order'),
    userId: user.id,
    status: 'pending',
    version: 1,
    lines: fresh.lines,
    subtotalEth: fresh.subtotalEth,
    discountEth: fresh.discountEth,
    networkFeeEth: fresh.networkFeeEth,
    totalEth: fresh.totalEth,
    couponCode: fresh.coupon?.code ?? null,
    network: fresh.network,
    wallet: { id: wallet.id, provider: wallet.provider, address: wallet.address, nickname: wallet.nickname },
    collector: input.collector,
    note: input.note,
    transaction: null,
    declineReason: null,
    createdAt: now,
    updatedAt: now,
    idempotency: { scopedKey, fingerprint },
    cartId: cart.id,
    resolveAt: db.settings.paymentOutcome === 'hold' ? null : Date.now() + db.settings.paymentDelayMs,
    outcome: db.settings.paymentOutcome,
  }
  db.orders.push(order)
  // Reserva as unidades enquanto o pagamento está pendente: a mesma edição não é vendida duas vezes.
  for (const line of order.lines) {
    const edition = findEdition(findNft(db, line.nftId), line.editionId)
    changeEdition(db, line.nftId, line.editionId, { available: edition.available - line.quantity })
  }
  return { order: viewOrder(order), created: true }
}

/** Tira do carrinho exatamente o que foi comprado; o que foi adicionado depois continua lá. */
function removePurchased(db: Db, order: DbOrder) {
  const cart = db.carts.find((c) => c.id === order.cartId)
  if (!cart) return
  for (const line of order.lines) {
    const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
    if (item) item.quantity -= line.quantity
  }
  cart.items = cart.items.filter((i) => i.quantity > 0)
  if (order.couponCode && cart.couponCode === order.couponCode) cart.couponCode = null
  cart.version += 1
  cart.updatedAt = nowIso()
}

/** Decide um pedido pendente. Estados finais nunca mudam: chamar de novo não faz nada. */
export function settleOrder(db: Db, order: DbOrder, outcome: 'confirm' | 'decline') {
  if (order.status !== 'pending') return false
  order.version += 1
  order.updatedAt = nowIso()
  if (outcome === 'confirm') {
    order.status = 'confirmed'
    const txHash = `0x${randomHex(32)}`
    order.transaction = { hash: txHash, explorerUrl: `${EXPLORERS[order.network]}${txHash}` }
    removePurchased(db, order)
  } else {
    order.status = 'declined'
    order.declineReason = 'O pagamento foi recusado pela carteira. Nenhum valor foi cobrado.'
    // Devolve a reserva ao estoque.
    for (const line of order.lines) {
      const nft = db.nfts.find((n) => n.id === line.nftId)
      const edition = nft?.editions.find((e) => e.id === line.editionId)
      if (nft && edition) changeEdition(db, nft.id, edition.id, { available: edition.available + line.quantity })
    }
  }
  mockEvents.publish(orderUpdated(order))
  return true
}

/** Resolve os pedidos cujo prazo chegou. Chamado pelo timer e a cada requisição (nada se perde no refresh). */
export function resolveDue(db: Db, now = Date.now()) {
  let changed = false
  for (const order of db.orders) {
    if (order.status === 'pending' && order.resolveAt !== null && order.resolveAt <= now) {
      changed = settleOrder(db, order, order.outcome === 'decline' ? 'decline' : 'confirm') || changed
    }
  }
  return changed
}

export function nextResolution(db: Db) {
  const due = db.orders.filter((o) => o.status === 'pending' && o.resolveAt !== null).map((o) => o.resolveAt!)
  return due.length ? Math.min(...due) : null
}
