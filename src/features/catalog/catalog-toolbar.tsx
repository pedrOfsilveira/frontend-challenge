import { cn } from 'cn'
import { useId } from 'react'
import arrowDown from '@/assets/figma/arrow-down.svg'
import { catalogTabIds, sortIds, type CatalogTab, type Sort } from '@/api/contracts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSlidingIndicator } from '@/lib/use-sliding-indicator'
import { SORT_LABELS, TAB_LABELS } from './search'

export function CatalogTabs({ value, onChange, className }: { value: CatalogTab; onChange: (tab: CatalogTab) => void; className?: string }) {
  const { container, indicator } = useSlidingIndicator<HTMLDivElement>('[aria-pressed="true"]', value)
  return (
    <div ref={container} role="group" aria-label="Seleção do catálogo" className={cn('relative flex w-full min-w-0 flex-nowrap items-start justify-between gap-2 lg:w-auto lg:justify-start lg:gap-5', className)}>
      {catalogTabIds.map((tab) => {
        const active = tab === value
        return (
          <button
            key={tab}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab)}
            className={cn(
              'relative flex shrink-0 flex-col gap-0.5 transition-colors duration-150 text-[clamp(10px,calc(3.8251vw_-_1.8361px),14px)] leading-4 whitespace-nowrap before:absolute before:inset-x-0 before:-inset-y-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light lg:gap-[7px] lg:text-[15px] lg:font-medium',
              active ? 'font-bold text-copper-light' : 'text-cream hover:text-copper-light',
            )}
          >
            {TAB_LABELS[tab]}
            {/* Reserva a altura do sublinhado; o traço visível é o indicador deslizante abaixo. */}
            <span aria-hidden className="h-0.5 w-full" />
          </button>
        )
      })}
      <span ref={indicator} aria-hidden className="tab-indicator h-0.5 bg-copper" />
    </div>
  )
}

export function CatalogSort({ value, onChange, variant = 'inline' }: { value: Sort; onChange: (sort: Sort) => void; variant?: 'inline' | 'field' }) {
  const labelId = useId()
  return (
    <div className={cn('flex text-[15px] text-cream', variant === 'field' ? 'flex-col items-stretch gap-2' : 'items-center gap-1')}>
      <span id={labelId}>Ordenar por:</span>
      <Select value={value} onValueChange={(next) => onChange(next as Sort)}>
        <SelectTrigger
          aria-labelledby={labelId}
          className={cn('gap-1.5 text-[15px] text-cream shadow-none hover:text-copper-light dark:bg-transparent dark:hover:bg-transparent', variant === 'field' ? 'min-h-11 w-full rounded-md border-border-soft bg-ink px-3 py-2' : 'min-h-6 rounded-sm border-0 bg-transparent px-0 py-0')}
          icon={<img src={arrowDown} alt="" width={11} height={6} />}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end" className="border-border-soft bg-surface-card">
          {sortIds.map((id) => (
            <SelectItem key={id} value={id} className="text-cream focus:bg-surface-dark focus:text-copper-light">
              {SORT_LABELS[id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
