import { nftDetail, nftListResponse, relatedResponse, type NftListParams } from '../contracts'
import { http, parse, type RequestOptions } from '../http'

/** Serializa filtros com chaves repetidas (`category=a&category=b`), legível na URL e na API. */
function toQuery(params: NftListParams) {
  return {
    q: params.q || undefined,
    tab: params.tab,
    category: params.categories?.length ? params.categories : undefined,
    network: params.networks?.length ? params.networks : undefined,
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export const nftsApi = {
  list: async (params: NftListParams, { signal }: RequestOptions = {}) =>
    parse(
      nftListResponse,
      (await http.get('/nfts', { params: toQuery(params), paramsSerializer: { indexes: null }, signal })).data,
    ),
  featured: async ({ signal }: RequestOptions = {}) => parse(relatedResponse, (await http.get('/nfts/featured', { signal })).data),
  detail: async (id: string, { signal }: RequestOptions = {}) =>
    parse(nftDetail, (await http.get(`/nfts/${encodeURIComponent(id)}`, { signal })).data),
  related: async (id: string, { signal }: RequestOptions = {}) =>
    parse(relatedResponse, (await http.get(`/nfts/${encodeURIComponent(id)}/related`, { signal })).data),
}
