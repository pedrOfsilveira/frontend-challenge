import { canonical } from '@/lib/canonical'

/**
 * Uma chave por tentativa de compra, derivada do conteúdo do pedido:
 * - clique repetido, retry automático ou reenvio depois de timeout/refresh → mesmo corpo → mesma chave
 *   → o servidor devolve o pedido já criado em vez de criar outro;
 * - corpo diferente (cotação nova, outra carteira) → chave nova;
 * - pedido criado (resposta recebida) → a chave é descartada: comprar de novo é outra tentativa.
 * Guardada no sessionStorage (por usuário), então sobrevive ao refresh da aba e some ao fechá-la.
 */
const STORE = 'kurio.idempotency'
const MAX_ENTRIES = 20

type Entries = Record<string, string>

function read(userId: string): Entries {
  try {
    return (JSON.parse(sessionStorage.getItem(`${STORE}.${userId}`) ?? '{}') as Entries) ?? {}
  } catch {
    return {}
  }
}

function write(userId: string, entries: Entries) {
  try {
    const kept = Object.entries(entries).slice(-MAX_ENTRIES)
    sessionStorage.setItem(`${STORE}.${userId}`, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    // Sem armazenamento: a chave vale enquanto a página está aberta (memória abaixo).
  }
}

const memory = new Map<string, string>()
const newKey = () => `ord_${crypto.randomUUID().replace(/-/g, '')}`

export const idempotency = {
  keyFor(userId: string, body: unknown) {
    const fingerprint = canonical(body)
    const scoped = `${userId}:${fingerprint}`
    const entries = read(userId)
    const existing = entries[fingerprint] ?? memory.get(scoped)
    if (existing) return existing
    const key = newKey()
    memory.set(scoped, key)
    write(userId, { ...entries, [fingerprint]: key })
    return key
  },
  /** O servidor recusou a chave (409 de conflito): a próxima tentativa com este corpo usa outra. */
  discard(userId: string, body: unknown) {
    const fingerprint = canonical(body)
    memory.delete(`${userId}:${fingerprint}`)
    const entries = read(userId)
    delete entries[fingerprint]
    write(userId, entries)
  },
}
