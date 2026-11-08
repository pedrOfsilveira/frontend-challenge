import { cn } from 'cn'
import { useRef, useState } from 'react'
import zoomIcon from '@/assets/figma/d-zoom.svg'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { NftImage } from '@/features/catalog/nft-image'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

/**
 * Galeria desktop do Figma: quatro miniaturas (100 px) + imagem principal (444 px) com lupa.
 * A lupa abre a imagem em tamanho grande num diálogo.
 */
export function NftGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const current = images[index] ?? images[0] ?? ''
  const alt = (i: number) => `${name}, imagem ${i + 1} de ${images.length}`

  return (
    <div className="flex items-center gap-7">
      <ul aria-label="Imagens do NFT" className="flex w-[100px] shrink-0 flex-col gap-4">
        {images.map((src, i) => (
          <li key={`${src}-${i}`} className="size-[100px] rounded-md bg-surface-card">
            <button
              type="button"
              aria-label={`Mostrar imagem ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
              className={cn('block size-[100px] overflow-hidden rounded-lg border', i === index ? 'border-copper' : 'border-transparent', focusRing)}
            >
              <NftImage src={src} alt="" sizes="100px" loading="eager" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative flex aspect-square w-full max-w-[444px] items-center justify-center rounded-md bg-surface-card p-5">
        <NftImage src={current} alt={alt(index)} sizes="404px" priority className="size-full rounded-3xl object-cover" />
        {/* Com DialogTrigger o foco volta para a lupa ao fechar. */}
        <Dialog open={zoom} onOpenChange={setZoom}>
          <DialogTrigger asChild>
            <button type="button" aria-label="Ampliar imagem" className={cn('absolute top-[13px] right-3 size-[30px] rounded-full', focusRing)}>
              <img src={zoomIcon} alt="" width={30} height={30} />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,90dvh)] border-border bg-surface-card p-3 sm:max-w-[min(90vw,90dvh)]">
            <DialogTitle className="sr-only">{name}</DialogTitle>
            <DialogDescription className="sr-only">{alt(index)} ampliada.</DialogDescription>
            <NftImage src={current} alt={alt(index)} sizes="90vw" className="aspect-square w-full rounded-2xl object-cover" />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

/**
 * Galeria mobile: carrossel com rolagem e encaixe (deslizar com o dedo), indicador do Figma
 * (pílula = imagem atual). O indicador também é navegável por teclado.
 */
export function MobileGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLUListElement>(null)
  const goTo = (i: number) => track.current?.children[i]?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'start' })

  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      <ul
        ref={track}
        aria-label="Imagens do NFT"
        tabIndex={0}
        onScroll={(event) => {
          const el = event.currentTarget
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
        }}
        className={cn('flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden', focusRing)}
      >
        {images.map((src, i) => (
          <li key={`${src}-${i}`} className="w-full shrink-0 snap-start">
            <NftImage src={src} alt={`${name}, imagem ${i + 1} de ${images.length}`} sizes="100vw" priority={i === 0} className="aspect-[361/356] h-auto w-full object-cover" />
          </li>
        ))}
      </ul>
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-[7px]">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Imagem ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => goTo(i)}
              className={cn('grid h-6 min-w-6 place-items-center rounded-full', focusRing)}
            ><span aria-hidden className={cn('h-[7px] rounded-full bg-copper transition-[width] motion-reduce:transition-none', i === index ? 'w-7' : 'w-[7px]')} /></button>
          ))}
        </div>
      )}
    </div>
  )
}
