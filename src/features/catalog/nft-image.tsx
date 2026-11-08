import type { ComponentProps } from 'react'

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

/** Arte do NFT: quadrada, com dimensões declaradas (sem layout shift) e carregamento preguiçoso fora da dobra. */
export function NftImage({ src, alt, sizes, priority = false, ...props }: NftImageProps) {
  return (
    <img
      src={src}
      srcSet={srcSetFor(src)}
      sizes={sizes}
      alt={alt}
      width={960}
      height={960}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      {...props}
    />
  )
}
