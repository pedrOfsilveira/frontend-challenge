/**
 * Serialização da URL do app. O padrão do TanStack Router converte "1.5" em `number` (e "true" em
 * boolean) já na decodificação, antes de qualquer parser customizado: preço viraria float.
 * Aqui todo valor chega como string; cada rota valida e converte o que precisa (zod).
 */
export function parseSearch(searchStr: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr))
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
  }
  // Vírgula é válida na query string: `category=music,photography` fica legível.
  const query = params.toString().replace(/%2C/gi, ',')
  return query ? `?${query}` : ''
}
