import { z } from 'zod'
import { nftSummary } from './nft'

export const favoritesResponse = z.object({
  ids: z.array(z.string()),
  items: z.array(nftSummary),
})
export type FavoritesResponse = z.infer<typeof favoritesResponse>
