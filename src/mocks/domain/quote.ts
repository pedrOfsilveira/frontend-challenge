import type { PaymentNetwork, Quote, QuoteIssue, QuoteLine } from '@/api/contracts'
import { eth } from '@/lib/eth'
import type { Db, DbCart, DbQuote } from '../db/types'
import { canonicalJson, hash, nowIso } from '../lib'
import { checkCoupon } from './cart'

export const NETWORK_FEES: Record<PaymentNetwork, string> = { ethereum: '0.016', polygon: '0.002' }
export const QUOTE_TTL_MS = 10 * 60_000

/**
 * Monta a cotação atual do carrinho. Não altera o carrinho: ajustes (esgotado, quantidade reduzida,
 * cupom inválido) aparecem em `issues` e o usuário decide. `since` compara com uma cotação anterior
 * para apontar mudanças de preço.
 */
export function computeQuote(db: Db, cart: DbCart, network: PaymentNetwork, since?: DbQuote | null): DbQuote {
  const issues: QuoteIssue[] = []
  const lines: QuoteLine[] = []
  for (const item of cart.items) {
    const nft = db.nfts.find((n) => n.id === item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) continue
    if (edition.available === 0) {
      issues.push({ type: 'sold_out', nftId: nft.id, editionId: edition.id })
      continue
    }
    const quantity = Math.min(item.quantity, edition.available)
    if (quantity < item.quantity) issues.push({ type: 'quantity_reduced', nftId: nft.id, editionId: edition.id, from: item.quantity, to: quantity })
    const previous = since?.lines.find((l) => l.nftId === nft.id && l.editionId === edition.id)
    if (previous && previous.unitPriceEth !== edition.priceEth) {
      issues.push({ type: 'price_changed', nftId: nft.id, editionId: edition.id, fromEth: previous.unitPriceEth, toEth: edition.priceEth })
    }
    lines.push({
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      quantity,
      unitPriceEth: edition.priceEth,
      lineTotalEth: eth.times(edition.priceEth, quantity),
    })
  }

  const subtotalEth = eth.add(...lines.map((l) => l.lineTotalEth))
  let discountEth = '0'
  let coupon: Quote['coupon'] = null
  if (cart.couponCode) {
    const check = checkCoupon(db, cart.couponCode, subtotalEth)
    if (check.ok) {
      discountEth = check.discountEth
      coupon = { code: check.coupon.code, label: check.coupon.label }
    } else {
      issues.push({ type: 'coupon_removed', code: cart.couponCode, reason: check.reason })
    }
  }
  const networkFeeEth = lines.length ? NETWORK_FEES[network] : '0'
  const totalEth = eth.add(eth.minus(subtotalEth, discountEth), networkFeeEth)

  const priced = { cartId: cart.id, cartVersion: cart.version, network, lines, subtotalEth, discountEth, networkFeeEth, totalEth, coupon }
  const id = `q_${hash(canonicalJson(priced))}${hash(cart.id + network)}`
  const issuedAt = nowIso()
  return {
    ...priced,
    id,
    ownerId: cart.ownerId,
    issues,
    issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + QUOTE_TTL_MS).toISOString(),
  }
}

/** Registra a cotação emitida; reemitir a mesma cotação renova a validade. */
export function issueQuote(db: Db, quote: DbQuote) {
  db.quotes[quote.id] = quote
  // Limpa cotações vencidas para o estado persistido não crescer sem limite.
  for (const [id, stored] of Object.entries(db.quotes)) {
    if (Date.parse(stored.expiresAt) < Date.now() - QUOTE_TTL_MS) delete db.quotes[id]
  }
  return quote
}

export function publicQuote({ ownerId: _ownerId, ...quote }: DbQuote): Quote {
  return quote
}
