import { cn } from 'cn'
import arrowDown from '@/assets/figma/arrow-down.svg'
import { catalogTabIds, sortIds, type CatalogTab, type Sort } from '@/api/contracts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SORT_LABELS, TAB_LABELS } from './search'

export function CatalogTabs({ value, onChange, className }: { value: CatalogTab; onChange: (tab: CatalogTab) => void; className?: string }) {
  return (
    <div role="group" aria-label="Seleção do catálogo" className={cn('flex min-w-0 flex-wrap items-start gap-4 lg:gap-5', className)}>
      {catalogTabIds.map((tab) => {
        const active = tab === value
        return (
          <button
            key={tab}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab)}
            className={cn(
              'flex flex-col gap-1 text-sm leading-4 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light lg:gap-[7px] lg:text-[15px] lg:font-medium',
              active ? 'font-bold text-copper-light' : 'text-cream',
            )}
          >
            {TAB_LABELS[tab]}
            <span aria-hidden className={cn('h-0.5 w-full', active ? 'bg-copper' : 'bg-transparent')} />
          </button>
        )
      })}
    </div>
  )
}

export function CatalogSort({ value, onChange }: { value: Sort; onChange: (sort: Sort) => void }) {
  return (
    <div className="flex items-center gap-1 text-[15px] text-cream">
      <span id="sort-label">Ordenar por:</span>
      <Select value={value} onValueChange={(next) => onChange(next as Sort)}>
        <SelectTrigger
          aria-labelledby="sort-label"
          className="h-auto gap-1.5 rounded-sm border-0 bg-transparent px-0 py-0 text-[15px] text-cream shadow-none hover:text-copper-light dark:bg-transparent dark:hover:bg-transparent"
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
