import { isAxiosError } from 'axios'
import { errorBody, type ErrorCode } from './contracts'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'canceled'

/** Erro único que a interface trata, venha da API, da rede ou de um contrato quebrado. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: ErrorCode | null
  readonly fields: Record<string, string>
  readonly details: unknown

  constructor(init: {
    kind: ApiErrorKind
    message: string
    status?: number | null
    code?: ErrorCode | null
    fields?: Record<string, string>
    details?: unknown
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? null
    this.fields = init.fields ?? {}
    this.details = init.details
  }

  get isAuthError() {
    return this.status === 401
  }

  /** Falhas que podem dar certo numa nova tentativa. */
  get isTransient() {
    return this.kind === 'network' || this.kind === 'timeout' || (this.status !== null && this.status >= 500)
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') return new ApiError({ kind: 'canceled', message: 'Requisição cancelada.' })
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'O servidor demorou para responder. Tente novamente.' })
    }
    if (!error.response) {
      return new ApiError({ kind: 'network', message: 'Sem conexão com o servidor. Verifique sua rede e tente novamente.' })
    }
    const parsed = errorBody.safeParse(error.response.data)
    if (parsed.success) {
      const { code, message, fields, details } = parsed.data.error
      return new ApiError({ kind: 'http', status: error.response.status, code, message, fields, details })
    }
    return new ApiError({
      kind: 'http',
      status: error.response.status,
      message: error.response.status >= 500 ? 'O serviço está indisponível no momento.' : 'Não foi possível concluir a operação.',
    })
  }
  return new ApiError({ kind: 'network', message: error instanceof Error ? error.message : 'Erro inesperado.' })
}
