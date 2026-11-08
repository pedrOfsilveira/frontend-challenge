import { favoritesResponse } from '../contracts'
import { http, parse, type RequestOptions } from '../http'

export const favoritesApi = {
  list: async ({ signal }: RequestOptions = {}) => parse(favoritesResponse, (await http.get('/favorites', { signal })).data),
  add: async (nftId: string) => parse(favoritesResponse, (await http.put(`/favorites/${encodeURIComponent(nftId)}`)).data),
  remove: async (nftId: string) => parse(favoritesResponse, (await http.delete(`/favorites/${encodeURIComponent(nftId)}`)).data),
}
