import { useSyncExternalStore } from 'react'
import { realtimeStatus } from './client'

/** Estado da conexão Socket.IO para avisos de "reconectando"/"sem conexão". */
export function useRealtimeStatus() {
  return useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get, () => 'idle' as const)
}
