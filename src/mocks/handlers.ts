import { delay, HttpResponse, RequestHandler, type DefaultBodyType, type PathParams, type StrictRequest } from 'msw'
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

    const response = await serialized(async () => {
      const db = store.get()
      orders.resolveDue(db)
      try {
        const result = await resolver({ db, request, params, url: new URL(request.url) })
        store.persist()
        // Perda de resposta depois de gravar: falha de rede imediata, distinta do timeout abaixo.
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
    // A transação já terminou. Atrasar a resposta fora da fila permite que o retry encontre
    // o pedido persistido enquanto a primeira requisição expira no Axios (10 s).
    if (plan.failure === 'timeout-after-commit' && response.ok) await delay(TIMEOUT_DELAY_MS)
    // Resposta calculada antes de uma mudança e entregue depois (corrida REST × Socket.IO).
    await network.holdIfPlanned(route)
    return response
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

interface Route {
  method: string
  segments: string[]
  handle: ReturnType<typeof endpoint>
}
const route = (method: string, path: string, name: string, resolver: Resolver): Route => ({
  method,
  segments: path.split('/').filter(Boolean),
  handle: endpoint(name, resolver),
})

const routes: Route[] = [
  // Sessão e conta
  route('POST', '/auth/register', 'auth.register', async ({ db, request }) => ({
    status: 201,
    body: await auth.register(db, validate(registerRequest, await readJson(request)), guestId(request)),
  })),
  route('POST', '/auth/login', 'auth.login', async ({ db, request }) => ({
    body: await auth.login(db, validate(loginRequest, await readJson(request)), guestId(request)),
  })),
  route('GET', '/auth/session', 'auth.session', ({ db, request }) => {
    const { user, session } = auth.requireUser(db, authHeader(request))
    return { body: { expiresAt: session.expiresAt, user: auth.publicUser(user) } }
  }),
  route('POST', '/auth/logout', 'auth.logout', ({ db, request }) => {
    const token = authHeader(request)?.replace(/^Bearer\s+/i, '')
    if (token) auth.logout(db, token)
    return { status: 204, body: null }
  }),

  // Catálogo
  route('GET', '/nfts', 'nfts.list', ({ db, url }) => ({
    body: catalog.listNfts(db, catalog.parseListQuery(url.searchParams), { empty: network.scenario === 'empty' }),
  })),
  route('GET', '/nfts/featured', 'nfts.featured', ({ db }) => ({ body: catalog.featuredNfts(db) })),
  route('GET', '/nfts/:id', 'nfts.detail', ({ db, params }) => ({ body: catalog.detail(catalog.findNft(db, param(params, 'id'))) })),
  route('GET', '/nfts/:id/related', 'nfts.related', ({ db, params }) => ({ body: catalog.relatedNfts(db, param(params, 'id')) })),

  // Favoritos
  route('GET', '/favorites', 'favorites.list', ({ db, request }) => ({
    body: account.favorites(db, auth.requireUser(db, authHeader(request)).user.id),
  })),
  route('PUT', '/favorites/:nftId', 'favorites.add', ({ db, request, params }) => ({
    body: account.setFavorite(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'nftId'), true),
  })),
  route('DELETE', '/favorites/:nftId', 'favorites.remove', ({ db, request, params }) => ({
    body: account.setFavorite(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'nftId'), false),
  })),

  // Carrinho e cotação
  route('GET', '/cart', 'cart.get', ({ db, request }) => ({
    body: cartDomain.viewCart(db, cartDomain.getCart(db, cartOwner(db, request))),
  })),
  route('POST', '/cart/items', 'cart.add', async ({ db, request }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.addItem(db, cart, validate(addCartItemRequest, await readJson(request)))
    return { body: cartDomain.viewCart(db, cart) }
  }),
  route('PATCH', '/cart/items/:lineId', 'cart.update', async ({ db, request, params }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.updateItem(db, cart, param(params, 'lineId'), validate(updateCartItemRequest, await readJson(request)).quantity)
    return { body: cartDomain.viewCart(db, cart) }
  }),
  route('DELETE', '/cart/items/:lineId', 'cart.remove', ({ db, request, params }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.removeItem(cart, param(params, 'lineId'))
    return { body: cartDomain.viewCart(db, cart) }
  }),
  route('PUT', '/cart/coupon', 'cart.coupon.apply', async ({ db, request }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.applyCoupon(db, cart, validate(applyCouponRequest, await readJson(request)).code)
    return { body: cartDomain.viewCart(db, cart) }
  }),
  route('DELETE', '/cart/coupon', 'cart.coupon.remove', ({ db, request }) => {
    const cart = cartDomain.getCart(db, cartOwner(db, request))
    cartDomain.removeCoupon(cart)
    return { body: cartDomain.viewCart(db, cart) }
  }),
  route('GET', '/cart/quote', 'cart.quote', ({ db, request, url }) => {
    const owner = cartOwner(db, request)
    const networkId = validate(paymentNetwork, url.searchParams.get('network') ?? 'ethereum')
    const sinceId = url.searchParams.get('since')
    const since = sinceId ? db.quotes[sinceId] : null
    const quote = computeQuote(db, cartDomain.getCart(db, owner), networkId, since?.ownerId === owner ? since : null)
    return { body: publicQuote(issueQuote(db, quote)) }
  }),

  // Pedidos
  route('POST', '/orders', 'orders.create', async ({ db, request }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    const result = orders.createOrder(db, user, request.headers.get(IDEMPOTENCY_HEADER), await readJson(request))
    return { status: result.created ? 201 : 200, body: result.order }
  }),
  route('GET', '/orders', 'orders.list', ({ db, request }) => ({
    body: { items: orders.pendingOrders(db, auth.requireUser(db, authHeader(request)).user.id) },
  })),
  route('GET', '/orders/:id', 'orders.get', ({ db, request, params }) => ({
    body: orders.viewOrder(orders.findOrder(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'id'))),
  })),

  // Perfil
  route('GET', '/profile', 'profile.get', ({ db, request }) => ({
    body: account.viewProfile(auth.requireUser(db, authHeader(request)).user),
  })),
  route('PUT', '/profile', 'profile.update', async ({ db, request }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    account.updateProfile(db, user, validate(updateProfileRequest, await readJson(request)))
    return { body: account.viewProfile(user) }
  }),
  route('PUT', '/profile/avatar', 'profile.avatar', async ({ db, request }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    account.updateAvatar(user, validate(updateAvatarRequest, await readJson(request)).avatarUrl)
    return { body: account.viewProfile(user) }
  }),
  route('PUT', '/profile/password', 'profile.password', async ({ db, request }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    await account.changePassword(user, validate(changePasswordRequest, await readJson(request)))
    return { status: 204, body: null }
  }),

  // Carteiras
  route('GET', '/wallets', 'wallets.list', ({ db, request }) => ({
    body: account.listWallets(db, auth.requireUser(db, authHeader(request)).user.id),
  })),
  route('PUT', '/wallets/:slot', 'wallets.save', async ({ db, request, params }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    const slot = validate(walletSlot, param(params, 'slot'))
    return { body: account.saveWallet(db, user.id, slot, validate(saveWalletRequest, await readJson(request))) }
  }),
  route('DELETE', '/wallets/:slot', 'wallets.remove', ({ db, request, params }) => {
    const { user } = auth.requireUser(db, authHeader(request))
    return { body: account.removeWallet(db, user.id, validate(walletSlot, param(params, 'slot'))) }
  }),
  route('POST', '/wallets/:id/connect', 'wallets.connect', ({ db, request, params }) => ({
    body: account.connectWallet(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'id')),
  })),
  route('POST', '/wallets/:id/disconnect', 'wallets.disconnect', ({ db, request, params }) => ({
    body: account.disconnectWallet(db, auth.requireUser(db, authHeader(request)).user.id, param(params, 'id')),
  })),

]

// Rota desconhecida da API: 404 no formato do contrato (não deixa a requisição vazar para a rede).
const notFound = endpoint('unknown', () => {
  throw new MockError('NOT_FOUND', 'Rota da API inexistente.')
})

const API_URL = new URL(API || '/', location.origin)
const API_PATH = API_URL.pathname.replace(/\/$/, '')

/** Parâmetros da rota (`:nome`, decodificados) quando método e caminho casam; senão `null`. */
function matchRoute(candidate: Route, method: string, segments: string[]): PathParams | null {
  if (candidate.method !== method || candidate.segments.length !== segments.length) return null
  const params: Record<string, string> = {}
  for (const [index, expected] of candidate.segments.entries()) {
    const actual = segments[index]!
    if (expected.startsWith(':')) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual)
      } catch {
        return null
      }
    } else if (expected !== actual) return null
  }
  return params
}

/**
 * Handler MSW único para toda a API, com o roteamento feito aqui (a primeira rota que casar
 * responde, na ordem de `routes`).
 *
 * Motivo (perfil da carga inicial): o service worker do MSW repassa à página toda requisição
 * — inclusive imagens, fontes e chunks — e o `http.*` do MSW lê os cookies (tough-cookie +
 * tldts) de cada requisição em cada handler testado, antes mesmo de comparar o caminho. Com
 * ~30 handlers isso eram dezenas de leituras de cookie por requisição na thread principal,
 * competindo com a renderização. Os resolvers daqui não usam cookies: autenticação é pelo
 * cabeçalho `Authorization` e o carrinho de visitante pelo `X-Guest-Cart`.
 */
class ApiHandler extends RequestHandler<{ header: string }> {
  constructor() {
    super({
      info: { header: `${API}/*` },
      resolver: ({ request }) => {
        const segments = new URL(request.url).pathname.slice(API_PATH.length).split('/').filter(Boolean)
        for (const candidate of routes) {
          const params = matchRoute(candidate, request.method, segments)
          if (params) return candidate.handle({ request, params })
        }
        return notFound({ request, params: {} })
      },
    })
  }

  predicate({ request }: { request: Request }) {
    const url = new URL(request.url)
    return url.origin === API_URL.origin && (url.pathname === API_PATH || url.pathname.startsWith(`${API_PATH}/`))
  }

  log({ request, response }: { request: Request; response: Response }) {
    if (import.meta.env.PROD) return
    console.log(`[MSW] ${request.method} ${new URL(request.url).pathname} (${response.status})`)
  }
}

export const handlers = [new ApiHandler()]
