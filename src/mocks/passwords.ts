import type { PasswordHash } from './db/types'

/** PBKDF2-SHA256 via WebCrypto. O "banco" do mock só guarda salt + hash, nunca a senha. */
const ITERATIONS = 60_000

const toHex = (buffer: ArrayBuffer | Uint8Array) =>
  Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')

const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [])

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return toHex(bits)
}

export async function hashPassword(password: string, saltHex?: string): Promise<PasswordHash> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16))
  return { algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: toHex(salt), hash: await derive(password, salt, ITERATIONS) }
}

export async function verifyPassword(password: string, stored: PasswordHash) {
  const candidate = await derive(password, fromHex(stored.salt), stored.iterations)
  // Comparação em tempo constante (por hábito; aqui não há canal lateral real).
  let diff = candidate.length ^ stored.hash.length
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i)
  return diff === 0
}
