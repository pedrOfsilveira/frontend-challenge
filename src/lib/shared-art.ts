/**
 * Transição compartilhada card → detalhe (View Transitions API, via `viewTransition` do TanStack Router).
 * Só uma imagem por estado pode ter o nome `nft-art` (nomes duplicados cancelam a transição),
 * então a marca vai para a arte clicada no último instante e sai de qualquer outra.
 * Ver `img[data-shared-art]` em globals.css.
 */
export function markSharedArt(from: Element) {
  for (const el of document.querySelectorAll('[data-shared-art]')) el.removeAttribute('data-shared-art')
  const img = from.closest('article, li')?.querySelector('img')
  if (!img) return
  img.setAttribute('data-shared-art', '')
  // Se a navegação não acontecer, a marca não fica para trás.
  window.setTimeout(() => img.isConnected && img.removeAttribute('data-shared-art'), 1500)
}
