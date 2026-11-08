import { z } from 'zod'
import { catalogTab, categoryIds, networkIds, sort, type Category, type NftListParams } from '@/api/contracts'
import { eth } from '@/lib/eth'

export const CATALOG_PAGE_SIZE = 9

const list = <T extends string>(allowed: readonly T[]) =>
  z
    .string()
    .transform((value) => {
      const picked = value.split(',').filter((item): item is T => (allowed as readonly string[]).includes(item))
      // Ordem estável e sem repetição: o mesmo filtro gera sempre a mesma URL e a mesma query key.
      return [...new Set(picked)].sort().join(',') || undefined
    })
    .optional()
    .catch(undefined)

const price = z
  .string()
  .refine(eth.isValid)
  .transform((value) => eth.normalize(value))
  .optional()
  .catch(undefined)

/**
 * Estado do catálogo na URL. Tudo opcional: ausência = padrão, então a URL "limpa" é a home.
 * Valores inválidos (link antigo, edição manual) caem no padrão em vez de quebrar a página.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined).transform((q) => q || undefined),
  tab: catalogTab.exclude(['all']).optional().catch(undefined),
  category: list(categoryIds),
  network: list(networkIds),
  min: price,
  max: price,
  sort: sort.exclude(['recent']).optional().catch(undefined),
  page: z.coerce.number().int().min(2).max(10_000).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

/** Parâmetros da API a partir da URL. */
export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q,
    tab: search.tab ?? 'all',
    categories: (search.category?.split(',') ?? []) as Category[],
    networks: (search.network?.split(',') ?? []) as NftListParams['networks'],
    priceMin: search.min,
    priceMax: search.max,
    sort: search.sort ?? 'recent',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

/** Liga/desliga um item numa lista separada por vírgula. */
export function toggleInList(current: string | undefined, item: string) {
  const items = new Set(current?.split(',').filter(Boolean))
  if (items.has(item)) items.delete(item)
  else items.add(item)
  return [...items].sort().join(',') || undefined
}

export const CATEGORY_LABELS: Record<Category, string> = {
  'digital-art': 'Arte digital',
  photography: 'Fotografia',
  music: 'Música',
  '3d-art': 'Arte 3D',
  collectibles: 'Colecionáveis',
  generative: 'Generativa',
  games: 'Jogos',
  signatures: 'Assinaturas',
  utility: 'Utilidade',
}

export const NETWORK_LABELS: Record<(typeof networkIds)[number], string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const SORT_LABELS = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome (A–Z)',
} as const

export const TAB_LABELS = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
} as const
