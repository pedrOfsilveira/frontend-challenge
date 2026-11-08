import { z } from 'zod'
import { ethAmount, isoDate, network, page } from './common'

export const categoryIds = [
  'digital-art',
  'photography',
  'music',
  '3d-art',
  'collectibles',
  'generative',
  'games',
  'signatures',
  'utility',
] as const
export const category = z.enum(categoryIds)
export type Category = z.infer<typeof category>

export const badgeIds = ['rare', 'limited', 'featured'] as const
export const badge = z.enum(badgeIds)

export const edition = z.object({
  id: z.string(),
  /** Rótulo do Figma: "1/1", "1/10", "1/50", "Aberta". */
  label: z.string(),
  /** `null` = edição aberta (sem tiragem fixa). */
  supply: z.number().int().positive().nullable(),
  available: z.number().int().min(0),
  priceEth: ethAmount,
})
export type Edition = z.infer<typeof edition>

export const nftSummary = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  category,
  network,
  /** Preço da edição padrão; se ela esgotou, o menor entre as edições disponíveis. */
  priceEth: ethAmount,
  /** Preço "de", riscado no card. */
  compareAtPriceEth: ethAmount.nullable(),
  /** Soma das unidades disponíveis em todas as edições. */
  available: z.number().int().min(0),
  badges: z.array(badge),
  version: z.number().int().min(1),
})
export type NftSummary = z.infer<typeof nftSummary>

export const nftDetail = nftSummary.extend({
  images: z.array(z.string()).min(1),
  description: z.string(),
  story: z.array(z.string()),
  collection: z.object({ id: z.string(), name: z.string() }),
  creator: z.object({ name: z.string(), royaltyBps: z.number().int().min(0) }),
  contractAddress: z.string(),
  attributes: z.array(z.string()),
  rating: z.object({ average: z.string(), count: z.number().int().min(0) }),
  editions: z.array(edition).min(1),
  defaultEditionId: z.string(),
  listedAt: isoDate,
})
export type NftDetail = z.infer<typeof nftDetail>

export const sortIds = ['recent', 'price-asc', 'price-desc', 'name'] as const
export const sort = z.enum(sortIds)
export type Sort = z.infer<typeof sort>

/** Abas do catálogo no Figma: Todos / Novos lançamentos / Em alta. */
export const catalogTabIds = ['all', 'new', 'trending'] as const
export const catalogTab = z.enum(catalogTabIds)
export type CatalogTab = z.infer<typeof catalogTab>

export interface NftListParams {
  q?: string
  tab?: CatalogTab
  categories?: Category[]
  networks?: z.infer<typeof network>[]
  priceMin?: string
  priceMax?: string
  sort?: Sort
  page?: number
  pageSize?: number
}

const facetCount = <T extends z.ZodType>(id: T) => z.object({ id, count: z.number().int().min(0) })

export const nftListResponse = page(nftSummary).extend({
  facets: z.object({
    categories: z.array(facetCount(category)),
    networks: z.array(facetCount(network)),
    priceRange: z.object({ min: ethAmount, max: ethAmount }),
  }),
})
export type NftListResponse = z.infer<typeof nftListResponse>

export const relatedResponse = z.object({ items: z.array(nftSummary) })
