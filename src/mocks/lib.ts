import type { z } from 'zod'
import { errorStatus, type ErrorBody, type ErrorCode } from '@/api/contracts'

/** Erro de domínio do servidor simulado; vira a resposta HTTP do contrato. */
export class MockError extends Error {
  readonly code: ErrorCode
  readonly fields?: Record<string, string>
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, extra: { fields?: Record<string, string>; details?: unknown } = {}) {
    super(message)
    this.code = code
    this.fields = extra.fields
    this.details = extra.details
  }

  get status() {
    return errorStatus[this.code]
  }

  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message, fields: this.fields, details: this.details } }
  }
}

/** Valida um corpo com o mesmo schema do cliente; erros viram 422 com mensagem por campo. */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  throw new MockError('VALIDATION_FAILED', 'Revise os campos destacados.', { fields })
}

/** JSON com chaves ordenadas: dois corpos iguais em conteúdo têm a mesma impressão digital. */
export { canonical as canonicalJson } from '@/lib/canonical'

/** FNV-1a de 32 bits em hex: suficiente para ids determinísticos da simulação. */
export function hash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** PRNG determinístico (mulberry32): mesma semente, mesma sequência. */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const nowIso = () => new Date(Date.now()).toISOString()

/** Busca sem acento e sem caixa. */
export function normalizeText(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
