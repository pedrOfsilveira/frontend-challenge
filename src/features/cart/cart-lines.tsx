import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import deleteIcon from '@/assets/figma/delete.svg'
import minusDisabled from '@/assets/figma/m-minus-disabled.svg'
import minusIcon from '@/assets/figma/m-minus.svg'
import type { CartLine, QuoteLine } from '@/api/contracts'
import { MaskIcon } from '@/components/mask-icon'
import { NftImage } from '@/features/catalog/nft-image'
import { QuantityStepper } from '@/features/nft/purchase-controls'
import { eth } from '@/lib/eth'
import { formatEth } from '@/lib/format'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'
const MAX_PER_LINE = 99

export interface CartLineActions {
  onQuantity: (line: CartLine, quantity: number) => void
  onRemove: (line: CartLine) => void
}

/** Limite do seletor: o estoque da edição. Acima dele (estoque caiu), só o − fica ativo. */
const maxFor = (line: CartLine) => Math.max(1, Math.min(line.available, MAX_PER_LINE))

/**
 * Total da linha: o da cotação atual (inclusive quando o estoque obrigou a cotar menos unidades).
 * Sem cotação válida (carregando ou refazendo após uma mudança), a conta local só para exibir.
 */
function lineTotal(line: CartLine, quoteLines: QuoteLine[] | undefined) {
  const quoted = quoteLines?.find((q) => q.nftId === line.nftId && q.editionId === line.editionId)
  return quoted ? quoted.lineTotalEth : eth.times(line.unitPriceEth, line.quantity)
}

/** Aviso da linha quando o estoque mudou depois de entrar no carrinho. */
function stockWarning(line: CartLine) {
  if (line.available === 0) return 'Esgotado: não entra no total.'
  if (line.quantity > line.available) return `Só ${line.available} disponível(is): o total considera ${line.available}.`
  return null
}

function NftLink({ line, className }: { line: CartLine; className?: string }) {
  return (
    <Link to="/nft/$nftId" params={{ nftId: line.nftId }} search={{ edicao: line.editionId }} className={cn('hover:text-copper-light', focusRing, className)}>
      {line.name}
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Desktop (Figma 11:1278, "Cart Table" 782 px)                        */
/* ------------------------------------------------------------------ */

export function CartTable({ lines, quoteLines, actions }: { lines: CartLine[]; quoteLines?: QuoteLine[]; actions: CartLineActions }) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-y-3 text-left">
      <caption className="sr-only">Itens no carrinho</caption>
      {/* Colunas nas posições do Figma: 311 · 138 · 136 · 148 · 24 (+24 de respiro à direita). */}
      <colgroup>
        <col className="w-[39.8%]" />
        <col className="w-[17.6%]" />
        <col className="w-[17.4%]" />
        <col className="w-[19%]" />
        <col className="w-[6.2%]" />
      </colgroup>
      <thead>
        <tr className="text-base leading-4 text-cream">
          <th scope="col" className="border-b border-copper/35 pb-3 font-bold">
            NFTs
          </th>
          <th scope="col" className="border-b border-copper/35 pb-3 font-medium">
            Preço
          </th>
          <th scope="col" className="border-b border-copper/35 pb-3 font-bold">
            Edições
          </th>
          <th scope="col" className="border-b border-copper/35 pb-3 font-medium">
            Total
          </th>
          <th scope="col" className="border-b border-copper/35 pb-3">
            <span className="sr-only">Remover</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const warning = stockWarning(line)
          return (
            <tr key={line.id} className={cn('h-[70px] bg-surface-card', line.available === 0 && 'opacity-60')}>
              <td className="p-0">
                <div className="flex items-center gap-4">
                  <NftImage src={line.image} alt="" sizes="70px" className="size-[70px] shrink-0 rounded-md object-cover" />
                  <div className="flex min-w-0 flex-col gap-1 leading-4">
                    <NftLink line={line} className="truncate text-base font-bold text-cream" />
                    <span className="truncate text-sm text-sand">ID do token: {line.tokenId}</span>
                    {warning ? (
                      <span className="text-xs leading-3 text-[#ff8a7a]">{warning}</span>
                    ) : (
                      <span className="text-xs leading-3 text-sand-light">Edição {line.editionLabel}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-base leading-4 font-bold text-sand-light">{formatEth(line.unitPriceEth)}</td>
              <td>
                <QuantityStepper
                  size="sm"
                  label={`Quantidade de ${line.name} (${line.editionLabel})`}
                  value={line.quantity}
                  max={maxFor(line)}
                  onChange={(next) => actions.onQuantity(line, next)}
                />
              </td>
              <td className={cn('text-base leading-4 font-bold text-copper-light', line.available === 0 && 'line-through')}>{formatEth(lineTotal(line, quoteLines))}</td>
              <td className="pr-6">
                <RemoveButton line={line} onRemove={actions.onRemove} tone="text-sand" />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ------------------------------------------------------------------ */
/* Mobile (Figma 16:360, cartões 358 × 100)                            */
/* ------------------------------------------------------------------ */

export function CartCards({ lines, quoteLines, actions }: { lines: CartLine[]; quoteLines?: QuoteLine[]; actions: CartLineActions }) {
  return (
    <ul aria-label="Itens no carrinho" className="flex flex-col gap-5">
      {lines.map((line) => {
        const warning = stockWarning(line)
        const max = maxFor(line)
        return (
          <li
            key={line.id}
            className={cn('relative flex min-h-[100px] rounded-[14px] bg-surface-card shadow-[0_6px_20px_rgba(10,6,4,0.45)]', line.available === 0 && 'opacity-60')}
          >
            <NftImage src={line.image} alt="" sizes="100px" className="size-[100px] shrink-0 rounded-l-[14px] object-cover" />
            <div className="flex min-w-0 flex-1 flex-col justify-between py-3 pr-3 pl-[9px]">
              <div className="flex flex-col gap-1.5 pr-8 leading-4">
                <NftLink line={line} className="truncate text-[15px] font-bold text-cream" />
                <span className="text-sm text-sand-light">Edição: {line.editionLabel}</span>
              </div>
              {warning && <span className="text-xs text-[#ff8a7a]">{warning}</span>}
              <div className="flex items-end justify-between gap-2">
                <span className={cn('text-lg leading-4 font-bold text-copper-light', line.available === 0 && 'line-through')}>{formatEth(lineTotal(line, quoteLines))}</span>
                <MobileStepper
                  label={`Quantidade de ${line.name} (${line.editionLabel})`}
                  value={line.quantity}
                  canIncrease={line.quantity < max}
                  onChange={(next) => actions.onQuantity(line, next)}
                />
              </div>
            </div>
            <div className="absolute top-2 right-2">
              <RemoveButton line={line} onRemove={actions.onRemove} tone="text-copper" />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Seletor do cartão mobile: "−" é o círculo do Figma (apagado em 1), "+" o círculo com o sinal. */
function MobileStepper({ label, value, canIncrease, onChange }: { label: string; value: number; canIncrease: boolean; onChange: (next: number) => void }) {
  const button = cn('grid size-6 place-items-center rounded-full disabled:cursor-not-allowed', focusRing)
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button type="button" aria-label="Diminuir quantidade" disabled={value <= 1} onClick={() => onChange(value - 1)} className={button}>
        <img src={value <= 1 ? minusDisabled : minusIcon} alt="" width={24} height={24} />
      </button>
      <output aria-live="polite" className="min-w-[2ch] text-center text-base leading-[22px] text-cream">
        {value}
      </output>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={!canIncrease}
        onClick={() => onChange(value + 1)}
        className={cn(button, 'border border-border bg-surface-raised text-[21px] leading-4 text-cream disabled:text-border-soft')}
      >
        <span aria-hidden className="-mt-px">
          +
        </span>
      </button>
    </div>
  )
}

function RemoveButton({ line, onRemove, tone }: { line: CartLine; onRemove: (line: CartLine) => void; tone: string }) {
  return (
    <button
      type="button"
      aria-label={`Remover ${line.name} (${line.editionLabel}) do carrinho`}
      onClick={() => onRemove(line)}
      className={cn('grid size-6 place-items-center rounded-sm hover:text-copper-light', tone, focusRing)}
    >
      <MaskIcon src={deleteIcon} width={17.65} height={19.98} />
    </button>
  )
}
