import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys, type PrivateScope } from '@/api/query-keys'
import { keepNewestVersion } from '@/lib/versioned'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'
import { applyRealtimeEvent, type ApplyContext } from './apply'
import { createLedger } from './ledger'
import { createRefresher, reconcileAfterConnect, type Refresher } from './refresh'

/**
 * Servidor de mentira com resposta controlada: cada requisição tira uma foto do estado na hora
 * em que é "calculada" e só chega quando o teste libera. Assim dá para ter, de propósito, uma
 * resposta em voo calculada antes de uma mudança no servidor.
 */
function fakeServer<T>(initial: T) {
  let state = initial
  const inFlight: { snapshot: T; release: () => void; fail: () => void }[] = []
  let calls = 0
  return {
    set: (next: T) => void (state = next),
    get calls() {
      return calls
    },
    queryFn: () => {
      calls += 1
      const snapshot = state
      return new Promise<T>((resolve, reject) =>
        inFlight.push({ snapshot, release: () => resolve(snapshot), fail: () => reject(new Error('503')) }),
      )
    },
    /** Entrega a resposta mais antiga em voo. */
    releaseOldest: () => inFlight.shift()?.release(),
    failOldest: () => inFlight.shift()?.fail(),
    get pending() {
      return inFlight.length
    },
  }
}

const SCOPE: PrivateScope = 'user:user_nova'
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

let queryClient: QueryClient
let refresher: Refresher
const cleanups: (() => void)[] = []

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, structuralSharing: keepNewestVersion } } })
  refresher = createRefresher(queryClient)
})
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  refresher.dispose()
  queryClient.clear()
})

/** Uma tela montada usando a query (observador ativo). */
function mount<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) {
  const observer = new QueryObserver(queryClient, { queryKey, queryFn })
  cleanups.push(observer.subscribe(() => {}))
  return observer
}

describe('createRefresher', () => {
  it('query parada e ativa: refaz já', async () => {
    const server = fakeServer({ id: 'a', version: 1 })
    const key = queryKeys.nfts.detail('a')
    const observer = mount(key, server.queryFn)
    server.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual({ id: 'a', version: 1 }))

    server.set({ id: 'a', version: 2 })
    refresher.refresh({ queryKey: key })
    expect(server.calls).toBe(2)
    server.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.version).toBe(2))
  })

  it('query parada e inativa: só marca como velha (refaz quando montar)', async () => {
    const server = fakeServer({ id: 'a', version: 1 })
    const key = queryKeys.nfts.detail('a')
    const prefetch = queryClient.prefetchQuery({ queryKey: key, queryFn: server.queryFn })
    server.releaseOldest()
    await prefetch

    refresher.refresh({ queryKey: key })
    expect(server.calls).toBe(1)
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
  })

  it('primeira carga em voo, calculada antes da mudança: refaz quando ela chegar, uma vez só', async () => {
    const server = fakeServer({ id: 'a', version: 1 })
    const key = queryKeys.nfts.detail('a')
    const observer = mount(key, server.queryFn)
    expect(server.calls).toBe(1)

    server.set({ id: 'a', version: 2 })
    refresher.refresh({ queryKey: key })
    refresher.refresh({ queryKey: key })
    // Não reaproveita nem cancela a requisição velha (a tela ficaria vazia): espera.
    expect(server.calls).toBe(1)
    expect(refresher.pending()).toBe(1)

    server.releaseOldest()
    await vi.waitFor(() => expect(server.calls).toBe(2))
    expect(observer.getCurrentResult().data?.version).toBe(1)
    server.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.version).toBe(2))
    await tick()
    expect(server.calls).toBe(2)
    expect(refresher.pending()).toBe(0)
  })

  it('refetch em voo com dados: cancela a resposta velha e pede outra', async () => {
    const server = fakeServer({ items: [{ id: 'a', version: 1, priceEth: '1' }], total: 1 })
    const key = queryKeys.nfts.list({ priceMax: '2' })
    const observer = mount(key, server.queryFn)
    server.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.total).toBe(1))

    void observer.refetch()
    expect(server.calls).toBe(2)
    // Servidor muda depois que o refetch foi calculado: o NFT sai do filtro.
    server.set({ items: [], total: 0 })
    refresher.refresh({ queryKey: key })
    expect(server.calls).toBe(3)

    server.releaseOldest() // resposta cancelada: não pode aparecer
    await tick()
    expect(observer.getCurrentResult().data?.total).toBe(1)
    server.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual({ items: [], total: 0 }))
  })

  it('em voo que falha: não insiste, só marca como velha', async () => {
    const server = fakeServer({ id: 'a', version: 1 })
    const key = queryKeys.nfts.detail('a')
    const observer = mount(key, server.queryFn)
    refresher.refresh({ queryKey: key })
    server.failOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().status).toBe('error'))
    await tick()
    expect(server.calls).toBe(1)
    expect(refresher.pending()).toBe(0)
  })

  it('query removida (logout) sai da espera; dispose para de ouvir o cache', async () => {
    const server = fakeServer({ id: 'a', version: 1 })
    const key = queryKeys.private.cart(SCOPE)
    void queryClient.prefetchQuery({ queryKey: key, queryFn: server.queryFn })
    refresher.refresh({ queryKey: key })
    expect(refresher.pending()).toBe(1)
    queryClient.removeQueries({ queryKey: queryKeys.private.all })
    expect(refresher.pending()).toBe(0)

    const other = queryKeys.nfts.detail('b')
    mount(other, server.queryFn)
    refresher.refresh({ queryKey: other })
    refresher.dispose()
    server.releaseOldest()
    server.releaseOldest()
    await tick()
    expect(server.calls).toBe(2)
  })
})

describe('reconcileAfterConnect', () => {
  it('cobre o que respondeu antes do CONNECT e o que ainda está em voo, sem tocar em recibo nem em outro escopo', async () => {
    const list = fakeServer({ items: [{ id: 'emerald', version: 1, priceEth: '1.19' }], total: 1 })
    const listKey = queryKeys.nfts.list({ q: 'Emerald', priceMax: '2', sort: 'price-asc' })
    const listObserver = mount(listKey, list.queryFn) // em voo no CONNECT

    const cart = fakeServer({ id: 'cart', version: 1 })
    const cartKey = queryKeys.private.cart(SCOPE)
    mount(cartKey, cart.queryFn)
    cart.releaseOldest()
    await vi.waitFor(() => expect(queryClient.getQueryData(cartKey)).toBeDefined())

    const receipt = fakeServer({ id: 'ord_1', version: 3, status: 'confirmed' })
    const receiptKey = queryKeys.private.order(SCOPE, 'ord_1')
    mount(receiptKey, receipt.queryFn)
    receipt.releaseOldest()
    await vi.waitFor(() => expect(queryClient.getQueryData(receiptKey)).toBeDefined())

    const leo = fakeServer({ id: 'cart_leo', version: 1 })
    const leoKey = queryKeys.private.cart('user:user_leo')
    mount(leoKey, leo.queryFn)
    leo.releaseOldest()
    await vi.waitFor(() => expect(queryClient.getQueryData(leoKey)).toBeDefined())

    // O evento desta mudança se perdeu (aconteceu antes do CONNECT).
    list.set({ items: [], total: 0 })
    reconcileAfterConnect(refresher, SCOPE)

    expect(cart.calls).toBe(2)
    expect(receipt.calls).toBe(1)
    expect(leo.calls).toBe(1)
    expect(list.calls).toBe(1)
    list.releaseOldest() // a resposta velha chega depois do CONNECT
    await vi.waitFor(() => expect(list.calls).toBe(2))
    list.releaseOldest()
    await vi.waitFor(() => expect(listObserver.getCurrentResult().data).toEqual({ items: [], total: 0 }))
  })
})

const nftEvent = (id: string, version: number, priceEth: string): NftUpdatedEvent => ({
  id: `nft:${id}:v${version}`, type: 'nft.updated', resource: { type: 'nft', id }, version, occurredAt: '2026-01-01T00:00:00.000Z',
  data: { priceEth, available: 1, editions: [{ id: `${id}-1`, priceEth, available: 1 }] },
})
const orderEvent = (status: 'confirmed' | 'declined', version: number, userId = 'user_nova'): OrderUpdatedEvent => ({
  id: `order:ord_1:v${version}`, type: 'order.updated', resource: { type: 'order', id: 'ord_1' }, userId, version,
  occurredAt: '2026-01-01T00:00:00.000Z', data: { status, transaction: null, declineReason: null },
})

describe('applyRealtimeEvent com o REST', () => {
  const context = (overrides: Partial<ApplyContext> = {}): ApplyContext => ({
    queryClient, ledger: createLedger(), userId: 'user_nova', scope: SCOPE, notify: () => {},
    refresh: (filters) => refresher.refresh(filters), ...overrides,
  })

  it('nft.updated refaz a listagem ativa mesmo sem o NFT nela (ordenação traz ele para a página)', async () => {
    const list = fakeServer({ items: [{ id: 'golden', version: 1, priceEth: '0.39' }], total: 48 })
    const key = queryKeys.nfts.list({ sort: 'price-asc', page: 1 })
    const observer = mount(key, list.queryFn)
    list.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.total).toBe(48))

    list.set({ items: [{ id: 'ivory', version: 2, priceEth: '0.1' }], total: 48 })
    applyRealtimeEvent(nftEvent('ivory', 2, '0.1'), context())
    expect(list.calls).toBe(2)
    list.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.items[0]?.id).toBe('ivory'))
  })

  it('nft.updated com o detalhe ainda carregando: a resposta de antes do evento não fica valendo', async () => {
    const detail = fakeServer({ id: 'emerald', version: 1, priceEth: '1.19' })
    const key = queryKeys.nfts.detail('emerald')
    const observer = mount(key, detail.queryFn)

    detail.set({ id: 'emerald', version: 2, priceEth: '99' })
    applyRealtimeEvent(nftEvent('emerald', 2, '99'), context())
    detail.releaseOldest()
    await vi.waitFor(() => expect(detail.calls).toBe(2))
    detail.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.priceEth).toBe('99'))
  })

  it('nft.updated com o carrinho em voo: pede o carrinho de novo (a versão dele não muda com o preço)', async () => {
    const line = (unitPriceEth: string) => ({ id: 'line_1', nftId: 'emerald', editionId: 'emerald-1', unitPriceEth, available: 1, quantity: 1 })
    const cart = fakeServer({ id: 'cart_1', version: 3, items: [line('1.19')] })
    const key = queryKeys.private.cart(SCOPE)
    const observer = mount(key, cart.queryFn)
    cart.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toBeDefined())
    void observer.refetch() // calculado antes do evento

    cart.set({ id: 'cart_1', version: 3, items: [line('99')] })
    applyRealtimeEvent(nftEvent('emerald', 2, '99'), context())
    expect(cart.calls).toBe(3)
    cart.releaseOldest()
    await tick()
    expect(observer.getCurrentResult().data?.items[0]?.unitPriceEth).toBe('99')
    cart.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false))
    expect(observer.getCurrentResult().data?.items[0]?.unitPriceEth).toBe('99')
  })

  it('order.updated com a tela do pedido carregando: refaz assim que a resposta pendente chega, sem esperar o polling', async () => {
    const order = fakeServer({ id: 'ord_1', userId: 'user_nova', version: 1, status: 'pending' as string })
    const key = queryKeys.private.order(SCOPE, 'ord_1')
    const observer = mount(key, order.queryFn)

    order.set({ id: 'ord_1', userId: 'user_nova', version: 2, status: 'confirmed' })
    applyRealtimeEvent(orderEvent('confirmed', 2), context())
    order.releaseOldest()
    await vi.waitFor(() => expect(order.calls).toBe(2))
    order.releaseOldest()
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.status).toBe('confirmed'))
  })

  it('duplicata, evento antigo e pedido de outra conta não pedem nada ao REST', () => {
    const refresh = vi.fn()
    const ctx = context({ refresh })
    queryClient.setQueryData(queryKeys.nfts.detail('emerald'), { id: 'emerald', version: 5, editions: [] })
    applyRealtimeEvent(nftEvent('emerald', 4, '1'), ctx)
    expect(refresh).not.toHaveBeenCalled()

    applyRealtimeEvent(nftEvent('emerald', 6, '2'), ctx)
    refresh.mockClear()
    applyRealtimeEvent(nftEvent('emerald', 6, '2'), ctx)
    expect(refresh).not.toHaveBeenCalled()

    applyRealtimeEvent(orderEvent('declined', 2, 'user_leo'), ctx)
    applyRealtimeEvent(orderEvent('declined', 2), { ...ctx, userId: null })
    expect(refresh).not.toHaveBeenCalled()
  })
})
