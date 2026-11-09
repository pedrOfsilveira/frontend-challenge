import { useNavigate, useRouterState } from '@tanstack/react-router'
import { cn } from 'cn'
import desktopHeart from '@/assets/figma/d-heart.svg'
import favButton from '@/assets/figma/m-fav-button.svg'
import filledHeart from '@/assets/figma/m-heart.svg'
import heroHeart from '@/assets/figma/md-heart.svg'
import { MaskIcon } from '@/components/mask-icon'
import { useSession } from '@/features/session/use-session'
import { useChangeCount } from '@/lib/use-change-count'
import { useFavoriteIds, useToggleFavorite } from './use-favorites'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

/** Estado + ação de favorito. Visitante vai para o login e volta para a página atual. */
function useFavoriteToggle(nftId: string) {
  const session = useSession()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const favorite = useFavoriteIds().has(nftId)
  const mutation = useToggleFavorite()
  const toggle = () => {
    if (!session) {
      void navigate({ to: '/entrar', search: { redirect: href } })
      return
    }
    mutation.mutate({ nftId, favorite: !favorite })
  }
  return { favorite, toggle, pending: mutation.isPending, error: mutation.error }
}

interface FavoriteButtonProps {
  nftId: string
  nftName: string
  className?: string
  /** `card`: 28 px sobre a arte; `hero`: 44 px no topo do detalhe mobile; `labeled`: botão "Favoritar" do detalhe desktop. */
  variant?: 'card' | 'hero' | 'labeled'
}

export function FavoriteButton({ nftId, nftName, className, variant = 'card' }: FavoriteButtonProps) {
  const { favorite, toggle, pending, error } = useFavoriteToggle(nftId)
  // Só o ato de favoritar "pulsa"; desfavoritar apenas esvazia o coração.
  const change = useChangeCount(favorite)
  const pop = change.changed && favorite ? 'animate-heart-pop motion-scale' : undefined
  const label = favorite ? `Remover ${nftName} dos favoritos` : `Favoritar ${nftName}`
  const feedback = error && <p role="alert" className={cn('max-w-64 text-xs text-[#ff8a7a]', variant !== 'labeled' && 'absolute top-12 right-2 z-20 rounded border border-border-soft bg-surface-card p-2')}>{error.message} Tente novamente.</p>

  if (variant === 'labeled') {
    return (
      <><button
        type="button"
        aria-pressed={favorite}
        disabled={pending}
        onClick={toggle}
        className={cn('flex h-10 w-[130px] items-center justify-center gap-2 rounded-md border border-copper text-sm leading-5 font-medium text-copper-light transition-colors duration-150 hover:bg-copper/10 active:bg-copper/20', focusRing, className)}
      >
        {favorite ? <MaskIcon key={change.count} src={filledHeart} width={20} height={18} className={cn('text-copper', pop)} /> : <img src={desktopHeart} alt="" width={20} height={20} />}
        {favorite ? 'Favoritado' : 'Favoritar'}
      </button>{feedback}</>
    )
  }

  const size = variant === 'hero' ? 'size-11' : 'size-7'
  return (
    <><button type="button" aria-pressed={favorite} aria-label={label} disabled={pending} onClick={toggle} className={cn('grid place-items-center rounded-full transition-transform duration-150 motion-safe:active:scale-90', size, focusRing, className)}>
      {variant === 'card' && !favorite ? (
        <img src={favButton} alt="" width={28} height={28} />
      ) : (
        <span key={change.count} className={cn('grid place-items-center rounded-full border border-border bg-surface-raised text-copper-light', size, pop)}>
          {favorite ? <MaskIcon src={filledHeart} width={variant === 'hero' ? 16 : 15} height={variant === 'hero' ? 14 : 13} /> : <img src={heroHeart} alt="" width={16} height={14} />}
        </span>
      )}
    </button>{feedback}</>
  )
}
