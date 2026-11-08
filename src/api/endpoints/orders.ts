import { IDEMPOTENCY_HEADER, order, ordersResponse, type CreateOrderRequest } from '../contracts'
import { http, parse, type RequestOptions } from '../http'

export const ordersApi = {
  /** A mesma chave + o mesmo corpo devolvem o mesmo pedido; chave reaproveitada com outro corpo = 409. */
  create: async (body: CreateOrderRequest, idempotencyKey: string) =>
    parse(order, (await http.post('/orders', body, { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } })).data),
  get: async (id: string, { signal }: RequestOptions = {}) =>
    parse(order, (await http.get(`/orders/${encodeURIComponent(id)}`, { signal })).data),
  pending: async ({ signal }: RequestOptions = {}) =>
    parse(ordersResponse, (await http.get('/orders', { params: { status: 'pending' }, signal })).data),
}
