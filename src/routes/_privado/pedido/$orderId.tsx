import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useRef } from 'react'
import closeIcon from '@/assets/figma/close.svg'
import thankYou from '@/assets/figma/thank-you.svg'
import type { Order } from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { privateScope, queryKeys } from '@/api/query-keys'
import { SiteHeader } from '@/components/layout/site-header'
import { Skeleton } from '@/components/ui/skeleton'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { NftImage } from '@/features/catalog/nft-image'
import { PROVIDER_LABELS } from '@/features/checkout/form'
import { orderQuery } from '@/features/orders/queries'
import { usePrivateScope } from '@/features/session/use-session'
import { eth } from '@/lib/eth'
import { formatEth } from '@/lib/format'

export const Route = createFileRoute('/_privado/pedido/$orderId')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(orderQuery(privateScope(), params.orderId))
  },
  component: OrderPage,
})

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "29 Jul, 2026", como no Figma (meses em português). */
const formatDate = (iso: string) => {
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`
}
/** "0xA91F…E82C". */
const shortHash = (hash: string) => `0x${hash.slice(2, 6).toUpperCase()}…${hash.slice(-4).toUpperCase()}`
const EXPLORER: Record<Order['network'], string> = { ethereum: 'Etherscan', polygon: 'Polygonscan' }

function OrderPage() {
  const { orderId } = Route.useParams()
  const scope = usePrivateScope()
  const queryClient = useQueryClient()
  const order = useQuery(orderQuery(scope, orderId))
  const status = order.data?.status

  // Ao virar estado final, carrinho e estoque mudaram no servidor (o evento já faz isso; aqui cobre o polling).
  const previous = useRef(status)
  useEffect(() => {
    if (previous.current === 'pending' && status && status !== 'pending') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.cart(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
    }
    previous.current = status
  }, [status, scope, queryClient])

  return (
    <>
      <SiteHeader section="market" />
      <main className="page-container flex justify-center py-8 lg:py-16">
        {order.data ? (
          <Receipt order={order.data} />
        ) : order.isError ? (
          <div role="alert" className="flex w-full max-w-[578px] flex-col items-start gap-4 rounded-lg border border-border bg-surface-card p-6">
            <h1 className="text-heading font-bold text-cream">
              {isApiError(order.error) && order.error.code === 'NOT_FOUND' ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}
            </h1>
            <p className="text-sand-light">O link pode estar errado ou o pedido é de outra conta.</p>
            <Link to="/" className={cn('rounded-[5px] bg-copper px-4 py-3 text-sm font-bold text-ink', focusRing)}>
              Voltar ao mercado
            </Link>
          </div>
        ) : (
          <div aria-busy="true" aria-label="Carregando pedido" className="flex w-full max-w-[578px] flex-col gap-4 bg-surface-card p-9">
            <Skeleton className="mx-auto size-20 rounded-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </main>
    </>
  )
}

function Receipt({ order }: { order: Order }) {
  const heading = useRef<HTMLHeadingElement>(null)
  // Leva o foco ao título quando o status muda (leitor de tela ouve o resultado).
  useEffect(() => heading.current?.focus(), [order.status])

  const network = NETWORK_LABELS[order.network]
  const hasDiscount = !eth.isZero(order.discountEth)

  return (
    <article aria-labelledby="order-title" className="relative flex w-full max-w-[578px] flex-col bg-surface-card shadow-[0_0_40px_rgba(10,6,4,0.45)]">
      <Link to="/" aria-label="Fechar e voltar ao mercado" className={cn('absolute top-4 right-4 grid size-8 place-items-center rounded-sm', focusRing)}>
        <img src={closeIcon} alt="" width={18} height={17.35} />
      </Link>

      {/* Cabeçalho por status */}
      <header className="flex min-h-[156px] flex-col items-center justify-center gap-4 px-10 py-6 text-center">
        {order.status === 'confirmed' ? (
          // Momento de destaque: o selo carimba e uma onda cobre se espalha uma vez.
          <span key="seal" aria-hidden className="relative grid place-items-center">
            <span className="seal-ring absolute size-24 animate-seal-ring rounded-full border-2 border-copper" />
            <img src={thankYou} alt="" width={65.16} height={80} className="seal-stamp relative animate-seal-stamp" />
          </span>
        ) : order.status === 'pending' ? (
          <span aria-hidden className="size-14 rounded-full border-4 border-copper/30 border-t-copper motion-safe:animate-spin" />
        ) : (
          <span aria-hidden className="grid size-14 animate-rise-in place-items-center rounded-full border-2 border-[#f0805f] text-2xl font-bold text-[#f0805f]">
            !
          </span>
        )}
        <h1
          key={order.status}
          id="order-title"
          ref={heading}
          tabIndex={-1}
          className={cn('text-base leading-5 font-bold text-sand-light outline-none', order.status !== 'pending' && 'animate-rise-in [animation-delay:180ms]')}
        >
          {order.status === 'confirmed'
            ? 'Seus NFTs agora estão na sua carteira'
            : order.status === 'pending'
              ? 'Processando o pagamento…'
              : 'Pagamento recusado'}
        </h1>
        <p role="status" className="text-sm text-sand">
          {order.status === 'pending'
            ? 'Aguardando a confirmação da rede. Você pode sair desta tela: o resultado fica salvo no pedido.'
            : order.status === 'declined'
              ? (order.declineReason ?? 'Nenhum valor foi cobrado.')
              : null}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-y-3 border-y border-copper px-6 py-3 text-sand-light sm:flex sm:min-h-[65px] sm:items-center sm:justify-between sm:gap-4 sm:px-9">
        <Meta label="ID da transação" bold>
          {order.transaction ? <span title={order.transaction.hash}>{shortHash(order.transaction.hash)}</span> : '—'}
        </Meta>
        <Meta label="Data">{formatDate(order.createdAt)}</Meta>
        <Meta label="Total">{formatEth(order.totalEth)}</Meta>
        <Meta label="Carteira" bold>
          {PROVIDER_LABELS[order.collector.provider]}
        </Meta>
      </dl>

      <section aria-labelledby="details-title" className="flex flex-col gap-3 px-6 pt-5 pb-12 sm:px-11">
        <h2 id="details-title" className="text-[15px] leading-4 font-bold text-cream">
          Detalhes da transação
        </h2>
        <table className="w-full border-separate border-spacing-y-3 text-left">
          <caption className="sr-only">Itens do pedido {order.id}</caption>
          <thead>
            <tr className="text-base leading-4 text-cream">
              <th scope="col" className="border-b border-copper/35 pb-3 font-bold">
                NFTs
              </th>
              <th scope="col" className="border-b border-copper/35 px-2 pb-3 text-center font-bold">
                <span className="sm:hidden">Qtd.</span>
                <span className="hidden sm:inline">Edições</span>
              </th>
              <th scope="col" className="border-b border-copper/35 pb-3 pl-2 text-right font-medium">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={`${line.nftId}:${line.editionId}`} className="h-[70px]">
                <td className="p-0">
                  <div className="flex items-center gap-3">
                    <NftImage src={line.image} alt="" sizes="70px" className="size-[52px] shrink-0 rounded-lg object-cover sm:size-[70px]" />
                    <div className="flex min-w-0 flex-col gap-1.5 leading-4">
                      <span className="text-sm font-bold text-cream sm:text-base">{line.name}</span>
                      <span className="text-xs text-sand sm:text-sm">ID do token: {line.tokenId}</span>
                      <span className="text-xs text-sand">Edição {line.editionLabel}</span>
                    </div>
                  </div>
                </td>
                <td className="text-center text-sm whitespace-nowrap text-sand-light">(x {line.quantity})</td>
                <td className="text-right text-base leading-4 font-bold whitespace-nowrap text-copper-light sm:text-lg">{formatEth(line.lineTotalEth)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto flex w-full max-w-[321px] flex-col gap-3 border-b border-copper/35 pb-3 whitespace-nowrap">
          {hasDiscount && (
            <>
              <Total label="Subtotal" value={formatEth(order.subtotalEth)} />
              <Total label={order.couponCode ? `Cupom ${order.couponCode}` : 'Desconto'} value={`(-) ${formatEth(order.discountEth)}`} />
            </>
          )}
          <Total label="Taxa de rede" value={formatEth(order.networkFeeEth)} />
          <div className="flex items-center justify-between font-bold">
            <dt className="text-base leading-4 text-cream">Total</dt>
            <dd className="text-lg leading-4 text-copper-light">{formatEth(order.totalEth)}</dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-col items-center gap-5 text-center">
          {order.status === 'confirmed' && order.transaction ? (
            <>
              <p className="text-sm leading-[22px] text-sand-light">
                Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
              </p>
              <a
                href={order.transaction.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('rounded-[5px] bg-copper p-4 text-base leading-4 font-bold text-ink hover:bg-copper-light', focusRing)}
              >
                Ver no {EXPLORER[order.network]}
                <span className="sr-only"> (abre em outra aba; transação simulada)</span>
              </a>
            </>
          ) : order.status === 'declined' ? (
            <>
              <p className="text-sm leading-[22px] text-sand-light">Os itens continuam no seu carrinho. Revise a carteira e tente de novo.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/pagamento" className={cn('rounded-[5px] bg-copper p-4 text-base leading-4 font-bold text-ink hover:bg-copper-light', focusRing)}>
                  Tentar de novo
                </Link>
                <Link to="/carrinho" className={cn('rounded-[5px] border border-border-soft p-4 text-base leading-4 text-cream hover:border-copper', focusRing)}>
                  Ver carrinho
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm leading-[22px] text-sand-light">
              Pedido {order.id} na rede {network}. As unidades ficam reservadas para você enquanto o pagamento é processado.
            </p>
          )}
        </div>
      </section>
      <div aria-hidden className="h-2.5 bg-copper" />
    </article>
  )
}

function Meta({ label, bold, children }: { label: string; bold?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-copper/60 sm:[&:not(:first-child)]:pl-4">
      <dt className={cn('text-sm leading-4', bold && 'font-bold')}>{label}</dt>
      <dd className="text-[15px] whitespace-nowrap">{children}</dd>
    </div>
  )
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-cream">
      <dt className="text-[15px]">{label}</dt>
      <dd className="text-lg leading-4">{value}</dd>
    </div>
  )
}
