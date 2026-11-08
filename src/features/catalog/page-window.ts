/** Páginas visíveis: a atual, vizinhas, primeira e última, com "…" nos saltos. */
export function pageWindow(current: number, total: number): (number | 'gap')[] {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total))
  if (current <= 3) [2, 3, 4].forEach((p) => p <= total && pages.add(p))
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.flatMap((page, index) => (index > 0 && page - (sorted[index - 1] ?? page) > 1 ? ['gap' as const, page] : [page]))
}
