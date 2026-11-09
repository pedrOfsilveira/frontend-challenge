import { useState, type ComponentProps } from 'react'

const WIDTHS = [320, 640] as const

/** `/assets/nfts/x.webp` → srcset com as versões 320/640/960 geradas a partir do Figma. */
function srcSetFor(src: string) {
  if (!src.endsWith('.webp')) return undefined
  const base = src.slice(0, -'.webp'.length)
  return [...WIDTHS.map((w) => `${base}-${w}.webp ${w}w`), `${src} 960w`].join(', ')
}

interface NftImageProps extends Omit<ComponentProps<'img'>, 'src' | 'alt'> {
  src: string
  alt: string
  /** Largura renderizada, para o navegador escolher a versão certa. */
  sizes: string
  priority?: boolean
}

/**
 * Arte do NFT: quadrada, com dimensões declaradas (sem layout shift) e carregamento preguiçoso fora da dobra.
 * Fora da dobra, entra com um fade curto ao terminar de carregar (`data-loaded`, ver globals.css); erro também revela,
 * para o texto alternativo não ficar invisível.
 */
export function NftImage({ src, alt, sizes, priority = false, onLoad, onError, ...props }: NftImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const reveal = () => setLoadedSrc(src)
  return (
    <img
      // Imagem já em cache pode terminar antes do React ligar o onLoad.
      ref={(img) => {
        if (img?.complete && img.naturalWidth > 0 && loadedSrc !== src) reveal()
      }}
      src={src}
      srcSet={srcSetFor(src)}
      sizes={sizes}
      alt={alt}
      width={960}
      height={960}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      // Imagens prioritárias (LCP) aparecem direto: um fade atrasaria a métrica.
      data-loaded={priority ? undefined : loadedSrc === src}
      onLoad={(event) => {
        reveal()
        onLoad?.(event)
      }}
      onError={(event) => {
        reveal()
        onError?.(event)
      }}
      {...props}
    />
  )
}
