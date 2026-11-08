import { useNavigate, useRouterState } from '@tanstack/react-router'
import { cn } from 'cn'
import favButton from '@/assets/figma/m-fav-button.svg'
import heart from '@/assets/figma/m-heart.svg'
import { MaskIcon } from '@/components/mask-icon'
import { useSession } from '@/features/session/use-session'
import { useFavoriteIds, useToggleFavorite } from './use-favorites'

/** Botão de favorito (28 px, Figma mobile). Visitante vai para o login e volta para cá. */
export function FavoriteButton({ nftId, nftName, className }: { nftId: string; nftName: string; className?: string }) {
  const session = useSession()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const favorite = useFavoriteIds().has(nftId)
  const toggle = useToggleFavorite()

  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={favorite ? `Remover ${nftName} dos favoritos` : `Favoritar ${nftName}`}
      disabled={toggle.isPending}
      onClick={() => {
        if (!session) {
          void navigate({ to: '/entrar', search: { redirect: href } })
          return
        }
        toggle.mutate({ nftId, favorite: !favorite })
      }}
      className={cn('grid size-7 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light', className)}
    >
      {favorite ? (
        <span className="grid size-7 place-items-center rounded-full border border-border bg-surface-raised text-copper">
          <MaskIcon src={heart} width={15} height={13} />
        </span>
      ) : (
        <img src={favButton} alt="" width={28} height={28} />
      )}
    </button>
  )
}
