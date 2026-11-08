import type { Cart, CartLine } from '@/api/contracts'
import { eth } from '@/lib/eth'
import type { Db, DbCart, DbCoupon } from '../db/types'
import { MockError, nowIso } from '../lib'
import { store } from '../db/store'
import { findEdition, findNft } from './catalog'

export const MAX_LINE_QUANTITY = 99

export function cartIdFor(ownerId: string) {
  return `cart_${ownerId}`
}

export function getCart(db: Db, ownerId: string): DbCart {
  const id = cartIdFor(ownerId)
  let cart = db.carts.find((c) => c.id === id)
  if (!cart) {
    cart = { id, ownerId, version: 1, items: [], couponCode: null, updatedAt: nowIso() }
    db.carts.push(cart)
  }
  return cart
}

function touch(cart: DbCart) {
  cart.version += 1
  cart.updatedAt = nowIso()
}

export function viewCart(db: Db, cart: DbCart): Cart {
  const items: CartLine[] = []
  for (const item of cart.items) {
    const nft = db.nfts.find((n) => n.id === item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) continue
    items.push({
      id: item.id,
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      quantity: item.quantity,
      unitPriceEth: edition.priceEth,
      available: edition.available,
    })
  }
  return { id: cart.id, version: cart.version, items, couponCode: cart.couponCode, updatedAt: cart.updatedAt }
}

function assertAvailable(db: Db, nftId: string, editionId: string, wanted: number) {
  const nft = findNft(db, nftId)
  const edition = findEdition(nft, editionId)
  if (edition.available === 0) {
    throw new MockError('EDITION_UNAVAILABLE', `A edição ${edition.label} de ${nft.name} está esgotada.`, {
      details: { nftId, editionId, available: 0 },
    })
  }
  if (wanted > edition.available) {
    throw new MockError('OUT_OF_STOCK', `Só há ${edition.available} unidade(s) disponível(is) da edição ${edition.label}.`, {
      details: { nftId, editionId, available: edition.available },
    })
  }
}

export function addItem(db: Db, cart: DbCart, input: { nftId: string; editionId: string; quantity: number }) {
  const existing = cart.items.find((i) => i.nftId === input.nftId && i.editionId === input.editionId)
  const wanted = (existing?.quantity ?? 0) + input.quantity
  if (wanted > MAX_LINE_QUANTITY) throw new MockError('VALIDATION_FAILED', `Limite de ${MAX_LINE_QUANTITY} unidades por item.`, { fields: { quantity: 'Quantidade acima do limite.' } })
  assertAvailable(db, input.nftId, input.editionId, wanted)
  if (existing) existing.quantity = wanted
  else cart.items.push({ id: store.nextId('line'), nftId: input.nftId, editionId: input.editionId, quantity: input.quantity })
  touch(cart)
}

function findLine(cart: DbCart, lineId: string) {
  const line = cart.items.find((i) => i.id === lineId)
  if (!line) throw new MockError('NOT_FOUND', 'Item não está no carrinho.')
  return line
}

export function updateItem(db: Db, cart: DbCart, lineId: string, quantity: number) {
  const line = findLine(cart, lineId)
  // Diminuir sempre pode (inclusive com estoque menor que o carrinho); aumentar respeita o disponível.
  if (quantity > line.quantity) assertAvailable(db, line.nftId, line.editionId, quantity)
  line.quantity = quantity
  touch(cart)
}

export function removeItem(cart: DbCart, lineId: string) {
  findLine(cart, lineId)
  cart.items = cart.items.filter((i) => i.id !== lineId)
  touch(cart)
}

export function subtotal(db: Db, cart: DbCart) {
  return eth.add(...viewCart(db, cart).items.map((line) => eth.times(line.unitPriceEth, line.quantity)))
}

export type CouponCheck =
  | { ok: true; coupon: DbCoupon; discountEth: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'minimum_not_met'; message: string }

export function checkCoupon(db: Db, code: string, subtotalEth: string): CouponCheck {
  const coupon = db.coupons.find((c) => c.code === code.toUpperCase())
  if (!coupon) return { ok: false, reason: 'invalid', message: 'Cupom inválido.' }
  if (Date.parse(coupon.expiresAt) <= Date.now()) return { ok: false, reason: 'expired', message: 'Este cupom expirou.' }
  if (eth.compare(subtotalEth, coupon.minSubtotalEth) < 0) {
    return { ok: false, reason: 'minimum_not_met', message: `Este cupom exige subtotal mínimo de ${eth.format(coupon.minSubtotalEth)} ETH.` }
  }
  const raw = coupon.kind === 'percent' ? eth.percent(subtotalEth, Number(coupon.value)) : coupon.value
  return { ok: true, coupon, discountEth: eth.min(raw, subtotalEth) }
}

export function applyCoupon(db: Db, cart: DbCart, code: string) {
  const result = checkCoupon(db, code, subtotal(db, cart))
  if (!result.ok) {
    throw new MockError(result.reason === 'expired' ? 'COUPON_EXPIRED' : 'COUPON_INVALID', result.message, { fields: { code: result.message } })
  }
  cart.couponCode = result.coupon.code
  touch(cart)
}

export function removeCoupon(cart: DbCart) {
  if (cart.couponCode === null) return
  cart.couponCode = null
  touch(cart)
}

/**
 * Leva os itens do visitante para o carrinho da conta, respeitando o estoque.
 * Devolve o que precisou ser reduzido, para a interface avisar.
 */
export function mergeGuestCart(db: Db, guestId: string | null, userCart: DbCart) {
  const notices: { nftId: string; editionId: string; name: string; requested: number; kept: number }[] = []
  if (!guestId) return notices
  const guest = db.carts.find((c) => c.id === cartIdFor(guestId))
  if (!guest || guest.items.length === 0) return notices
  for (const item of guest.items) {
    const nft = db.nfts.find((n) => n.id === item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) continue
    const existing = userCart.items.find((i) => i.nftId === item.nftId && i.editionId === item.editionId)
    const requested = (existing?.quantity ?? 0) + item.quantity
    const kept = Math.min(requested, edition.available, MAX_LINE_QUANTITY)
    if (kept < requested) notices.push({ nftId: nft.id, editionId: edition.id, name: `${nft.name} (${edition.label})`, requested, kept })
    if (existing) {
      if (kept === 0) userCart.items = userCart.items.filter((i) => i !== existing)
      else existing.quantity = kept
    } else if (kept > 0) {
      userCart.items.push({ id: store.nextId('line'), nftId: item.nftId, editionId: item.editionId, quantity: kept })
    }
  }
  if (!userCart.couponCode && guest.couponCode) userCart.couponCode = guest.couponCode
  db.carts = db.carts.filter((c) => c !== guest)
  touch(userCart)
  return notices
}
