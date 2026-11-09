import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
// O SVG do Figma aponta para baixo; o layout gira −90° (direita) ou 90° (esquerda).
import arrowRight from '@/assets/figma/arrow-right-small.svg'
import { pageWindow } from './page-window'

const box = 'grid size-11 shrink-0 place-items-center rounded-md text-base leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light sm:size-[35px] sm:rounded-sm sm:text-lg sm:leading-4'
const pageActiveOptions = { exact: true, includeSearch: true }

function mobilePageWindow(page: number, total: number): (number | 'gap')[] {
  const pages = [...new Set(page <= 2 ? [1, 2, total] : page >= total - 1 ? [1, total - 1, total] : [1, page, total])]
    .filter((item) => item >= 1 && item <= total).sort((a, b) => a - b)
  return pages.flatMap((item, index): (number | 'gap')[] => index > 0 && item - pages[index - 1]! > 1 ? ['gap', item] : [item])
}

/** Paginação do Figma (quadrados de 35 px). Cada página é um link: funciona com histórico e refresh. */
export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const toPage = (p: number) => ({ to: '/' as const, search: (prev: Record<string, unknown>) => ({ ...prev, page: p > 1 ? p : undefined }), hash: 'catalogo' })

  const links = (items: (number | 'gap')[]) => <>
      {page > 1 && (
        <Link {...toPage(page - 1)} activeOptions={pageActiveOptions} aria-label="Página anterior" className={cn(box, 'border border-border')}>
          <img src={arrowRight} alt="" width={12} height={7} className="rotate-90" />
        </Link>
      )}
      {items.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden className="px-0.5 text-xs text-sand sm:px-1 sm:text-base">
            …
          </span>
        ) : (
          <Link
            key={item}
            {...toPage(item)}
            activeOptions={pageActiveOptions}
            aria-label={`Página ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={cn(box, item === page ? 'bg-copper font-bold text-ink' : 'border border-border text-cream hover:border-copper')}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link {...toPage(page + 1)} activeOptions={pageActiveOptions} aria-label="Próxima página" className={cn(box, 'border border-border')}>
          <img src={arrowRight} alt="" width={12} height={7} className="-rotate-90" />
        </Link>
      )}
    </>

  return (
    <nav aria-label="Paginação do catálogo" className="flex w-full justify-center sm:w-auto sm:justify-end">
      <div className="flex items-center gap-1 sm:hidden">{links(mobilePageWindow(page, totalPages))}</div>
      <div className="hidden items-center gap-2 sm:flex">{links(pageWindow(page, totalPages))}</div>
    </nav>
  )
}
