import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import facebook from '@/assets/figma/social-facebook.svg'
import instagram from '@/assets/figma/social-instagram.svg'
import linkedin from '@/assets/figma/social-linkedin.svg'
import twitter from '@/assets/figma/social-twitter.svg'
import youtube from '@/assets/figma/social-youtube.svg'
import type { Category } from '@/api/contracts'
import { emailRule } from '@/api/contracts'
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

/** Newsletter: valida o e-mail, mas avisa que as inscrições ainda não abriram (não finge sucesso). */
function Newsletter() {
  const id = useId()
  const [message, setMessage] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const value = new FormData(event.currentTarget).get('email')
        const parsed = emailRule.safeParse(value)
        setMessage(parsed.success ? 'As inscrições na newsletter ainda não estão abertas.' : (parsed.error.issues[0]?.message ?? 'E-mail inválido.'))
      }}
    >
      <label htmlFor={id} className="text-lg leading-4 font-bold text-cream">
        Antecipe-se ao próximo lançamento
      </label>
      <div className="mt-1 flex h-10 overflow-hidden rounded-md bg-surface-dark shadow-[0_0_10px_rgba(10,6,4,0.45)]">
        <input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          aria-describedby={`${id}-msg`}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-cream placeholder:text-sand focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-copper-light"
        />
        <button type="submit" className="w-[85px] rounded-r-md bg-copper pl-4 pr-1 text-lg leading-4 font-bold text-ink hover:bg-copper-light">
          Enviar
        </button>
      </div>
      <p id={`${id}-msg`} role="status" className="min-h-[22px] text-[13px] leading-[22px] text-sand-light">
        {message ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}

function LinkColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 text-cream">
      <h2 className="text-lg leading-4 font-bold">{title}</h2>
      <ul className="text-sm leading-[30px]">{children}</ul>
    </div>
  )
}

/** Rodapé do Figma (desktop); no mobile as colunas empilham. */
export function SiteFooter() {
  return (
    <footer className="page-container pb-6">
      <div className="bg-surface-card px-4 py-8 lg:h-[250px] lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:flex lg:items-stretch lg:justify-between lg:gap-0">
          {FEATURES.map((feature) => (
            <div key={feature.mark} className="flex flex-col gap-3 px-4 lg:flex-1 lg:border-r lg:border-copper">
              <span aria-hidden className="grid size-[74px] place-items-center rounded-full bg-copper text-heading font-bold text-ink">
                {feature.mark}
              </span>
              <h2 className="text-[17px] leading-4 font-bold text-cream">{feature.title}</h2>
              <p className="w-[204px] max-w-full text-sm leading-[22px] text-sand-light">{feature.text}</p>
            </div>
          ))}
          <div className="px-4 lg:w-[357px]">
            <Newsletter />
          </div>
        </div>
      </div>

      <div className="grid gap-4 bg-surface-dark px-8 py-8 text-sm leading-[22px] text-cream sm:grid-cols-2 lg:h-[88px] lg:grid-cols-[1fr_1fr_1fr_228px] lg:items-center lg:gap-[92px] lg:py-0">
        <span className="font-bold tracking-[0.1em]">KURIO</span>
        <p>
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="hover:text-copper-light">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-copper-light">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-8 bg-surface-card p-8 sm:grid-cols-2 lg:h-[236px] lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[124px]">
        <LinkColumn title="Meu perfil">
          <li>
            <Link to="/perfil" className="hover:text-copper-light">
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
              <Link to="/" search={{ category }} hash="catalogo" className="hover:text-copper-light">
                {CATEGORY_LABELS[category]}
              </Link>
            </li>
          ))}
        </LinkColumn>
        <div className="flex flex-col gap-8">
          <div className="flex w-[190px] flex-col gap-5">
            <h2 className="text-lg leading-4 font-bold text-cream">Redes sociais</h2>
            <ul className="flex gap-2.5" aria-label="Redes sociais (perfis ainda não publicados)">
              {SOCIAL.map((item) => (
                <li key={item.name}>
                  <img src={item.src} alt={item.name} width={32} height={32} className="size-[30px]" />
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg leading-4 font-bold text-cream">Carteiras compatíveis</h2>
            <p className="flex h-[26px] items-center justify-center rounded-md border border-border-soft bg-surface-dark text-[9px] font-bold tracking-[0.1px] whitespace-pre text-copper-light">
              {'METAMASK  •  WALLETCONNECT  •  COINBASE'}
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-sm leading-[30px] text-cream">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
