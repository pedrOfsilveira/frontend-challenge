import { createSeed, SCHEMA_VERSION } from './seed'
import type { Db } from './types'

/**
 * "Banco" único da simulação: catálogo, contas, carrinhos, carteiras e pedidos no mesmo estado,
 * persistido no localStorage para sobreviver ao refresh. O reset reconstrói a semente inteira.
 */
const STORAGE_KEY = 'kurio.mock.db'

let db: Db | null = null

function load(): Db | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Db
    return parsed.schemaVersion === SCHEMA_VERSION ? parsed : null
  } catch {
    return null
  }
}

export const store = {
  async init() {
    db = load() ?? (await createSeed())
    store.persist()
  },
  get(): Db {
    if (!db) throw new Error('Mock DB não inicializado')
    return db
  },
  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch {
      // Sem armazenamento: a simulação continua em memória.
    }
  },
  async reset() {
    db = await createSeed()
    store.persist()
  },
  nextId(prefix: string) {
    const current = store.get()
    current.sequence += 1
    return `${prefix}_${current.sequence}`
  },
}
