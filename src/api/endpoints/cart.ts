import { cart, quote, type AddCartItemRequest, type PaymentNetwork } from '../contracts'
import { http, parse, type RequestOptions } from '../http'

export const cartApi = {
  get: async ({ signal }: RequestOptions = {}) => parse(cart, (await http.get('/cart', { signal })).data),
  addItem: async (body: AddCartItemRequest) => parse(cart, (await http.post('/cart/items', body)).data),
  updateItem: async (lineId: string, quantity: number) =>
    parse(cart, (await http.patch(`/cart/items/${encodeURIComponent(lineId)}`, { quantity })).data),
  removeItem: async (lineId: string) => parse(cart, (await http.delete(`/cart/items/${encodeURIComponent(lineId)}`)).data),
  applyCoupon: async (code: string) => parse(cart, (await http.put('/cart/coupon', { code })).data),
  removeCoupon: async () => parse(cart, (await http.delete('/cart/coupon')).data),
  quote: async (network: PaymentNetwork, { signal }: RequestOptions = {}) =>
    parse(quote, (await http.get('/cart/quote', { params: { network }, signal })).data),
}
