import { useLayoutEffect, useRef } from 'react'

/**
 * Um sublinhado só, que desliza até o item ativo em vez de "saltar" entre itens.
 * Posiciona `.tab-indicator` (globals.css) por transform: `--indicator-x` e `--indicator-w`.
 * A transição só liga depois da primeira posição, para o indicador não "voar" ao montar.
 */
export function useSlidingIndicator<C extends HTMLElement>(activeSelector: string, activeKey: unknown) {
  const container = useRef<C>(null)
  const indicator = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const root = container.current
    const bar = indicator.current
    if (!root || !bar) return

    const place = () => {
      const active = root.querySelector<HTMLElement>(activeSelector)
      if (!active) {
        bar.style.opacity = '0'
        return
      }
      const rootBox = root.getBoundingClientRect()
      const box = active.getBoundingClientRect()
      bar.style.setProperty('--indicator-x', `${box.left - rootBox.left + root.scrollLeft}px`)
      bar.style.setProperty('--indicator-w', String(box.width))
      bar.style.opacity = '1'
    }

    // Sem place() síncrono: medir aqui forçaria layout no commit (custo medido no primeiro render).
    // A 1ª notificação do ResizeObserver chega depois do layout e antes do paint; a transição
    // só liga no quadro seguinte a essa primeira posição.
    let frame = 0
    const observer = new ResizeObserver(() => {
      place()
      if (!frame && bar.dataset.ready !== 'true') frame = requestAnimationFrame(() => (bar.dataset.ready = 'true'))
    })
    observer.observe(root)
    for (const child of root.children) observer.observe(child)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [activeSelector, activeKey])

  return { container, indicator }
}
