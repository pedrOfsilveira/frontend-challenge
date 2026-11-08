import { beforeEach, expect, it } from 'vitest'
import { store } from '../db/store'
import { authenticate, logout } from './auth'

beforeEach(async () => { await store.reset() })

it('requisições repetidas mantêm SESSION_EXPIRED mesmo se a primeira resposta for perdida', () => {
  const db = store.get()
  db.sessions.push({ token: 'expired-test-token', userId: 'user_nova', expiresAt: new Date(0).toISOString() })
  const request = () => authenticate(db, 'Bearer expired-test-token')
  expect(request).toThrowError(expect.objectContaining({ code: 'SESSION_EXPIRED' }))
  // A new page/request has only the persisted server state, not the first 401.
  expect(() => authenticate(structuredClone(db), 'Bearer expired-test-token'))
    .toThrowError(expect.objectContaining({ code: 'SESSION_EXPIRED' }))
})

it('logout ainda revoga o token e o distingue de uma sessão expirada', () => {
  const db = store.get()
  db.sessions.push({ token: 'expired-test-token', userId: 'user_nova', expiresAt: new Date(0).toISOString() })
  logout(db, 'expired-test-token')
  expect(() => authenticate(db, 'Bearer expired-test-token'))
    .toThrowError(expect.objectContaining({ code: 'UNAUTHENTICATED' }))
})
