import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import arrowRight from '@/assets/figma/arrow-right.svg'
import heroDots from '@/assets/figma/hero-dots.svg'
import mobileArrow from '@/assets/figma/m-arrow-right.svg'
import mobileDots from '@/assets/figma/m-dots.svg'
import filterIcon from '@/assets/figma/m-filter.svg'
import mobileHeroBg from '@/assets/figma/m-hero-mask.svg'
import searchIcon from '@/assets/figma/m-search.svg'
import promoMask from '@/assets/figma/promo-mask.svg'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SheetTrigger } from '@/components/ui/sheet'
import { NftImage } from './nft-image'
import { featuredNftsQuery } from './queries'

const ART = {
  shades: '/assets/nfts/shades.webp',
  bucket: '/assets/nfts/bucket.webp',
  baron: '/assets/nfts/baron.webp',
  headphones: '/assets/nfts/headphones.webp',
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'

/** Hero desktop (Figma 1200 × 450). A arte é o LCP: carrega com prioridade alta. */
export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="hidden items-center justify-between gap-10 pl-10 lg:flex lg:h-[450px]">
      <div className="flex max-w-[600px] flex-1 flex-col items-end gap-11">
        <div className="flex w-full flex-col gap-8">
          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-2 text-cream">
              <p className="text-sm leading-4 font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
              <h1 id="hero-title" className="text-display font-bold">
                SEJA DONO DO FUTURO
                <br />
                DA ARTE DIGITAL
              </h1>
            </div>
            <p className="max-w-[557px] text-sm leading-6 text-sand-light">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
            </p>
          </div>
          <Button asChild className="h-10 w-[140px] text-base font-bold">
            <Link to="/" hash="catalogo">EXPLORAR</Link>
          </Button>
        </div>
        <img src={heroDots} alt="" aria-hidden width={40} height={8} />
      </div>
      <NftImage
        src={ART.shades}
        alt="Emerald Ape #042: macaco de óculos redondos e jaqueta college verde"
        sizes="450px"
        priority
        className="size-[min(450px,40vw)] shrink-0 rounded-3xl object-cover"
      />
    </section>
  )
}

/** Banner do Figma mobile (366 × 190). */
export function MobileHero() {
  return (
    <section aria-labelledby="mobile-hero-title" className="@container relative aspect-[366/190] overflow-hidden rounded-xl sm:aspect-auto sm:h-[260px] lg:hidden">
      <img src={mobileHeroBg} alt="" aria-hidden className="absolute inset-0 size-full max-w-none" />
      {/* As medidas internas acompanham os 366 px do banner no Figma. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4.3716cqw] px-[4.3716cqw] sm:gap-4 sm:px-6">
        <div className="flex w-full items-center gap-[2.1858cqw] sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-col gap-[1.6393cqw] sm:gap-2">
              <p className="text-[3.2787cqw] leading-[4.3716cqw] font-medium text-cream sm:text-xs sm:leading-4">Bem-vindo à Kurio</p>
              <h1 id="mobile-hero-title" className="text-[4.918cqw] leading-[7.9235cqw] font-bold text-cream sm:text-[28px] sm:leading-10 md:text-[32px]">
                SEJA DONO DA<br />CULTURA DIGITAL
              </h1>
              <p className="text-[3.2787cqw] leading-[4.918cqw] text-sand-light sm:text-sm sm:leading-6">Descubra NFTs selecionados de criadores do mundo todo.</p>
            </div>
            <Link to="/" hash="catalogo" className={`relative flex items-center gap-[2.1858cqw] self-start rounded-sm text-[3.2787cqw] leading-[3.8251cqw] font-bold text-copper-light before:absolute before:inset-x-0 before:top-1/2 before:min-h-11 before:-translate-y-1/2 sm:gap-2 sm:text-sm sm:leading-5 ${focusRing}`}>
              EXPLORAR
              <img src={mobileArrow} alt="" width={10} height={12} className="h-[3.2787cqw] w-[2.7322cqw] -rotate-90 sm:h-3 sm:w-2.5" />
            </Link>
          </div>
          <div className="relative size-[37.7049cqw] shrink-0 sm:size-[200px]">
            <NftImage src={ART.shades} alt="" sizes="138px" priority className="size-full rounded-2xl object-cover" />
            <NftImage src={ART.bucket} alt="" sizes="(min-width: 640px) 84px, 58px" priority className="absolute top-[24.0437cqw] left-[3.8251cqw] size-[15.847cqw] rounded-2xl object-cover sm:top-[128px] sm:left-5 sm:size-[84px]" />
          </div>
        </div>
        <img src={mobileDots} alt="" aria-hidden width={33} height={7} className="h-[1.9126cqw] w-[9.0164cqw] sm:h-[7px] sm:w-[33px]" />
      </div>
    </section>
  )
}

/** Barra de busca + botão de filtros (Figma mobile). A busca escreve `?q=` com um pequeno atraso. */
export function MobileSearchBar({ q, onSearch, activeFilters }: { q: string | undefined; onSearch: (q: string | undefined) => void; activeFilters: number }) {
  const [value, setValue] = useState(q ?? '')
  // A URL mudou por fora (voltar, limpar busca): o campo acompanha.
  const [syncedQ, setSyncedQ] = useState(q)
  if (q !== syncedQ) {
    setSyncedQ(q)
    setValue(q ?? '')
  }
  useEffect(() => {
    const next = value.trim() || undefined
    if (next === q) return
    const timer = window.setTimeout(() => onSearch(next), 350)
    return () => window.clearTimeout(timer)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex gap-2 lg:hidden">
      <form role="search" className="relative min-w-0 flex-1" onSubmit={(event) => (event.preventDefault(), onSearch(value.trim() || undefined))}>
        <label htmlFor="mobile-search" className="sr-only">
          Buscar NFTs
        </label>
        <img src={searchIcon} alt="" width={22} height={22} className="pointer-events-none absolute top-[11.5px] left-3" />
        <input
          id="mobile-search"
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Buscar NFTs"
          maxLength={80}
          className="h-[45px] w-full rounded-[10px] bg-surface-card pr-3 pl-[42px] text-base leading-5 font-bold text-cream placeholder:text-sand focus-visible:outline-2 focus-visible:outline-copper-light sm:text-sm"
        />
      </form>
      <SheetTrigger asChild>
      <button
        type="button"
        aria-label={activeFilters ? `Filtros (${activeFilters} ativos)` : 'Filtros'}
        className={`relative grid size-[45px] shrink-0 place-items-center rounded-[14px] bg-linear-[137deg] from-copper/45 from-25% to-copper ${focusRing}`}
      >
        <img src={filterIcon} alt="" width={17} height={17} />
        {activeFilters > 0 && (
          <span aria-hidden className="absolute -top-1 -right-1 grid size-[18px] place-items-center rounded-full border-2 border-ink bg-cream text-tiny font-bold text-ink">
            {activeFilters}
          </span>
        )}
      </button>
      </SheetTrigger>
    </div>
  )
}

/** "NFT em destaque" da barra lateral: o primeiro NFT marcado como destaque, com link para o detalhe. */
export function FeaturedBanner() {
  const { data, isPending } = useQuery(featuredNftsQuery())
  const nft = data?.items[0]

  return (
    <section aria-labelledby="featured-title" className="relative bg-linear-to-b from-copper/10 to-copper/[0.03] pt-6 pb-1">
      <div className="flex flex-col gap-4">
        <h2 id="featured-title" className="flex flex-col items-center gap-4">
          <span className="w-full px-5 text-heading leading-8 font-bold text-copper-light">NFT EM DESTAQUE</span>
          <span className="w-full px-5 text-center text-lg leading-6 font-bold text-cream">OFERTA LIMITADA</span>
        </h2>
        {isPending ? (
          <Skeleton className="h-[368px] w-full rounded-[22px]" />
        ) : nft ? (
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={`block rounded-[22px] ${focusRing}`}>
            <NftImage src={nft.image} alt={`${nft.name}, em destaque`} sizes="310px" className="h-[368px] w-full rounded-[22px] object-cover" />
          </Link>
        ) : null}
      </div>
      {/* Detalhes decorativos do Figma. */}
      <span aria-hidden className="absolute top-[299px] left-4 size-[22px] rounded-[7px] border-2 border-copper opacity-20" />
      <span aria-hidden className="absolute top-[343px] left-[248px] size-[45px] rounded-[29px] bg-linear-[145deg] from-copper/30 from-46% to-copper/0" />
      <span aria-hidden className="absolute top-[105px] left-[38px] size-[15px] rounded-[29px] bg-linear-[145deg] from-copper/30 from-46% to-copper/0" />
    </section>
  )
}

const PROMOS = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    art: ART.shades,
    search: { tab: 'new' as const },
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    art: ART.baron,
    search: { category: 'digital-art' },
  },
]

/** Dois cards promocionais; "Explorar" aplica o filtro correspondente no catálogo. */
export function Promos() {
  return (
    <section aria-label="Destaques do mercado" className="grid gap-7 lg:grid-cols-2">
      {PROMOS.map((promo) => (
        <article key={promo.title[0]} className="relative grid min-w-0 overflow-hidden rounded-lg bg-surface-card sm:min-h-[250px] sm:grid-cols-[44%_minmax(0,1fr)]">
          <div className="relative h-[220px] sm:h-auto sm:min-h-[250px]">
            <img src={promo.art} alt="" width={292} height={250} loading="lazy" decoding="async" className="absolute inset-0 size-full rounded-[18px] object-cover" />
          </div>
          <div className="relative z-10 flex min-w-0 flex-col items-start gap-3 p-6 text-left sm:items-end sm:gap-3 sm:px-6 sm:text-right">
            <h2 className="text-lg leading-6 font-bold text-cream">
              {promo.title[0]}
              <br />
              {promo.title[1]}
            </h2>
            <p className="max-w-[263px] text-sm leading-6 text-sand-light">{promo.text}</p>
            <Button asChild className="mt-auto h-auto min-h-11 w-full font-bold sm:w-[140px]">
              <Link to="/" search={promo.search} hash="catalogo">
                Explorar
                <img src={arrowRight} alt="" width={18} height={18} className="size-[18px] -rotate-90 p-[3.5px_4.5px]" />
              </Link>
            </Button>
          </div>
          <img src={promoMask} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full max-w-none" />
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', art: ART.baron },
  { date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', art: ART.shades },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', art: ART.bucket },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', art: ART.headphones },
]

/** Blog editorial: conteúdo estático (as páginas de artigo estão fora do escopo, então não há link). */
export function Blog() {
  return (
    <section id="aprenda" aria-labelledby="blog-title" className="flex scroll-mt-6 flex-col items-center gap-6 lg:gap-10">
      <div className="flex flex-col gap-3 text-center">
        <h2 id="blog-title" className="text-2xl leading-8 font-bold text-cream-light sm:text-[28px]">
          Diário da Cunhagem
        </h2>
        <p className="max-w-[65ch] text-sm leading-6 text-sand-light">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[repeat(4,268px)]">
        {POSTS.map((post) => (
          <article key={post.title} className="flex flex-col overflow-hidden rounded-lg bg-surface-card">
            <img src={post.art.replace('.webp', '-640.webp')} alt="" width={268} height={195} loading="lazy" decoding="async" className="h-[195px] w-full object-cover" />
            <div className="flex flex-1 flex-col gap-2 p-6 lg:px-4 lg:pt-3 lg:pb-4">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 font-medium text-sand-light"><span>{post.date}</span><span aria-hidden>·</span><span>Leitura de {post.read}</span></p>
              <h3 className="text-base leading-6 font-bold text-cream-light">{post.title}</h3>
              <p className="text-sm leading-6 text-sand-light lg:text-xs lg:leading-5">{post.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
