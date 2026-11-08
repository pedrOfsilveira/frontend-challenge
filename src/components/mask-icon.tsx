import { cn } from 'cn'

/**
 * Ícone do Figma usado como máscara: a forma é a do SVG original e a cor vem de `currentColor`,
 * então o mesmo asset serve para estado normal e ativo.
 */
export function MaskIcon({ src, width, height, className }: { src: string; width: number; height: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{ width, height, mask: `url("${src}") center / contain no-repeat`, WebkitMask: `url("${src}") center / contain no-repeat` }}
    />
  )
}
