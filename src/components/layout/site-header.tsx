import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useId, useRef, useState } from 'react'
import cartIcon from '@/assets/figma/cart.svg'
import logoutIcon from '@/assets/figma/logout.svg'
import searchIcon from '@/assets/figma/search.svg'
import { Button } from '@/components/ui/button'
import { useCartCount } from '@/features/cart/use-cart-count'
import { useSession } from '@/features/session/use-session'
import { useChangeCount } from '@/lib/use-change-count'

export type HeaderSection = 'home' | 'market' | 'favorites' | 'learn'

const navLink = 'inline-flex h-full items-center text-sm leading-5 whitespace-nowrap transition-colors hover:text-copper-light focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-copper-light xl:text-base'
const iconControl = 'grid size-11 shrink-0 place-items-center rounded-md transition-colors hover:bg-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'
const navActiveOptions = { exact: true, includeHash: true, includeSearch: false }

function NavItem({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('relative inline-flex h-full items-center after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-[3px]', active ? 'after:bg-copper' : 'after:bg-transparent')}>
      {children}
    </span>
  )
}

/** Busca do cabeçalho: o ícone abre um campo; enviar leva ao catálogo com `?q=`. */
function HeaderSearch() {
  const navigate = useNavigate()
  const currentQ = useRouterState({ select: (s) => (s.location.pathname === '/' ? (s.location.search as { q?: string }).q : undefined) })
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(currentQ ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputId = useId()

  const [syncedQ, setSyncedQ] = useState(currentQ)
  if (currentQ !== syncedQ) {
    setSyncedQ(currentQ)
    setValue(currentQ ?? '')
  }
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const outside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative" onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label={open ? 'Fechar busca' : 'Abrir busca'}
        aria-expanded={open}
        aria-controls={`${inputId}-panel`}
        className={cn(iconControl, (open || currentQ) && 'bg-surface-card')}
      >
        <img src={searchIcon} alt="" width={20} height={20} />
      </button>
      {open && (
        <form
          id={`${inputId}-panel`}
          role="search"
          aria-label="Busca do catálogo"
          className="absolute top-[calc(100%+1.5rem)] right-0 z-50 flex w-[min(360px,calc(100vw-3rem))] gap-2 rounded-lg border border-border-soft bg-surface-card p-3 shadow-lg"
          onSubmit={(event) => {
            event.preventDefault()
            const q = value.trim() || undefined
            setOpen(false)
            triggerRef.current?.focus()
            void navigate({ to: '/', search: (prev: Record<string, unknown>) => ({ ...prev, q, page: undefined }), hash: 'catalogo' })
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Buscar NFTs
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Nome ou coleção"
            maxLength={80}
            className="h-11 min-w-0 flex-1 rounded-md border border-border-soft bg-ink px-3 text-sm text-cream placeholder:text-sand focus-visible:outline-2 focus-visible:outline-copper-light"
          />
          <Button type="submit" className="h-11 font-bold">Buscar</Button>
        </form>
      )}
    </div>
  )
}

/** Cabeçalho desktop (Figma "Header Row" + divisória). No mobile a navegação fica na tab bar. */
export function SiteHeader({ section, divider = true }: { section: HeaderSection; divider?: boolean }) {
  const count = useCartCount()
  const countChange = useChangeCount(count)
  const session = useSession()
  const location = useRouterState({ select: (state) => state.location })
  const activeSection: HeaderSection | undefined = location.pathname === '/'
    ? location.hash === 'catalogo' ? 'market' : location.hash === 'aprenda' ? 'learn' : 'home'
    : location.pathname === '/favoritos' ? 'favorites' : section === 'market' ? 'market' : undefined

  return (
    <header className="page-container hidden lg:block">
      <div className={cn('grid h-[76px] grid-cols-[minmax(100px,1fr)_auto_minmax(180px,1fr)] items-center gap-6', divider && 'border-b border-copper/35')}>
        <Link to="/" search={{}} hash="" activeOptions={navActiveOptions} aria-label="Kurio — início" className="inline-flex h-11 w-fit items-center rounded-sm text-sm font-bold tracking-[0.1em] text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light">
          KURIO
        </Link>

        <nav aria-label="Principal" className="flex h-full items-center justify-center gap-5 xl:gap-10">
          <NavItem active={activeSection === 'home'}>
            <Link to="/" search={{}} hash="" activeOptions={navActiveOptions} aria-current={activeSection === 'home' ? 'page' : undefined} className={cn(navLink, activeSection === 'home' ? 'font-bold text-copper-light' : 'text-cream')}>
              Início
            </Link>
          </NavItem>
          <NavItem active={activeSection === 'market'}>
            <Link to="/" hash="catalogo" search={(previous) => previous} activeOptions={navActiveOptions} aria-current={activeSection === 'market' ? 'page' : undefined} className={cn(navLink, activeSection === 'market' ? 'font-bold text-copper-light' : 'text-cream')}>
              Mercado
            </Link>
          </NavItem>
          <NavItem active={activeSection === 'favorites'}>
            <Link to="/favoritos" activeOptions={navActiveOptions} aria-current={activeSection === 'favorites' ? 'page' : undefined} className={cn(navLink, activeSection === 'favorites' ? 'font-bold text-copper-light' : 'text-cream')}>
              Favoritos
            </Link>
          </NavItem>
          <span role="link" aria-disabled="true" title="Perfis de criadores indisponíveis nesta demonstração" className="inline-flex h-full cursor-default items-center text-sm leading-5 whitespace-nowrap text-sand-light/50 xl:text-base">Criadores</span>
          <NavItem active={activeSection === 'learn'}>
            <Link to="/" hash="aprenda" search={(previous) => previous} activeOptions={navActiveOptions} aria-current={activeSection === 'learn' ? 'page' : undefined} className={cn(navLink, activeSection === 'learn' ? 'font-bold text-copper-light' : 'text-cream')}>Aprenda</Link>
          </NavItem>
        </nav>

        <div className="flex items-center justify-self-end gap-3 xl:gap-4">
          <HeaderSearch />
          <Link to="/carrinho" className={cn('relative', iconControl)} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <img src={cartIcon} alt="" width={24} height={24} />
            {count > 0 && (
              <span
                key={countChange.count}
                aria-hidden
                className={cn(
                  'absolute top-0 right-0 grid size-[18px] place-items-center rounded-full border-2 border-ink bg-copper text-tiny font-medium text-ink',
                  countChange.changed && 'animate-tick motion-scale',
                )}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          <Button asChild className="h-10 min-w-[100px] px-3 font-bold xl:text-base">
            <Link to="/entrar">
              <img src={logoutIcon} alt="" width={20} height={20} />
              {session ? 'Minha conta' : 'Entrar'}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
