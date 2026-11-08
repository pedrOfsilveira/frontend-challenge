import {
  catalogTabIds,
  categoryIds,
  networkIds,
  sortIds,
  type CatalogTab,
  type Category,
  type Network,
  type NftDetail,
  type NftListResponse,
  type NftSummary,
  type Sort,
} from '@/api/contracts'
import { eth } from '@/lib/eth'
import type { Db, DbNft } from '../db/types'
import { mockEvents, nftUpdated } from '../events'
import { MockError, normalizeText } from '../lib'

const DEFAULT_PAGE_SIZE = 9
const MAX_PAGE_SIZE = 48
/** "Novos lançamentos": listados até 30 dias antes do lançamento mais recente. */
const NEW_WINDOW_MS = 30 * 86_400_000
const TRENDING_MIN_SCORE = 70

export function findNft(db: Db, id: string) {
  const nft = db.nfts.find((item) => item.id === id)
  if (!nft) throw new MockError('NOT_FOUND', 'NFT não encontrado.')
  return nft
}

export function findEdition(nft: DbNft, editionId: string) {
  const edition = nft.editions.find((item) => item.id === editionId)
  if (!edition) throw new MockError('NOT_FOUND', 'Edição não encontrada.')
  return edition
}

/** Preço exibido: o da edição padrão; se ela esgotou, o menor entre as disponíveis. */
export function summarize(nft: DbNft): NftSummary {
  const available = nft.editions.reduce((sum, edition) => sum + edition.available, 0)
  const defaultEdition = nft.editions.find((e) => e.id === nft.defaultEditionId) ?? nft.editions[0]!
  const inStock = nft.editions.filter((e) => e.available > 0)
  const priceEth =
    defaultEdition.available > 0 || inStock.length === 0
      ? defaultEdition.priceEth
      : inStock.reduce((min, e) => eth.min(min, e.priceEth), inStock[0]!.priceEth)
  return {
    id: nft.id,
    name: nft.name,
    tokenId: nft.tokenId,
    image: nft.image,
    category: nft.category,
    network: nft.network,
    priceEth,
    compareAtPriceEth: nft.compareAtPriceEth,
    available,
    badges: nft.badges,
    version: nft.version,
  }
}

export function detail(nft: DbNft): NftDetail {
  return {
    ...summarize(nft),
    images: nft.images,
    description: nft.description,
    story: nft.story,
    collection: nft.collection,
    creator: nft.creator,
    contractAddress: nft.contractAddress,
    attributes: nft.attributes,
    rating: nft.rating,
    editions: nft.editions,
    defaultEditionId: nft.defaultEditionId,
    listedAt: nft.listedAt,
  }
}

export interface ListQuery {
  q: string
  tab: CatalogTab
  categories: Category[]
  networks: Network[]
  priceMin: string | null
  priceMax: string | null
  sort: Sort
  page: number
  pageSize: number
}

const oneOf = <T extends string>(allowed: readonly T[], value: string | null, fallback: T): T =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

/** Lê a query string. Parâmetros inválidos são ignorados, como uma API tolerante faria. */
export function parseListQuery(params: URLSearchParams): ListQuery {
  const int = (key: string, fallback: number, max: number) => {
    const value = Number.parseInt(params.get(key) ?? '', 10)
    return Number.isFinite(value) && value >= 1 ? Math.min(value, max) : fallback
  }
  const price = (key: string) => {
    const value = params.get(key)
    return value && eth.isValid(value) ? value : null
  }
  return {
    q: (params.get('q') ?? '').trim().slice(0, 80),
    tab: oneOf(catalogTabIds, params.get('tab'), 'all'),
    categories: params.getAll('category').filter((c): c is Category => (categoryIds as readonly string[]).includes(c)),
    networks: params.getAll('network').filter((n): n is Network => (networkIds as readonly string[]).includes(n)),
    priceMin: price('priceMin'),
    priceMax: price('priceMax'),
    sort: oneOf(sortIds, params.get('sort'), 'recent'),
    page: int('page', 1, 10_000),
    pageSize: int('pageSize', DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  }
}

function matchesText(nft: DbNft, q: string) {
  if (!q) return true
  const needle = normalizeText(q)
  return [nft.name, nft.tokenId, nft.collection.name, nft.creator.name].some((field) => normalizeText(field).includes(needle))
}

function matchesTab(nft: DbNft, tab: CatalogTab, newestListing: number) {
  if (tab === 'new') return newestListing - Date.parse(nft.listedAt) <= NEW_WINDOW_MS
  if (tab === 'trending') return nft.trendingScore >= TRENDING_MIN_SCORE
  return true
}

const sorters: Record<Sort, (a: NftSummary & { listedAt: string }, b: NftSummary & { listedAt: string }) => number> = {
  recent: (a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt) || a.id.localeCompare(b.id),
  'price-asc': (a, b) => eth.compare(a.priceEth, b.priceEth) || a.id.localeCompare(b.id),
  'price-desc': (a, b) => eth.compare(b.priceEth, a.priceEth) || a.id.localeCompare(b.id),
  name: (a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id),
}

export function listNfts(db: Db, query: ListQuery, options: { empty?: boolean } = {}): NftListResponse {
  const catalog = options.empty ? [] : db.nfts
  const newestListing = Math.max(0, ...catalog.map((n) => Date.parse(n.listedAt)))
  // Facetas contam sobre busca + aba: os números do filtro não somem ao marcar uma opção.
  const base = catalog.filter((nft) => matchesText(nft, query.q) && matchesTab(nft, query.tab, newestListing))
  const filtered = base
    .map((nft) => ({ ...summarize(nft), listedAt: nft.listedAt }))
    .filter((item) => {
      if (query.categories.length && !query.categories.includes(item.category)) return false
      if (query.networks.length && !query.networks.includes(item.network)) return false
      if (query.priceMin && eth.compare(item.priceEth, query.priceMin) < 0) return false
      if (query.priceMax && eth.compare(item.priceEth, query.priceMax) > 0) return false
      return true
    })
    .sort(sorters[query.sort])

  const total = filtered.length
  const totalPages = Math.ceil(total / query.pageSize)
  const start = (query.page - 1) * query.pageSize
  const prices = catalog.map((nft) => summarize(nft).priceEth)

  return {
    items: filtered.slice(start, start + query.pageSize).map(({ listedAt: _listedAt, ...item }) => item),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    facets: {
      categories: categoryIds.map((id) => ({ id, count: base.filter((n) => n.category === id).length })),
      networks: networkIds.map((id) => ({ id, count: base.filter((n) => n.network === id).length })),
      priceRange: {
        min: prices.reduce((min, p) => eth.min(min, p), prices[0] ?? '0'),
        max: prices.reduce((max, p) => (eth.compare(p, max) > 0 ? p : max), prices[0] ?? '0'),
      },
    },
  }
}

export function featuredNfts(db: Db) {
  return { items: db.nfts.filter((nft) => nft.badges.includes('featured')).map(summarize) }
}

export function relatedNfts(db: Db, id: string) {
  const nft = findNft(db, id)
  const sameCollection = db.nfts.filter((n) => n.id !== id && n.collection.id === nft.collection.id)
  const sameCategory = db.nfts.filter((n) => n.id !== id && n.category === nft.category && !sameCollection.includes(n))
  return { items: [...sameCollection, ...sameCategory].slice(0, 5).map(summarize) }
}

/**
 * Altera preço/estoque de uma edição: sobe a versão do NFT e publica `nft.updated`.
 * Todo caminho que mexe no catálogo passa por aqui, para REST e eventos nunca divergirem.
 */
export function changeEdition(db: Db, nftId: string, editionId: string, patch: { priceEth?: string; available?: number }) {
  const nft = findNft(db, nftId)
  const edition = findEdition(nft, editionId)
  const nextPrice = patch.priceEth !== undefined ? eth.normalize(patch.priceEth) : edition.priceEth
  const nextAvailable = patch.available !== undefined ? Math.max(0, Math.trunc(patch.available)) : edition.available
  if (nextPrice === edition.priceEth && nextAvailable === edition.available) return null
  edition.priceEth = nextPrice
  edition.available = nextAvailable
  nft.version += 1
  const event = nftUpdated(nft, summarize(nft))
  mockEvents.publish(event)
  return event
}
