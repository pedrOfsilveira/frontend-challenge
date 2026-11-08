import { delay, http, HttpResponse, type DefaultBodyType, type PathParams, type StrictRequest } from 'msw'
import {
  addCartItemRequest,
  applyCouponRequest,
  changePasswordRequest,
  IDEMPOTENCY_HEADER,
  loginRequest,
  paymentNetwork,
  registerRequest,
  saveWalletRequest,
  updateAvatarRequest,
  updateCartItemRequest,
  updateProfileRequest,
  walletSlot,
} from '@/api/contracts'
import { GUEST_CART_HEADER } from '@/api/http'
import { store } from './db/store'
import type { Db } from './db/types'
import { MockError, validate } from './lib'
import { network, TIMEOUT_DELAY_MS } from './network'
import * as account from './domain/account'
import * as auth from './domain/auth'
import * as cartDomain from './domain/cart'
import * as catalog from './domain/catalog'
import * as orders from './domain/orders'
import { computeQuote, issueQuote, publicQuote } from './domain/quote'

const API = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
const GUEST_ID = /^guest_[0-9a-f-]{36}$/

interface Context {
  db: Db
  request: StrictRequest<DefaultBodyType>
  params: PathParams
  url: URL
}
type Result = { status?: number; body: unknown }
type Resolver = (ctx: Context) => Result | Promise<Result>

/** Fila única: requisições concorrentes não intercalam escritas no estado (como um banco serializado). */
let queue: Promise<unknown> = Promise.resolve()
export function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

/** Observadores avisados depois de cada requisição (o agendador de pagamentos usa). */
const afterRequest = new Set<() => void>()
export const onAfterRequest = (listener: () => void) => {
  afterRequest.add(listener)
  return () => afterRequest.delete(listener)
}

function endpoint(route: string, resolver: Resolver) {
  return async ({ request, params }: { request: StrictRequest<DefaultBodyType>; params: PathParams }) => {
    const plan = network.plan(route, request.method)
    if (plan.latencyMs > 0) await delay(plan.latencyMs)
    if (plan.failure === 'network') return HttpResponse.error()
    if (plan.failure === 'timeout') {
      await delay(TIMEOUT_DELAY_MS)
      return HttpResponse.error()
    }
    if (plan.failure === 'server-error') {
      return HttpResponse.json(new MockError('SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.').toBody(), { status: 503 })
    }

    return serialized(async () => {
      const db = store.get()
      orders.resolveDue(db)
      try {
        const result = await resolver({ db, request, params, url: new URL(request.url) })
        store.persist()
        // Simula "timeout depois de gravar": o servidor processou, mas a resposta se perde.
        if (plan.failure === 'after-commit') return HttpResponse.error()
        return result.status === 204 ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(result.body as never, { status: result.status ?? 200 })
      } catch (error) {
        store.persist()
        if (error instanceof MockError) return HttpResponse.json(error.toBody(), { status: error.status })
        console.error('[mocks] erro inesperado', error)
        return HttpResponse.json(new MockError('SERVICE_UNAVAILABLE', 'Erro inesperado no servidor simulado.').toBody(), { status: 503 })
      } finally {
        afterRequest.forEach((listener) => listener())
      }
    })
  }
}

const readJson = async (request: Request) => {
  try {
    return (await request.json()) as unknown
  } catch {
    return null
  }
}

const authHeader = (request: Request) => request.headers.get('Authorization')

function guestId(request: Request) {
  const value = request.headers.get(GUEST_CART_HEADER)
  return value && GUEST_ID.test(value) ? value : null
}

/** Dono do carrinho: o usuário autenticado ou o visitante identificado pelo header. */
function cartOwner(db: Db, request: Request) {
  const session = auth.authenticate(db, authHeader(request))
  if (session) return session.user.id
  const guest = guestId(request)
  if (!guest) throw new MockError('VALIDATION_FAILED', `Envie o cabeçalho ${GUEST_CART_HEADER} ou entre na sua conta.`)
  return guest
}

const param = (params: PathParams, key: string) => String(params[key] ?? '')

export const handlers = [
  // Sessão e conta
  http.post(`${API}/auth/register`, endpoint('auth.register', async ({ db, request }) => ({
    status: 201,
    body: await auth.register(db, validate(registerRequest, await readJson(request)), guestId(request)),
  }))),
  http.post(`${API}/auth/login`, endpoint('auth.login', async ({ db, request }) => ({
    body: await auth.login(db, validate(loginRequest, await readJson(request)), guestId(request)),
  }))),
  http.get(`${API}/auth/session`, endpoint('auth.session', ({ db, request }) => {
    const { user, session } = auth.requireUser(db, authHeader(request))
    return { body: { expiresAt: session.expiresAt, user: auth.publicUser(user) } }
  })),
  http.post(`${API}/auth/logout`, endpoint('auth.logout', ({ db, request }) => {
    const token = authHeader(request)?.replace(/^Bearer\s+/i, '')
    if (token) auth.logout(db, token)
    return { status: 204, body: null }
  })),

  // Catálogo
  http.get(`${API}/nfts`, endpoint('nfts.list', ({ db, url }) => ({
    body: catalog.listNfts(db, catalog.parseListQuery(url.searchParams), { empty: network.scenario === 'empty' }),
  }))),
  http.get(`${API}/nfts/featured`, endpoint('nfts.featured', ({ db }) => ({ body: catalog.featuredNfts(db) }))),
  http.get(`${API}/nfts/:id`, endpoint('nfts.detail', ({ db, params }) => ({ body: catalog.detail(catalog.findNft(db, param(params, 'id'))) }))),
  http.get(`${API}/nfts/:id/related`, endpoint('nfts.related', ({ db, params }) => ({ body: catalog.relatedNfts(db, param(params, 'id')) }))),

  // Favoritos
  http.get(`${API}/favorites`, endpoint('favorites.list', ({ db, request }) => ({
    body: account.favorites(db, auth.requireUser(db, authHeader(request)).user.id),
  }))),
  http.put(`${API}/favorites/:nftId`, endpoint('favorites.add', ({ db, request, params }) => ({
    body: account.setFavorite(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'nftId'), true),
  }))),
  http.delete(`${API}/favorites/:nftId`, endpoint('favorites.remove', ({ db, request, params }) => ({
    body: account.setFavorite(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'nftId'), false),
  }))),

  // Carrinho e cotação
  http.get(`${API}/cart`, endpoint('cart.get', ({ db, request }) => ({
    body: cartDomain.viewCart(db, cartDomain.getCart(db, cartOwner(db, request))),
  }))),
  http.post(`${API}/cart/items`, endpoint('cart.add', async ({ db, request }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.addItem(db, cart, validate(addCartItemRequest, await readJson(request)))
    return { body: cartDomain.viewCart(db, cart) }
  })),
  http.patch(`${API}/cart/items/:lineId`, endpoint('cart.update', async ({ db, request, params }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.updateItem(db, cart, param(params, 'lineId'), validate(updateCartItemRequest, await readJson(request)).quantity)
    return { body: cartDomain.viewCart(db, cart) }
  })),
  http.delete(`${API}/cart/items/:lineId`, endpoint('cart.remove', ({ db, request, params }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.removeItem(cart, param(params, 'lineId'))
    return { body: cartDomain.viewCart(db, cart) }
  })),
  http.put(`${API}/cart/coupon`, endpoint('cart.coupon.apply', async ({ db, request }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.applyCoupon(db, cart, validate(applyCouponRequest, await readJson(request)).code)
    return { body: cartDomain.viewCart(db, cart) }
  })),
  http.delete(`${API}/cart/coupon`, endpoint('cart.coupon.remove', ({ db, request }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.removeCoupon(cart)
    return { body: cartDomain.viewCart(db, cart) }
  })),
  http.get(`${API}/cart/quote`, endpoint('cart.quote', ({ db, request, url }) => {
    const owner = cartOwner(db, request)
    const networkId = validate(paymentNetwork, url.searchParams.get('network') ?? 'ethereum')
    const sinceId = url.searchParams.get('since')
    const since = sinceId ? db.quotes[sinceId] : null
    const quote = computeQuote(db, cartDomain.getCart(db, owner), networkId, since?.ownerId === owner ? since : null)
    return { body: publicQuote(issueQuote(db, quote)) }
  })),

  // Pedidos
  http.post(`${API}/orders`, endpoint('orders.create', async ({ db, request }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    const result = orders.createOrder(db, user, request.headers.get(IDEMPOTENCY_HEADER), await readJson(request))
    return { status: result.created ? 201 : 200, body: result.order }
  })),
  http.get(`${API}/orders`, endpoint('orders.list', ({ db, request }) => ({
    body: { items: orders.pendingOrders(db, auth.requireUser(db, authHeader(request)).user.id) },
  }))),
  http.get(`${API}/orders/:id`, endpoint('orders.get', ({ db, request, params }) => ({
    body: orders.viewOrder(orders.findOrder(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'id'))),
  }))),

  // Perfil
  http.get(`${API}/profile`, endpoint('profile.get', ({ db, request }) => ({
    body: account.viewProfile(auth.requireUser(db, authHeader(request)).user),
  }))),
  http.put(`${API}/profile`, endpoint('profile.update', async ({ db, request }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    account.updateProfile(db, user, validate(updateProfileRequest, await readJson(request)))
    return { body: account.viewProfile(user) }
  })),
  http.put(`${API}/profile/avatar`, endpoint('profile.avatar', async ({ db, request }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    account.updateAvatar(user, validate(updateAvatarRequest, await readJson(request)).avatarUrl)
    return { body: account.viewProfile(user) }
  })),
  http.put(`${API}/profile/password`, endpoint('profile.password', async ({ db, request }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    await account.changePassword(user, validate(changePasswordRequest, await readJson(request)))
    return { status: 204, body: null }
  })),

  // Carteiras
  http.get(`${API}/wallets`, endpoint('wallets.list', ({ db, request }) => ({
    body: account.listWallets(db, auth.requireUser(db, authHeader(request)).user.id),
  }))),
  http.put(`${API}/wallets/:slot`, endpoint('wallets.save', async ({ db, request, params }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    const slot = validate(walletSlot, param(params, 'slot'))
    return { body: account.saveWallet(db, user.id, slot, validate(saveWalletRequest, await readJson(request))) }
  })),
  http.delete(`${API}/wallets/:slot`, endpoint('wallets.remove', ({ db, request, params }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    return { body: account.removeWallet(db, user.id, validate(walletSlot, param(params, 'slot'))) }
  })),
  http.post(`${API}/wallets/:id/connect`, endpoint('wallets.connect', ({ db, request, params }) => ({
    body: account.connectWallet(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'id')),
  }))),
  http.post(`${API}/wallets/:id/disconnect`, endpoint('wallets.disconnect', ({ db, request, params }) => ({
    body: account.disconnectWallet(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'id')),
  }))),

  // Rota desconhecida da API: 404 no formato do contrato (não deixa a requisição vazar para a rede).
  http.all(`${API}/*`, endpoint('unknown', () => {
    throw new MockError('NOT_FOUND', 'Rota da API inexistente.')
  })),
]
