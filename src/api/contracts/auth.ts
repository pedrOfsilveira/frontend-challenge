import { z } from 'zod'
import { isoDate } from './common'

export const user = z.object({
  id: z.string(),
  email: z.email(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof user>

export const session = z.object({
  token: z.string(),
  expiresAt: isoDate,
  user,
})
export type Session = z.infer<typeof session>

/** Resultado da mescla do carrinho do visitante com o da conta, no login/cadastro. */
export const cartMergeNotice = z.object({
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  requested: z.number().int(),
  kept: z.number().int(),
})

export const authResponse = session.extend({
  cartMerge: z.array(cartMergeNotice),
})
export type AuthResponse = z.infer<typeof authResponse>

export const passwordRule = z
  .string()
  .min(8, 'Use pelo menos 8 caracteres.')
  .max(72, 'Use no máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra.')
  .regex(/\d/, 'Inclua pelo menos um número.')

export const usernameRule = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres.')
  .max(24, 'Use no máximo 24 caracteres.')
  .regex(/^[a-z0-9_.]+$/, 'Use letras minúsculas, números, ponto ou _.')

export const loginRequest = z.object({
  email: z.email('Informe um e-mail válido.').trim().toLowerCase(),
  password: z.string().min(1, 'Informe a senha.'),
})
export type LoginRequest = z.infer<typeof loginRequest>

export const registerRequest = z.object({
  displayName: z.string().trim().min(2, 'Informe seu nome.').max(60, 'Use no máximo 60 caracteres.'),
  username: usernameRule,
  email: z.email('Informe um e-mail válido.').trim().toLowerCase(),
  password: passwordRule,
})
export type RegisterRequest = z.infer<typeof registerRequest>

export const sessionResponse = z.object({ expiresAt: isoDate, user })
