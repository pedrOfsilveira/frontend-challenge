import type { Query, QueryClient, QueryFilters } from '@tanstack/react-query'
import type { Cart, NftDetail, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { queryKeys, type PrivateScope } from '@/api/query-keys'
import type { Ledger } from './ledger'

/** O que a interface precisa anunciar (toast + aria-live). Quem desenha é a camada de UI. */
export type RealtimeNotice =
  | {
      kind: 'cart-line-changed'
      nftId: string
      editionId: string
      name: string
      before: { priceEth: string; available: number }
      after: { priceEth: string; available: number }
    }
  | { kind: 'order-status'; orderId: string; status: Order['status'] }

export interface ApplyContext {
  queryClient: QueryClient
  ledger: Ledger
  /** Sessão de quem está conectado agora (`null` = visitante). */
  userId: string | null
  scope: PrivateScope
  notify: (notice: RealtimeNotice) => void
  /**
   * Busca no REST o estado atual das queries do filtro, sem reaproveitar resposta em voo
   * (ver `createRefresher`). É por aqui que o servidor continua sendo a fonte da verdade.
   */
  refresh: (filters: QueryFilters) => void
}

const TERMINAL: ReadonlySet<Order['status']> = new Set(['confirmed', 'declined'])

type WithItems = { items: NftSummary[] }
const hasItems = (data: unknown): data is WithItems =>
  typeof data === 'object' && data !== null && Array.isArray((data as { items?: unknown }).items)

const isList = (query: Query) => query.queryKey[1] === queryKeys.nfts.lists()[1]
const isLoading = (query: Query) => query.state.data === undefined && query.state.fetchStatus !== 'idle'

/** Maior versão do NFT entre as entradas do cache (detalhe, listas, destaques, relacionados). */
function cachedNftVersion(queryClient: QueryClient, nftId: string) {
  let version = queryClient.getQueryData<NftDetail>(queryKeys.nfts.detail(nftId))?.version ?? 0
  for (const [, data] of queryClient.getQueriesData({ queryKey: queryKeys.nfts.all })) {
    if (!hasItems(data)) continue
    const item = data.items.find((nft) => nft.id === nftId)
    if (item) version = Math.max(version, item.version)
  }
  return version
}

function applyNftUpdated(event: NftUpdatedEvent, ctx: ApplyContext) {
  const { queryClient } = ctx
  const nftId = event.resource.id
  if (ctx.ledger.admit(event, cachedNftVersion(queryClient, nftId)) !== 'apply') return

  const patchSummary = <T extends NftSummary>(nft: T): T =>
    nft.id === nftId && nft.version < event.version
      ? { ...nft, priceEth: event.data.priceEth, available: event.data.available, version: event.version }
      : nft

  queryClient.setQueryData<NftDetail>(queryKeys.nfts.detail(nftId), (old) => {
    if (!old || old.version >= event.version) return old
    const byId = new Map(event.data.editions.map((e) => [e.id, e]))
    return {
      ...patchSummary(old),
      editions: old.editions.map((edition) => {
        const next = byId.get(edition.id)
        return next ? { ...edition, priceEth: next.priceEth, available: next.available } : edition
      }),
    }
  })
  queryClient.setQueriesData<WithItems>({ queryKey: queryKeys.nfts.all }, (old) =>
    hasItems(old) && old.items.some((nft) => nft.id === nftId) ? { ...old, items: old.items.map(patchSummary) } : old,
  )
  // O patch acima só corrige o preço exibido. Quem entra ou sai de um filtro de preço, a ordem,
  // o total, as páginas e a faixa de preço das facetas são do servidor: toda listagem (contenha
  // ou não este NFT) volta ao REST. As ativas refazem já; as outras, quando montarem.
  // Detalhe/destaques/relacionados ainda sem dados não tinham onde aplicar o evento, e a resposta
  // em voo pode ser de antes dele: refazem quando ela chegar.
  ctx.refresh({ queryKey: queryKeys.nfts.all, predicate: (query) => isList(query) || isLoading(query) })

  // Carrinho: o preço/estoque exibidos mudam já, e a cotação (o valor a pagar) é refeita pelo servidor.
  const cartKey = queryKeys.private.cart(ctx.scope)
  // Carrinho em voo pode ter sido calculado antes do evento (e a versão do carrinho não muda com o
  // preço do NFT, então o `keepNewestVersion` não o barraria): pede de novo.
  if (queryClient.getQueryState(cartKey)?.fetchStatus !== 'idle') ctx.refresh({ queryKey: cartKey, exact: true })
  const cart = queryClient.getQueryData<Cart>(cartKey)
  const touched = cart?.items.filter((line) => line.nftId === nftId) ?? []
  if (!cart || touched.length === 0) return

  const editions = new Map(event.data.editions.map((e) => [e.id, e]))
  const changes: RealtimeNotice[] = []
  queryClient.setQueryData<Cart>(cartKey, {
    ...cart,
    items: cart.items.map((line) => {
      const next = line.nftId === nftId ? editions.get(line.editionId) : undefined
      if (!next || (next.priceEth === line.unitPriceEth && next.available === line.available)) return line
      changes.push({
        kind: 'cart-line-changed',
        nftId,
        editionId: line.editionId,
        name: line.name,
        before: { priceEth: line.unitPriceEth, available: line.available },
        after: { priceEth: next.priceEth, available: next.available },
      })
      return { ...line, unitPriceEth: next.priceEth, available: next.available }
    }),
  })
  if (changes.length === 0) return
  void queryClient.invalidateQueries({ queryKey: queryKeys.private.quotes(ctx.scope) })
  changes.forEach(ctx.notify)
}

function applyOrderUpdated(event: OrderUpdatedEvent, ctx: ApplyContext) {
  const { queryClient, scope } = ctx
  // Defesa em profundidade: o servidor já filtra, mas evento de outra conta (ou da sessão anterior) nunca entra.
  if (ctx.userId === null || event.userId !== ctx.userId) return

  const key = queryKeys.private.order(scope, event.resource.id)
  const cached = queryClient.getQueryData<Order>(key)
  if (ctx.ledger.admit(event, cached?.version ?? 0) !== 'apply') return
  // Estado terminal não volta atrás, nem com versão maior.
  if (cached && TERMINAL.has(cached.status)) return

  if (cached) {
    queryClient.setQueryData<Order>(key, {
      ...cached,
      status: event.data.status,
      transaction: event.data.transaction,
      declineReason: event.data.declineReason,
      version: event.version,
      updatedAt: event.occurredAt,
    })
  }
  if (cached) void queryClient.invalidateQueries({ queryKey: queryKeys.private.orders(scope), refetchType: 'none' })
  // Sem o pedido no cache (ex.: tela de pedido ainda carregando, com a resposta de antes do evento
  // em voo), o REST traz o estado certo: refaz já ou assim que a requisição em voo terminar.
  else ctx.refresh({ queryKey: queryKeys.private.orders(scope) })

  if (TERMINAL.has(event.data.status)) {
    // Confirmado: o servidor tirou os itens comprados do carrinho; recusado: o estoque reservado voltou.
    ctx.refresh({ queryKey: queryKeys.private.cart(scope) })
    ctx.refresh({ queryKey: queryKeys.nfts.all })
  }
  ctx.notify({ kind: 'order-status', orderId: event.resource.id, status: event.data.status })
}

export function applyRealtimeEvent(event: RealtimeEvent, ctx: ApplyContext) {
  if (event.type === 'nft.updated') applyNftUpdated(event, ctx)
  else applyOrderUpdated(event, ctx)
}
