import { replaceEqualDeep } from '@tanstack/react-query'

type Versioned = { id: string; version: number }

const isVersioned = (value: unknown): value is Versioned =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Versioned).id === 'string' &&
  typeof (value as Versioned).version === 'number'

const itemsOf = (value: unknown): unknown[] | null =>
  typeof value === 'object' && value !== null && Array.isArray((value as { items?: unknown }).items)
    ? (value as { items: unknown[] }).items
    : null

/** Fica com a versão mais nova do mesmo recurso; recursos diferentes ou sem versão: vale o novo. */
function newest(oldValue: unknown, newValue: unknown) {
  return isVersioned(oldValue) && isVersioned(newValue) && oldValue.id === newValue.id && oldValue.version > newValue.version
    ? oldValue
    : newValue
}

/**
 * `structuralSharing` do QueryClient: uma resposta REST que saiu antes de um evento Socket.IO
 * (e chega depois dele) não pode regredir o cache. Vale para o recurso inteiro e para cada item
 * de listas `{ items }`. Fora isso, é o compartilhamento estrutural padrão.
 */
export function keepNewestVersion(oldData: unknown, newData: unknown): unknown {
  if (oldData === undefined) return newData
  const kept = newest(oldData, newData)
  if (kept === oldData) return oldData

  const oldItems = itemsOf(oldData)
  const newItems = itemsOf(newData)
  if (oldItems && newItems) {
    const previous = new Map(oldItems.filter(isVersioned).map((item) => [item.id, item]))
    const items = newItems.map((item) => (isVersioned(item) ? newest(previous.get(item.id), item) : item))
    return replaceEqualDeep(oldData, { ...(newData as object), items })
  }
  return replaceEqualDeep(oldData, newData)
}
