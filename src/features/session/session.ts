import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { sessionStore, type StoredSession } from '@/api/session-store'

/**
 * Troca a identidade ativa (login, logout, expiração, outro usuário).
 * Ordem importa: (1) publica a identidade nova, então toda requisição daqui em diante já sai com o
 * token novo e grava no escopo novo; (2) cancela o que estava em voo da sessão anterior; (3) apaga o
 * cache privado inteiro. O socket reconecta sozinho ao ver o token mudar (`realtime/client`).
 */
export async function switchSession(queryClient: QueryClient, next: StoredSession | null) {
  sessionStore.set(next)
  await queryClient.cancelQueries({ queryKey: queryKeys.private.all })
  queryClient.removeQueries({ queryKey: queryKeys.private.all })
}

/** Rascunhos que só fazem sentido para a sessão atual (ex.: formulário de pagamento). */
const DRAFT_PREFIX = 'kurio.draft.'
export const sessionDrafts = {
  key: (userId: string, name: string) => `${DRAFT_PREFIX}${userId}.${name}`,
  read<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  write(key: string, value: unknown) {
    try {
      if (value === null) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Sem armazenamento: o rascunho dura só enquanto a tela está aberta.
    }
  },
}
