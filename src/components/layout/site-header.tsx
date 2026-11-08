import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useId, useRef, useState } from 'react'
import cartIcon from '@/assets/figma/cart.svg'
import logoutIcon from '@/assets/figma/logout.svg'
import searchIcon from '@/assets/figma/search.svg'
import { useCartCount } from '@/features/cart/use-cart-count'

export type HeaderSection = 'home' | 'market'

const navLink = 'text-base leading-none whitespace-nowrap'

function NavItem({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className="flex flex-col gap-6">
      {children}
      {/* Sublinhado do item ativo (3 px, cobre). */}
      <span aria-hidden className={cn('h-[3px] w-full', active ? 'bg-copper' : 'bg-transparent')} />
    </span>
  )
}

/** Busca do cabeçalho: o ícone abre um campo; enviar leva ao catálogo com `?q=`. */
function HeaderSearch() {
  const navigate = useNavigate()
  const currentQ = useRouterState({ select: (s) => (s.location.pathname === '/' ? (s.location.search as { q?: string }).q : undefined) })
  const [open, setOpen] = useState(Boolean(currentQ))
  const [value, setValue] = useState(currentQ ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const [syncedQ, setSyncedQ] = useState(currentQ)
  if (currentQ !== syncedQ) {
    setSyncedQ(currentQ)
    setValue(currentQ ?? '')
  }
  useEffect(() => {
    if (open && !currentQ) inputRef.current?.focus()
  }, [open, currentQ])

  return (
    <form
      role="search"
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const q = value.trim() || undefined
        void navigate({ to: '/', search: (prev: Record<string, unknown>) => ({ ...prev, q, page: undefined }), hash: 'catalogo' })
      }}
    >
      {open && (
        <>
          <label htmlFor={inputId} className="sr-only">
            Buscar NFTs
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !value) setOpen(false)
            }}
            placeholder="Nome, coleção ou criador"
            maxLength={80}
            className="h-9 w-56 rounded-md border border-border-soft bg-surface-card px-3 text-sm text-cream placeholder:text-sand focus-visible:outline-2 focus-visible:outline-copper-light"
          />
        </>
      )}
      <button
        type={open ? 'submit' : 'button'}
        onClick={open ? undefined : () => setOpen(true)}
        aria-label={open ? 'Buscar' : 'Abrir busca'}
        className="grid size-9 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-copper-light"
      >
        <img src={searchIcon} alt="" width={20} height={20} />
      </button>
    </form>
  )
}

/** Cabeçalho desktop (Figma "Header Row" + divisória). No mobile a navegação fica na tab bar. */
export function SiteHeader({ section, divider = true }: { section: HeaderSection; divider?: boolean }) {
  const count = useCartCount()

  return (
    <header className="page-container hidden lg:block">
      <div className={cn('flex items-start justify-between pt-6', divider && 'border-b border-copper/35')}>
        <Link to="/" className="flex h-[34px] w-40 items-center text-sm font-bold tracking-[0.1em] text-cream">
          KURIO
        </Link>

        <nav aria-label="Principal" className="flex items-start gap-10">
          <NavItem active={section === 'home'}>
            <Link to="/" aria-current={section === 'home' ? 'page' : undefined} className={cn(navLink, section === 'home' ? 'font-bold text-copper-light' : 'text-cream')}>
              Início
            </Link>
          </NavItem>
          <NavItem active={section === 'market'}>
            <Link to="/" hash="catalogo" className={cn(navLink, section === 'market' ? 'font-bold text-copper-light' : 'text-cream')}>
              Mercado
            </Link>
          </NavItem>
          {/* Fora do escopo do desafio: texto, não link, para não fingir uma página que não existe. */}
          <span className={cn(navLink, 'text-cream')}>Criadores</span>
          <span className={cn(navLink, 'text-cream')}>Aprenda</span>
        </nav>

        <div className="flex items-center gap-7">
          <HeaderSearch />
          <Link to="/carrinho" className="relative grid size-9 place-items-center rounded-md" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <img src={cartIcon} alt="" width={24} height={24} />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute top-0 right-0 grid size-[18px] place-items-center rounded-full border-2 border-ink bg-copper text-tiny font-medium text-ink"
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          <Link
            to="/entrar"
            className="flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-md bg-copper text-base font-medium text-ink hover:bg-copper-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light"
          >
            <img src={logoutIcon} alt="" width={20} height={20} />
            Entrar
          </Link>
        </div>
      </div>
    </header>
  )
}
