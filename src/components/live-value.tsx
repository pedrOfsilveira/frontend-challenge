import { cn } from 'cn'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useChangeCount } from '@/lib/use-change-count'

interface LiveValueProps<T> {
  /** O que define "mudou". O conteúdo exibido vem de `children`. */
  value: T
  children: ReactNode
  /** Ordem dos valores: o novo entra por baixo quando sobe e por cima quando desce. */
  compare?: (next: T, prev: T) => number
  /** Brilho cobre: para mudanças que vêm de fora (tempo real), não da própria pessoa. */
  flash?: boolean
  className?: string
}

/**
 * Número que se anima quando muda (preço, total, estoque, quantidade).
 * O primeiro render é estático; só uma mudança real reinicia a animação.
 */
export function LiveValue<T>({ value, children, compare, flash = false, className }: LiveValueProps<T>) {
  const { count, direction, changed } = useChangeCount(value, compare)
  return (
    <span
      key={count}
      data-dir={direction}
      className={cn(
        'inline-block',
        changed && (flash ? '[animation:var(--animate-value-in),var(--animate-value-flash)]' : 'animate-value-in'),
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Seta que acompanha uma mudança de preço em tempo real e some sozinha. */
export function TrendMark({ trend, id }: { trend: 'up' | 'down'; id: number }) {
  const Icon = trend === 'up' ? ArrowUp : ArrowDown
  return (
    <span key={id} data-dir={trend} aria-hidden className="inline-grid animate-trend place-items-center text-copper-light">
      <Icon className="size-[0.8em]" strokeWidth={2.5} />
    </span>
  )
}
