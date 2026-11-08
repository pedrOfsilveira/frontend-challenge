import { useSyncExternalStore } from 'react'
import { privateScope } from '@/api/query-keys'
import { sessionStore } from '@/api/session-store'

/** Sessão atual (ou `null` para visitante), reativa a login/logout e a outras abas. */
export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null)
}

/** Escopo das query keys privadas da sessão atual. */
export function usePrivateScope() {
  return privateScope(useSession())
}
