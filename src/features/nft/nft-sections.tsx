import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import dots from '@/assets/figma/d-carousel-dots.svg'
import linkedin from '@/assets/figma/d-share-linkedin.svg'
import mail from '@/assets/figma/d-share-message.svg'
import twitter from '@/assets/figma/d-share-twitter.svg'
import type { NftDetail } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { NftImage } from '@/features/catalog/nft-image'
import { featuredNftsQuery, relatedNftsQuery } from '@/features/catalog/queries'
import { formatEth } from '@/lib/format'
import { RatingStars } from './purchase-controls'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

/** Endereço curto como no Figma: 0x7A42...19E8. */
const shortAddress = (address: string) => (address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}`.toUpperCase().replace('0X', '0x') : address)

/** Links de compartilhamento reais (abrem o serviço em outra aba). */
export function ShareLinks({ name }: { name: string }) {
  const url = typeof window === 'undefined' ? '' : window.location.href.split('#')[0] ?? ''
  const text = `${name} na Kurio`
  const links = [
    { href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, icon: linkedin, w: 15, h: 14.4, label: 'LinkedIn' },
    { href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, icon: mail, w: 18, h: 18, label: 'e-mail' },
    { href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, icon: twitter, w: 16, h: 12.2, label: 'Twitter' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[15px] leading-4 font-bold text-cream">Compartilhar este NFT:</span>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target={link.href.startsWith('mailto:') ? undefined : '_blank'}
          rel="noopener noreferrer"
          aria-label={`Compartilhar por ${link.label}`}
          className={`grid size-6 place-items-center rounded-sm hover:opacity-80 ${focusRing}`}
        >
          <img src={link.icon} alt="" width={link.w} height={link.h} />
        </a>
      ))}
    </div>
  )
}

const tabTrigger =
  'h-auto flex-none rounded-none border-0 px-0 pb-3 text-[17px] leading-4 font-normal text-cream shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] data-[state=active]:font-bold data-[state=active]:text-copper-light data-[state=active]:after:bg-copper dark:text-cream dark:data-[state=active]:text-copper-light hover:text-copper-light'

/** Abas "Detalhes do NFT" / "Avaliações". As avaliações individuais não existem na API: mostra só o resumo. */
export function NftDetailsTabs({ nft }: { nft: NftDetail }) {
  return (
    <Tabs defaultValue="details" className="gap-3">
      <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-x-6 gap-y-3 rounded-none sm:gap-x-8 border-b border-copper/35 bg-transparent p-0">
        <TabsTrigger value="details" className={tabTrigger}>
          Detalhes do NFT
        </TabsTrigger>
        <TabsTrigger value="reviews" className={tabTrigger}>
          <span className="sm:hidden">Avaliações ({nft.rating.count})</span>
          <span className="hidden sm:inline">Avaliações de colecionadores ({nft.rating.count})</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="flex flex-col gap-3 text-sm leading-6">
        <div className="flex flex-col gap-6 text-sand-light">
          {nft.story.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="font-bold text-cream">Rede:</dt>
            <dd className="text-sand-light">Cunhado na {NETWORK_LABELS[nft.network]} com procedência imutável e metadados armazenados no IPFS.</dd>
          </div>
          <div>
            <dt className="font-bold text-cream">Contrato:</dt>
            <dd className="text-sand-light">{shortAddress(nft.contractAddress)} • Contrato inteligente ERC-721 verificado.</dd>
          </div>
          <div>
            <dt className="font-bold text-cream">Direitos autorais:</dt>
            <dd className="text-sand-light">
              Direitos autorais do criador: {nft.creator.royaltyBps / 100}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
            </dd>
          </div>
        </dl>
      </TabsContent>
      <TabsContent value="reviews" className="flex flex-col gap-3 text-sm leading-6 text-sand-light">
        <div className="flex items-center gap-2 text-cream">
          <RatingStars average={nft.rating.average} />
          <span>
            {nft.rating.average.replace('.', ',')} de 5 · {nft.rating.count} avaliações
          </span>
        </div>
        <p>Os comentários das avaliações ainda não estão disponíveis nesta versão do mercado.</p>
      </TabsContent>
    </Tabs>
  )
}

/** "Mais desta coleção": cinco cards (Figma 219 × 255). No mobile, rolagem horizontal. */
/**
 * Carrossel de NFTs relacionados. Com `nftId`, os da mesma coleção; sem, os destaques
 * (carrinho vazio ainda tem o que sugerir).
 */
export function RelatedNfts({ nftId, title = 'Mais desta coleção' }: { nftId?: string; title?: string }) {
  const related = useQuery({ ...relatedNftsQuery(nftId ?? ''), enabled: nftId !== undefined })
  const featured = useQuery({ ...featuredNftsQuery(), enabled: nftId === undefined })
  const { data, isPending, isError } = nftId === undefined ? featured : related
  if (isError || (data && data.items.length === 0)) return null

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <h2 id="related-title" className="border-b border-copper/35 pb-3 text-[17px] leading-4 font-bold text-copper-light">
        {title}
      </h2>
      <ul className="-mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-[26px] lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[180px] shrink-0 lg:w-auto">
                <Skeleton className="aspect-[219/255] w-full rounded-none" />
                <Skeleton className="mt-3 h-4 w-3/4" />
              </li>
            ))
          : data.items.map((item) => (
              <li key={item.id} className="relative w-[180px] shrink-0 snap-start lg:w-auto">
                <div className="flex aspect-[219/255] items-center justify-center bg-surface-card px-1">
                  <NftImage src={item.image} alt="" sizes="(min-width: 1024px) 212px, 172px" className="aspect-square w-full rounded-[13px] object-cover" />
                </div>
                <h3 className="mt-3 text-[15px] text-cream">
                  <Link to="/nft/$nftId" params={{ nftId: item.id }} className={`after:absolute after:inset-0 ${focusRing}`}>
                    {item.name}
                  </Link>
                </h3>
                <p className="text-base leading-4 font-bold text-copper-light">{formatEth(item.priceEth)}</p>
              </li>
            ))}
      </ul>
      <img src={dots} alt="" aria-hidden width={52} height={12} className="hidden self-center lg:block" />
    </section>
  )
}
