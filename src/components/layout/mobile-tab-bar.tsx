import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import tabBarBg from '@/assets/figma/m-tabbar-bg.svg'
import fab from '@/assets/figma/m-tabbar-fab.svg'
import heart from '@/assets/figma/m-heart.svg'
import home from '@/assets/figma/m-home.svg'
import scanLine from '@/assets/figma/m-scan-2.svg'
import scanBottomLeft from '@/assets/figma/m-scan-3.svg'
import scanTopRight from '@/assets/figma/m-scan-4.svg'
import scanBottomRight from '@/assets/figma/m-scan-5.svg'
import scanTopLeft from '@/assets/figma/m-scan-6.svg'
import shop from '@/assets/figma/m-shop.svg'
import user from '@/assets/figma/m-user.svg'
import { MaskIcon } from '@/components/mask-icon'
import { useCartCount } from '@/features/cart/use-cart-count'

export type TabBarSection = 'home' | 'cart' | 'account'

/** Peças do ícone central, nas posições do Figma relativas ao botão de 65 px. */
const SCAN = [
  { src: scanTopLeft, left: 20.3, top: 21, w: 10.39, h: 10.31 },
  { src: scanTopRight, left: 34.1, top: 21.1, w: 10.39, h: 10.3 },
  { src: scanLine, left: 19, top: 32.1, w: 26.82, h: 1.79 },
  { src: scanBottomLeft, left: 20.3, top: 34.7, w: 10.35, h: 10.31 },
  { src: scanBottomRight, left: 34.1, top: 34.7, w: 10.32, h: 10.25 },
]

const item = 'absolute top-[71px] grid size-11 -translate-x-1/2 -translate-y-3 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-copper-light'

/**
 * Tab bar do Figma mobile (414 × 126). As posições horizontais viram porcentagens para
 * acompanhar a largura da tela; abaixo de `lg`, substitui o cabeçalho.
 */
export function MobileTabBar({ active }: { active: TabBarSection }) {
  const count = useCartCount()
  const tone = (section: TabBarSection) => (active === section ? 'text-copper-light' : 'text-sand-light')

  return (
    <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 h-[126px] lg:hidden">
      <img src={tabBarBg} alt="" aria-hidden className="pointer-events-none absolute top-[-9px] -left-[7.25%] h-[155px] w-[114.5%] max-w-none" />

      <Link to="/" aria-label="Início" aria-current={active === 'home' ? 'page' : undefined} className={cn(item, 'left-[11.1%]', tone('home'))}>
        <MaskIcon src={home} width={16} height={17} />
      </Link>
      {/* Favoritos não têm página própria no escopo: só o ícone, sem ação. */}
      <span aria-hidden className={cn(item, 'left-[28.5%] text-sand-light')}>
        <MaskIcon src={heart} width={20} height={18} />
      </span>

      <Link to="/" hash="catalogo" aria-label="Explorar catálogo" className="absolute top-0 left-1/2 size-[65px] -translate-x-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light">
        <img src={fab} alt="" width={65} height={65} className="absolute inset-0" />
        {SCAN.map((piece) => (
          <img key={piece.src} src={piece.src} alt="" className="absolute max-w-none" style={{ left: piece.left, top: piece.top, width: piece.w, height: piece.h }} />
        ))}
      </Link>

      <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} className={cn(item, 'left-[72.9%]', tone('cart'))}>
        <MaskIcon src={shop} width={20} height={20} />
        {count > 0 && (
          <span aria-hidden className="absolute top-1 right-0.5 grid size-4 place-items-center rounded-full bg-copper text-[9px] font-bold text-ink">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
      <Link to="/entrar" aria-label="Conta" className={cn(item, 'left-[87.9%]', tone('account'))}>
        <MaskIcon src={user} width={20} height={20} />
      </Link>
    </nav>
  )
}
