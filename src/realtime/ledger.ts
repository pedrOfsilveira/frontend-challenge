import type { RealtimeEvent } from '@/api/contracts'

export type Admission = 'apply' | 'duplicate' | 'stale'

/**
 * Registro do que já foi aplicado: ids de evento (para duplicatas) e a maior versão vista por
 * recurso (para eventos antigos). Os ids ficam num LRU limitado; as versões, uma por recurso.
 */
export function createLedger({ maxEventIds = 500 } = {}) {
  const seen = new Set<string>()
  const versions = new Map<string, number>()
  const resourceKey = (event: RealtimeEvent) => `${event.resource.type}:${event.resource.id}`

  return {
    /**
     * Decide o destino do evento e, se for aplicar, já o registra.
     * `knownVersion` é a versão que o cache tem (vinda do REST), que pode ser mais nova que o último evento.
     */
    admit(event: RealtimeEvent, knownVersion = 0): Admission {
      if (seen.has(event.id)) return 'duplicate'
      seen.add(event.id)
      if (seen.size > maxEventIds) seen.delete(seen.values().next().value as string)

      const key = resourceKey(event)
      if (event.version <= Math.max(versions.get(key) ?? 0, knownVersion)) return 'stale'
      versions.set(key, event.version)
      return 'apply'
    },
    /** Troca de sessão: nada do usuário anterior conta mais. */
    reset() {
      seen.clear()
      versions.clear()
    },
  }
}

export type Ledger = ReturnType<typeof createLedger>
