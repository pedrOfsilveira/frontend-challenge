import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Cart, NftDetail, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { queryKeys, type PrivateScope } from '@/api/query-keys'
import { keepNewestVersion } from '@/lib/versioned'
import { applyRealtimeEvent, type ApplyContext, type RealtimeNotice } from './apply'
import { createLedger } from './ledger'

const NFT = 'emerald-ape-042'
const EDITION = 'emerald-ape-042-1-50'
const SCOPE: PrivateScope = 'user:user_nova'

const summary = (version: number, priceEth = '1.5', available = 10): NftSummary => ({
  id: NFT, name: 'Emerald Ape', tokenId: '42', image: '/a.webp', category: 'digital-art', network: 'ethereum',
  priceEth, compareAtPriceEth: null, available, badges: [], version,
})

const detail = (version: number): NftDetail => ({
  ...summary(version),
  images: ['/a.webp'], description: '', story: [], collection: { id: 'c', name: 'C' },
  creator: { name: 'X', royaltyBps: 500 }, contractAddress: '0x0', attributes: [],
  rating: { average: '4.5', count: 1 }, defaultEditionId: EDITION, listedAt: '2026-01-01T00:00:00.000Z',
  editions: [{ id: EDITION, label: '1/50', supply: 50, available: 10, priceEth: '1.5' }],
})

const nftEvent = (version: number, priceEth: string, available = 10): NftUpdatedEvent => ({
  id: `nft:${NFT}:v${version}`, type: 'nft.updated', resource: { type: 'nft', id: NFT }, version,
  occurredAt: '2026-01-01T00:00:00.000Z',
  data: { priceEth, available, editions: [{ id: EDITION, priceEth, available }] },
})

const cart = (): Cart => ({
  id: 'cart_1', version: 3, couponCode: null, updatedAt: '2026-01-01T00:00:00.000Z',
  items: [{ id: 'line_1', nftId: NFT, editionId: EDITION, editionLabel: '1/50', name: 'Emerald Ape', tokenId: '42',
    image: '/a.webp', quantity: 2, unitPriceEth: '1.5', available: 10 }],
})

const order = (status: Order['status'], version: number) =>
  ({ id: 'ord_1', userId: 'user_nova', status, version, transaction: null, declineReason: null, updatedAt: 'x' }) as Order

const orderEvent = (status: Order['status'], version: number, userId = 'user_nova'): OrderUpdatedEvent => ({
  id: `order:ord_1:v${version}`, type: 'order.updated', resource: { type: 'order', id: 'ord_1' }, userId, version,
  occurredAt: '2026-01-01T00:00:00.000Z',
  data: { status, transaction: status === 'confirmed' ? { hash: '0xabc', explorerUrl: 'https://x' } : null, declineReason: null },
})

let queryClient: QueryClient
let ctx: ApplyContext
let notices: RealtimeNotice[]

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { structuralSharing: keepNewestVersion } } })
  notices = []
  ctx = { queryClient, ledger: createLedger(), userId: 'user_nova', scope: SCOPE, notify: (n) => notices.push(n) }
})

describe('ledger', () => {
  it('descarta duplicata e evento antigo', () => {
    const ledger = createLedger()
    expect(ledger.admit(nftEvent(3, '2'))).toBe('apply')
    expect(ledger.admit(nftEvent(3, '2'))).toBe('duplicate')
    expect(ledger.admit(nftEvent(2, '1'))).toBe('stale')
    expect(ledger.admit(nftEvent(4, '3'), 5)).toBe('stale')
  })

  it('mantém só os últimos ids no LRU', () => {
    const ledger = createLedger({ maxEventIds: 2 })
    ledger.admit(nftEvent(1, '1'))
    ledger.admit(nftEvent(2, '1'))
    ledger.admit(nftEvent(3, '1'))
    // O id da v1 saiu do LRU, mas a versão ainda barra o evento.
    expect(ledger.admit(nftEvent(1, '1'))).toBe('stale')
  })
})

describe('nft.updated', () => {
  it('atualiza detalhe, listas e carrinho, e avisa a mudança no carrinho', () => {
    queryClient.setQueryData(queryKeys.nfts.detail(NFT), detail(1))
    queryClient.setQueryData(queryKeys.nfts.list({ page: 1 }), { items: [summary(1)] })
    queryClient.setQueryData(queryKeys.private.cart(SCOPE), cart())

    applyRealtimeEvent(nftEvent(2, '1.75', 3), ctx)

    const d = queryClient.getQueryData<NftDetail>(queryKeys.nfts.detail(NFT))
    expect(d?.priceEth).toBe('1.75')
    expect(d?.editions[0]).toMatchObject({ priceEth: '1.75', available: 3 })
    expect(queryClient.getQueryData<{ items: NftSummary[] }>(queryKeys.nfts.list({ page: 1 }))?.items[0]?.version).toBe(2)
    expect(queryClient.getQueryData<Cart>(queryKeys.private.cart(SCOPE))?.items[0]).toMatchObject({ unitPriceEth: '1.75', available: 3 })
    expect(notices).toEqual([expect.objectContaining({ kind: 'cart-line-changed', before: { priceEth: '1.5', available: 10 } })])
  })

  it('não regride quando o REST já trouxe versão mais nova, nem reaplica duplicata', () => {
    queryClient.setQueryData(queryKeys.nfts.detail(NFT), { ...detail(5), priceEth: '9' })
    queryClient.setQueryData(queryKeys.private.cart(SCOPE), { ...cart(), items: [{ ...cart().items[0], unitPriceEth: '9' }] })

    applyRealtimeEvent(nftEvent(4, '1'), ctx)
    expect(queryClient.getQueryData<NftDetail>(queryKeys.nfts.detail(NFT))?.priceEth).toBe('9')
    expect(queryClient.getQueryData<Cart>(queryKeys.private.cart(SCOPE))?.items[0]?.unitPriceEth).toBe('9')

    applyRealtimeEvent(nftEvent(6, '2'), ctx)
    applyRealtimeEvent(nftEvent(6, '2'), ctx)
    expect(notices).toHaveLength(1)
  })

  it('resposta REST antiga que chega depois do evento não sobrescreve', () => {
    queryClient.setQueryData(queryKeys.nfts.detail(NFT), detail(1))
    applyRealtimeEvent(nftEvent(2, '1.75'), ctx)
    queryClient.setQueryData(queryKeys.nfts.detail(NFT), detail(1))
    expect(queryClient.getQueryData<NftDetail>(queryKeys.nfts.detail(NFT))?.version).toBe(2)

    queryClient.setQueryData(queryKeys.nfts.list({}), { items: [summary(2, '1.75')] })
    queryClient.setQueryData(queryKeys.nfts.list({}), { items: [summary(1, '1.5')] })
    expect(queryClient.getQueryData<{ items: NftSummary[] }>(queryKeys.nfts.list({}))?.items[0]?.priceEth).toBe('1.75')
  })
})

describe('order.updated', () => {
  it('aplica a confirmação e não volta de estado terminal', () => {
    const key = queryKeys.private.order(SCOPE, 'ord_1')
    queryClient.setQueryData(key, order('pending', 1))

    applyRealtimeEvent(orderEvent('confirmed', 2), ctx)
    expect(queryClient.getQueryData<Order>(key)).toMatchObject({ status: 'confirmed', version: 2, transaction: { hash: '0xabc' } })

    applyRealtimeEvent(orderEvent('declined', 3), ctx)
    expect(queryClient.getQueryData<Order>(key)?.status).toBe('confirmed')
    expect(notices).toEqual([{ kind: 'order-status', orderId: 'ord_1', status: 'confirmed' }])
  })

  it('ignora evento de outro usuário e de visitante', () => {
    const key = queryKeys.private.order(SCOPE, 'ord_1')
    queryClient.setQueryData(key, order('pending', 1))

    applyRealtimeEvent(orderEvent('declined', 2, 'user_leo'), ctx)
    applyRealtimeEvent(orderEvent('declined', 2), { ...ctx, userId: null })
    expect(queryClient.getQueryData<Order>(key)?.status).toBe('pending')
    expect(notices).toHaveLength(0)
  })
})
