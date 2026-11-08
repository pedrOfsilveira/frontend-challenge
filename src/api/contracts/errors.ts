import { z } from 'zod'

/** Códigos de erro do contrato. O status HTTP acompanha cada um (ver `errorStatus`). */
export const errorCodes = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'OUT_OF_STOCK',
  'EDITION_UNAVAILABLE',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'QUOTE_OUTDATED',
  'IDEMPOTENCY_CONFLICT',
  'ORDER_PENDING',
  'WALLET_REJECTED',
  'WALLET_DISCONNECTED',
  'SERVICE_UNAVAILABLE',
] as const
export type ErrorCode = (typeof errorCodes)[number]

export const errorStatus: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  OUT_OF_STOCK: 409,
  EDITION_UNAVAILABLE: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  QUOTE_OUTDATED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  ORDER_PENDING: 409,
  WALLET_REJECTED: 409,
  WALLET_DISCONNECTED: 409,
  SERVICE_UNAVAILABLE: 503,
}

export const errorBody = z.object({
  error: z.object({
    code: z.enum(errorCodes),
    message: z.string(),
    /** Erros por campo: chave = nome do campo no corpo enviado. */
    fields: z.record(z.string(), z.string()).optional(),
    /** Dados extras do erro (ex.: a cotação nova em QUOTE_OUTDATED). */
    details: z.unknown().optional(),
  }),
})
export type ErrorBody = z.infer<typeof errorBody>
