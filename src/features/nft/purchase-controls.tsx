import { cn } from 'cn'
import minusIcon from '@/assets/figma/d-minus.svg'
import plusIcon from '@/assets/figma/d-plus.svg'
import starIcon from '@/assets/figma/d-star.svg'
import mobileMinus from '@/assets/figma/md-minus.svg'
import mobilePlus from '@/assets/figma/md-plus.svg'
import type { Edition } from '@/api/contracts'
import { LiveValue } from '@/components/live-value'
import { MaskIcon } from '@/components/mask-icon'
import { Term } from '@/features/glossary/term'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

/** Cinco estrelas do Figma: cobre nas estrelas completas, areia no resto (4.8 = 4 cobre + 1 areia). */
export function RatingStars({ average }: { average: string }) {
  const filled = Math.floor(Number(average))
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="grid size-[15px] place-items-center">
          <MaskIcon src={starIcon} width={12.5} height={11.9} className={i < filled ? 'text-copper' : 'text-sand-light'} />
        </span>
      ))}
    </span>
  )
}

/** Edições como pílulas ovais (Figma: elipses com contorno). Esgotadas ficam desabilitadas. */
export function EditionPicker({ editions, value, onChange, idPrefix }: { editions: Edition[]; value: string; onChange: (id: string) => void; idPrefix: string }) {
  return (
    <fieldset className="flex flex-col gap-2 lg:gap-3">
      <legend className="mb-2 text-[15px] leading-4 font-bold text-cream lg:mb-3">
        <Term id="edition">Edição</Term>:
      </legend>
      <div className="flex flex-wrap gap-x-3 gap-y-4 lg:gap-1.5">
        {editions.map((edition) => {
          const selected = edition.id === value
          const soldOut = edition.available === 0
          const label = edition.supply === null ? 'ABERTA' : edition.label
          return (
            <button
              key={edition.id}
              id={`${idPrefix}-${edition.id}`}
              type="button"
              aria-pressed={selected}
              aria-disabled={soldOut}
              aria-label={`Edição ${edition.label}${soldOut ? ', esgotada' : `, ${edition.available} disponíveis`}`}
              onClick={() => !soldOut && onChange(edition.id)}
              className={cn(
                // Oval de 28 px do Figma; no toque, o ::after estende a área para 44 × 44 px sem mudar o desenho.
                'relative min-h-7 min-w-9 rounded-[50%] border px-1.5 py-1 text-sm leading-4 whitespace-normal [overflow-wrap:anywhere] transition-colors duration-150 after:absolute after:-inset-x-[5px] after:-inset-y-[9px] lg:after:hidden',
                selected ? 'border-copper font-medium text-copper-light' : 'border-border text-sand-light',
                !selected && !soldOut && 'hover:border-border-soft hover:text-cream',
                soldOut && 'cursor-not-allowed text-sand-light/50 line-through',
                focusRing,
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Seletor de quantidade do Figma (pílulas cobre verticais). `size="sm"` é a versão da barra
 * de compra mobile. Respeita o estoque da edição.
 */
export function QuantityStepper({ value, max, onChange, size = 'lg', label = 'Quantidade' }: { value: number; max: number; onChange: (next: number) => void; size?: 'sm' | 'lg'; label?: string }) {
  const sm = size === 'sm'
  /*
   * Alvo de toque de 44 × 44 px sem mudar a geometria do Figma: as margens negativas
   * devolvem ao layout só o tamanho do círculo desenhado (20 × 30 ou 33 × 49,5).
   */
  const button = cn(
    'group grid min-h-[44px] min-w-[44px] place-items-center rounded-[33px] aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
    sm ? '-mx-3 -my-[7px]' : '-mx-[5.5px] lg:mx-0 lg:min-h-[49.5px] lg:min-w-[33px]',
    focusRing,
  )
  const icon = sm ? 16 : 26.4
  // aria-disabled (não `disabled`): no limite o botão continua focável, e quem usa teclado não perde o foco.
  const atMin = value <= 1
  const atMax = value >= max
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-3">
      <button type="button" aria-label="Diminuir quantidade" aria-disabled={atMin} onClick={() => !atMin && onChange(value - 1)} className={button}>
        <span aria-hidden className={cn('grid place-items-center rounded-[33px] border border-ink bg-copper shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)] transition-[background-color,transform] duration-150 group-hover:bg-copper-light motion-safe:group-active:translate-y-px', sm ? 'h-[30px] w-5' : 'h-[49.5px] w-[33px]')}>
          <img src={sm ? mobileMinus : minusIcon} alt="" width={icon} height={icon} />
        </span>
      </button>
      <output aria-live="polite" className={cn('min-w-[2ch] text-center text-cream', sm ? 'text-lg leading-[25px] font-medium' : 'text-xl leading-7')}>
        <LiveValue value={value} compare={(a, b) => a - b}>
          {value}
        </LiveValue>
      </output>
      <button type="button" aria-label="Aumentar quantidade" aria-disabled={atMax} onClick={() => !atMax && onChange(value + 1)} className={button}>
        <span aria-hidden className={cn('grid place-items-center rounded-[33px] border border-ink bg-copper shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)] transition-[background-color,transform] duration-150 group-hover:bg-copper-light motion-safe:group-active:translate-y-px', sm ? 'h-[30px] w-5' : 'h-[49.5px] w-[33px]')}>
          <img src={sm ? mobilePlus : plusIcon} alt="" width={icon} height={icon} />
        </span>
      </button>
    </div>
  )
}
