import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Reserve the measured height; on short screens, let oversized content scroll with the page. */
export function MobilePurchaseBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const bar = ref.current
    const page = bar?.closest<HTMLElement>('[data-nft-page]')
    if (!bar || !page) return
    const root = document.documentElement

    const update = () => {
      const height = bar.getBoundingClientRect().height
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const inFlow = height > viewportHeight / 2
      bar.dataset.flow = String(inFlow)
      page.style.setProperty('--purchase-bar-height', inFlow ? '0px' : `${height}px`)
      // Foco por teclado não pode parar atrás da barra fixa (WCAG 2.4.11): a rolagem do foco desconta a altura dela.
      root.style.scrollPaddingBottom = inFlow ? '' : `${height}px`
    }
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      page.style.removeProperty('--purchase-bar-height')
      root.style.scrollPaddingBottom = ''
    }
  }, [])

  return <div ref={ref} className="nft-buybar lg:hidden" role="region" aria-label="Compra do NFT">{children}</div>
}
