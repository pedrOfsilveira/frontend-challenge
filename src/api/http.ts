import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { ApiError, toApiError } from './errors'
import { guestCart, sessionStore } from './session-store'

export const GUEST_CART_HEADER = 'X-Guest-Cart'

/**
 * Com os mocks ativos, as requisições esperam o service worker do MSW.
 * A interface renderiza antes disso (melhor LCP); só o transporte aguarda.
 */
let transportReady: Promise<unknown> = Promise.resolve()
export function setTransportReady(ready: Promise<unknown>) {
  transportReady = ready.catch(() => undefined)
}

type SessionLostReason = 'expired' | 'invalid'
const sessionLostListeners = new Set<(reason: SessionLostReason) => void>()
/** Avisado quando uma chamada autenticada volta 401: a sessão acabou no servidor. */
export function onSessionLost(listener: (reason: SessionLostReason) => void) {
  sessionLostListeners.add(listener)
  return () => sessionLostListeners.delete(listener)
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use(async (config) => {
  await transportReady
  const token = sessionStore.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  else config.headers.set(GUEST_CART_HEADER, guestCart.id())
  return config
})

http.interceptors.response.use(undefined, (error: unknown) => {
  const apiError = toApiError(error)
  const sentToken = (error as { config?: AxiosRequestConfig }).config?.headers?.Authorization
  // Só derruba a sessão se a requisição foi feita com o token que ainda está ativo
  // (uma resposta atrasada de um usuário anterior não pode deslogar o atual).
  if (apiError.isAuthError && sentToken && sentToken === `Bearer ${sessionStore.getToken()}`) {
    const reason = apiError.code === 'SESSION_EXPIRED' ? 'expired' : 'invalid'
    sessionLostListeners.forEach((listener) => listener(reason))
  }
  return Promise.reject(apiError)
})

/** Valida a resposta contra o contrato: payload fora do contrato vira erro explícito. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  if (import.meta.env.DEV) console.error('[api] resposta fora do contrato', result.error.issues)
  throw new ApiError({ kind: 'invalid-response', message: 'Resposta inesperada do servidor.' })
}

export interface RequestOptions {
  signal?: AbortSignal
}
