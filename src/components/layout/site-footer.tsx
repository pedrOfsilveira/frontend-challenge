import { Link } from '@tanstack/react-router'
import facebook from '@/assets/figma/social-facebook.svg'
import instagram from '@/assets/figma/social-instagram.svg'
import linkedin from '@/assets/figma/social-linkedin.svg'
import twitter from '@/assets/figma/social-twitter.svg'
import youtube from '@/assets/figma/social-youtube.svg'
import type { Category } from '@/api/contracts'
import { CATEGORY_LABELS } from '@/features/catalog/search'

const FEATURES = [
  { mark: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { mark: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { mark: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const FOOTER_CATEGORIES: Category[] = ['digital-art', 'photography', 'music', '3d-art', 'utility']
const SOCIAL = [
  { src: facebook, name: 'Facebook' },
  { src: instagram, name: 'Instagram' },
  { src: twitter, name: 'Twitter' },
  { src: linkedin, name: 'LinkedIn' },
  { src: youtube, name: 'YouTube' },
]

/** State the current availability before asking the visitor for any data. */
function Newsletter() {
  return (
    <section aria-label="Newsletter" className="flex min-w-0 flex-col gap-3">
      <h2 className="text-lg leading-normal font-bold text-cream">Antecipe-se ao próximo lançamento</h2>
      <p className="text-sm leading-6 text-sand-light">As inscrições na newsletter ainda não estão abertas.</p>
    </section>
  )
}

function LinkColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <details className="min-w-0 border-b border-border-soft text-cream sm:hidden">
        <summary className="cursor-pointer py-3 text-sm leading-6 font-bold focus-visible:outline-2 focus-visible:outline-copper-light">{title}</summary>
        <ul className="pb-3 text-sm leading-[30px]">{children}</ul>
      </details>
      <div className="hidden min-w-0 flex-col gap-2 text-cream sm:flex">
        <h2 className="text-lg leading-6 font-bold">{title}</h2>
        <ul className="text-sm leading-[30px]">{children}</ul>
      </div>
    </>
  )
}

function FooterExtras() {
  return (
      <div className="bg-surface-card px-6 py-6 sm:px-4 sm:py-8 xl:min-h-[250px] xl:px-8">
        <div className="grid min-w-0 gap-5 sm:gap-8 md:grid-cols-2 xl:flex xl:items-stretch xl:justify-between xl:gap-0">
          {FEATURES.map((feature) => (
            <div key={feature.mark} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-x-3 gap-y-1 sm:flex sm:flex-col sm:gap-3 sm:px-4 xl:flex-1 xl:border-r xl:border-copper">
              <span aria-hidden className="row-span-2 grid size-10 place-items-center rounded-full bg-copper text-lg sm:size-[74px] sm:text-heading font-bold text-ink">
                {feature.mark}
              </span>
              <h2 className="text-sm leading-6 font-bold text-cream sm:text-[17px]">{feature.title}</h2>
              <p className="max-w-full text-xs leading-5 sm:w-[204px] sm:text-sm sm:leading-[22px] text-sand-light">{feature.text}</p>
            </div>
          ))}
          <div className="min-w-0 border-t border-border-soft pt-5 sm:border-0 sm:px-4 sm:pt-0 xl:w-[357px]">
            <Newsletter />
          </div>
        </div>
      </div>
  )
}

/** Rodapé do Figma; no mobile, benefícios compactos e menus recolhíveis. */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full pb-6 [overflow-wrap:anywhere] lg:max-w-[calc(var(--container-page)+3rem)] lg:px-6">
      <div className="hidden sm:block"><FooterExtras /></div>

      <div className="grid grid-cols-1 gap-3 bg-surface-dark px-6 py-5 sm:gap-4 sm:px-8 sm:py-8 text-sm leading-[22px] text-cream sm:grid-cols-2 lg:min-h-[88px] lg:grid-cols-[repeat(3,minmax(0,1fr))_228px] lg:items-center lg:gap-8 lg:py-4 xl:gap-[92px] xl:py-0">
        <span className="font-bold tracking-[0.1em]">KURIO</span>
        <p>
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="inline-flex min-h-11 items-center py-1 hover:text-copper-light sm:min-h-0 sm:py-0">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="inline-flex min-h-11 items-center py-1 hover:text-copper-light sm:min-h-0 sm:py-0">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid grid-cols-1 gap-0 bg-surface-card px-6 py-3 sm:grid-cols-2 sm:gap-8 sm:p-8 lg:min-h-[236px] lg:grid-cols-[repeat(3,minmax(0,1fr))_228px] xl:gap-[124px]">
        <LinkColumn title="Meu perfil">
          <li>
            <Link to="/perfil" className="inline-flex min-h-11 items-center py-1 hover:text-copper-light sm:min-h-0 sm:py-0">
              Meu perfil
            </Link>
          </li>
          {/* Fora do escopo: texto simples. */}
          <li>Minha coleção</li>
          <li>Atividade</li>
          <li>Estúdio do criador</li>
          <li>Lista de interesse</li>
        </LinkColumn>
        <LinkColumn title="Central de ajuda">
          <li>Central de ajuda</li>
          <li>Como comprar NFTs</li>
          <li>Carteira e segurança</li>
          <li>Política do mercado</li>
          <li>Denunciar item</li>
        </LinkColumn>
        <LinkColumn title="Coleções">
          {FOOTER_CATEGORIES.map((category) => (
            <li key={category}>
              <Link to="/" search={{ category }} hash="catalogo" className="inline-flex min-h-11 items-center py-1 hover:text-copper-light sm:min-h-0 sm:py-0">
                {CATEGORY_LABELS[category]}
              </Link>
            </li>
          ))}
        </LinkColumn>
        <div className="flex min-w-0 flex-col items-center gap-6 py-6 sm:items-start sm:gap-8 sm:py-0">
          <div className="flex max-w-full flex-col items-center gap-3 sm:items-start sm:gap-5">
            <h2 className="text-lg leading-6 font-bold text-cream">Redes sociais</h2>
            <ul className="flex max-w-full flex-wrap items-center justify-center gap-[10px]" aria-label="Redes sociais (perfis ainda não publicados)">
              {SOCIAL.map((item) => (
                <li key={item.name} className="grid size-[32px] shrink-0 place-items-center">
                  <img src={item.src} alt={item.name} width={32} height={32} className="block" />
                </li>
              ))}
            </ul>
          </div>
          <div className="flex max-w-full flex-col gap-3">
            <h2 className="text-lg leading-6 font-bold text-cream">Carteiras compatíveis</h2>
            <p className="flex min-h-[26px] items-center justify-center rounded-md border border-border-soft bg-surface-dark px-2 py-1 text-center text-[11px] leading-5 sm:text-[9px] sm:leading-4 font-bold tracking-[0.1px] text-copper-light">
              {'METAMASK  •  WALLETCONNECT  •  COINBASE'}
            </p>
          </div>
        </div>
      </div>

      <details className="border-t border-border-soft bg-surface-card px-6 sm:hidden">
        <summary className="cursor-pointer py-3 text-sm leading-6 font-bold text-cream focus-visible:outline-2 focus-visible:outline-copper-light">Sobre a Kurio e novidades</summary>
        <div className="-mx-6"><FooterExtras /></div>
      </details>

      <p className="px-6 pt-3 text-center text-xs leading-5 text-cream sm:text-sm sm:leading-[30px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
