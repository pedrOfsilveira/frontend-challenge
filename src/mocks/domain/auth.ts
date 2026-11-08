import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@/api/contracts'
import type { Db, DbSession, DbUser } from '../db/types'
import { store } from '../db/store'
import { MockError, randomHex } from '../lib'
import { hashPassword, verifyPassword } from '../passwords'
import { getCart, mergeGuestCart } from './cart'

export const SESSION_TTL_MS = 2 * 60 * 60_000

export function publicUser(user: DbUser): User {
  return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl }
}

/** Resolve o token do header. Sem token = visitante; token vencido ou desconhecido = 401. */
export function authenticate(db: Db, authorization: string | null): { user: DbUser; session: DbSession } | null {
  if (!authorization) return null
  const token = authorization.replace(/^Bearer\s+/i, '')
  const session = db.sessions.find((s) => s.token === token)
  if (!session) throw new MockError('UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  if (Date.parse(session.expiresAt) <= Date.now()) {
    db.sessions = db.sessions.filter((s) => s !== session)
    throw new MockError('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = db.users.find((u) => u.id === session.userId)
  if (!user) throw new MockError('UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  return { user, session }
}

export function requireUser(db: Db, authorization: string | null) {
  const auth = authenticate(db, authorization)
  if (!auth) throw new MockError('UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  return auth
}

function startSession(db: Db, user: DbUser, guestId: string | null): AuthResponse {
  const session: DbSession = { token: `tok_${randomHex(24)}`, userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() }
  db.sessions.push(session)
  const cartMerge = mergeGuestCart(db, guestId, getCart(db, user.id))
  return { ...session, user: publicUser(user), cartMerge }
}

export async function login(db: Db, input: LoginRequest, guestId: string | null) {
  const user = db.users.find((u) => u.email === input.email)
  // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta.
  if (!user || !(await verifyPassword(input.password, user.password))) {
    throw new MockError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
  }
  return startSession(db, user, guestId)
}

export function assertUnique(db: Db, input: { email?: string; username?: string }, exceptUserId?: string) {
  const others = db.users.filter((u) => u.id !== exceptUserId)
  if (input.email && others.some((u) => u.email === input.email)) {
    throw new MockError('EMAIL_TAKEN', 'Este e-mail já está cadastrado.', { fields: { email: 'Este e-mail já está cadastrado.' } })
  }
  if (input.username && others.some((u) => u.username === input.username)) {
    throw new MockError('USERNAME_TAKEN', 'Este nome de usuário já está em uso.', { fields: { username: 'Este nome de usuário já está em uso.' } })
  }
}

export async function register(db: Db, input: RegisterRequest, guestId: string | null) {
  assertUnique(db, input)
  const user: DbUser = {
    id: store.nextId('user'),
    email: input.email,
    username: input.username,
    displayName: input.displayName,
    avatarUrl: null,
    ensName: null,
    nickname: null,
    password: await hashPassword(input.password),
    profileVersion: 1,
  }
  db.users.push(user)
  db.favorites[user.id] = []
  return startSession(db, user, guestId)
}

export function logout(db: Db, token: string) {
  db.sessions = db.sessions.filter((s) => s.token !== token)
}
