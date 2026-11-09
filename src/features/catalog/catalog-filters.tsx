import { cn } from 'cn'
import { useId, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { categoryIds, networkIds, type NftListResponse } from '@/api/contracts'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { eth } from '@/lib/eth'
import { CATEGORY_LABELS, NETWORK_LABELS, toggleInList, type CatalogSearch } from './search'

/** O slider anda em centésimos de ETH (inteiros); a conversão passa por wei/bigint, nunca por float. */
const CENT = 10n ** 16n
const toCents = (value: string, round: 'floor' | 'ceil') => {
  const wei = eth.toWei(value)
  const cents = wei / CENT
  return Number(round === 'ceil' && wei % CENT !== 0n ? cents + 1n : cents)
}
const fromCents = (cents: number) => eth.fromWei(BigInt(cents) * CENT)
/** "0,02" — o Figma usa vírgula decimal no rótulo da faixa. */
const formatBr = (value: string) => eth.format(value).replace('.', ',')

export type CatalogPatch = Partial<Pick<CatalogSearch, 'category' | 'network' | 'min' | 'max'>>

interface CatalogFiltersProps {
  search: CatalogSearch
  facets: NftListResponse['facets'] | undefined
  onChange: (patch: CatalogPatch) => void
  className?: string
}

function FacetRow({ label, count, active, bold, onToggle }: { label: string; count: number | undefined; active: boolean; bold: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={onToggle}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm leading-5 hover:text-copper-light focus-visible:outline-2 focus-visible:outline-copper-light lg:min-h-10 lg:py-0 lg:text-[15px]',
          active ? 'text-copper-light' : 'text-sand-light',
        )}
      >
        <span>{label}</span>
        <span className={cn('flex shrink-0 items-center gap-2 text-right', bold && 'font-bold')}>
          {active && <CheckIcon aria-hidden className="size-4" />}
          {count === undefined ? '' : `(${count})`}
        </span>
      </button>
    </li>
  )
}

function PriceFilter({ search, range, onChange }: { search: CatalogSearch; range: { min: string; max: string } | undefined; onChange: CatalogFiltersProps['onChange'] }) {
  const bounds = range ? { min: toCents(range.min, 'floor'), max: toCents(range.max, 'ceil') } : { min: 0, max: 100 }
  const fromUrl = (): [number, number] => [
    search.min ? toCents(search.min, 'floor') : bounds.min,
    search.max ? toCents(search.max, 'ceil') : bounds.max,
  ]
  const [value, setValue] = useState<[number, number]>(fromUrl)

  const [low, high] = value
  return (
    <div className="flex flex-col gap-3 lg:pl-3">
      <Slider
        className="h-11 [&_[data-slot=slider-thumb]]:size-6 lg:h-[21px] lg:[&_[data-slot=slider-thumb]]:size-[21px]"
        min={bounds.min}
        max={bounds.max}
        step={1}
        minStepsBetweenThumbs={0}
        value={value}
        disabled={!range}
        onValueChange={(next) => setValue([next[0] ?? bounds.min, next[1] ?? bounds.max])}
        thumbLabels={['Preço mínimo', 'Preço máximo']}
        valueText={(cents) => `${formatBr(fromCents(cents))} ETH`}
      />
      <p className="text-[15px] text-cream" aria-live="polite">
        Preço: {formatBr(fromCents(low))} - {formatBr(fromCents(high))} ETH
      </p>
      <Button
        type="button"
        disabled={!range}
        onClick={() =>
          onChange({
            min: low > bounds.min ? fromCents(low) : undefined,
            max: high < bounds.max ? fromCents(high) : undefined,
          })
        }
        className="h-auto min-h-11 w-full self-start font-bold lg:min-h-10 lg:w-auto"
      >
        Aplicar
      </Button>
    </div>
  )
}

/** Painel de filtros do Figma (310 px): coleções, faixa de preço e rede. Combináveis entre si. */
export function CatalogFilters({ search, facets, onChange, className }: CatalogFiltersProps) {
  const id = useId()
  const categoryCount = (id: string) => facets?.categories.find((c) => c.id === id)?.count
  const networkCount = (id: string) => facets?.networks.find((n) => n.id === id)?.count
  const selectedCategories = new Set(search.category?.split(','))
  const selectedNetworks = new Set(search.network?.split(','))

  return (
    <div className={cn('flex flex-col gap-8 bg-surface-card p-6 lg:gap-10 lg:p-5', className)}>
      <section aria-labelledby={`${id}-collections`} className="flex flex-col gap-3">
        <h2 id={`${id}-collections`} className="text-base leading-6 font-bold text-cream lg:text-lg">
          Coleções
        </h2>
        <ul className="lg:px-3">
          {categoryIds.map((id) => (
            <FacetRow
              key={id}
              label={CATEGORY_LABELS[id]}
              count={categoryCount(id)}
              active={selectedCategories.has(id)}
              bold
              onToggle={() => onChange({ category: toggleInList(search.category, id) })}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby={`${id}-price`} className="flex flex-col gap-3">
        <h2 id={`${id}-price`} className="text-base leading-6 font-bold text-cream lg:text-lg">
          Faixa de preço
        </h2>
        {/* A URL manda: voltar no histórico ou limpar filtros remonta o slider na posição certa. */}
        <PriceFilter
          key={`${search.min}|${search.max}|${facets?.priceRange.min}|${facets?.priceRange.max}`}
          search={search}
          range={facets?.priceRange}
          onChange={onChange}
        />
      </section>

      <section aria-labelledby={`${id}-network`} className="flex flex-col gap-3">
        <h2 id={`${id}-network`} className="text-base leading-6 font-bold text-cream lg:text-lg">
          Rede
        </h2>
        <ul className="lg:pl-3">
          {networkIds.map((id) => (
            <FacetRow
              key={id}
              label={NETWORK_LABELS[id]}
              count={networkCount(id)}
              active={selectedNetworks.has(id)}
              bold={false}
              onToggle={() => onChange({ network: toggleInList(search.network, id) })}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
