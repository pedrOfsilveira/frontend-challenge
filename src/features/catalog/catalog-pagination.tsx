import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
// O SVG do Figma aponta para baixo; o layout gira −90° (direita) ou 90° (esquerda).
import arrowRight from '@/assets/figma/arrow-right-small.svg'
import { pageWindow } from './page-window'

const box = 'grid size-[35px] place-items-center rounded-sm text-lg leading-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

/** Paginação do Figma (quadrados de 35 px). Cada página é um link: funciona com histórico e refresh. */
export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const toPage = (p: number) => ({ to: '/' as const, search: (prev: Record<string, unknown>) => ({ ...prev, page: p > 1 ? p : undefined }), hash: 'catalogo' })

  return (
    <nav aria-label="Paginação do catálogo" className="flex items-center gap-2">
      {page > 1 && (
        <Link {...toPage(page - 1)} aria-label="Página anterior" className={cn(box, 'border border-border')}>
          <img src={arrowRight} alt="" width={12} height={7} className="rotate-90" />
        </Link>
      )}
      {pageWindow(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden className="px-1 text-sand">
            …
          </span>
        ) : (
          <Link
            key={item}
            {...toPage(item)}
            aria-label={`Página ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={cn(box, item === page ? 'bg-copper font-bold text-ink' : 'border border-border text-cream hover:border-copper')}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link {...toPage(page + 1)} aria-label="Próxima página" className={cn(box, 'border border-border')}>
          <img src={arrowRight} alt="" width={12} height={7} className="-rotate-90" />
        </Link>
      )}
    </nav>
  )
}
