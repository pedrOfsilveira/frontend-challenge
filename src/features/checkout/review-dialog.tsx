import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { XIcon } from 'lucide-react'
import type { CollectorDetails, Quote, Wallet } from '@/api/contracts'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { NftImage } from '@/features/catalog/nft-image'
import { formatEth } from '@/lib/format'
import { focusRing } from './fields'
import { PROVIDER_LABELS, walletSummary } from './form'
import type { PlaceOrderFailure } from './use-place-order'

export interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote | undefined
  /** A cotação mudou depois que a pessoa abriu a revisão: precisa confirmar de novo. */
  changed: boolean
  onAcknowledge: () => void
  refreshing: boolean
  collector: CollectorDetails
  wallet: Wallet
  connection: { connecting: boolean; disconnecting: boolean; error: string | null; onConnect: () => void; onDisconnect: () => void }
  submitting: boolean
  failure: PlaceOrderFailure | null
  onConfirm: () => void
}

/**
 * Etapa de revisão antes de enviar (R-6.1). Mostra exatamente o que vai ser cobrado (a cotação
 * atual da API), para quem e de qual carteira. A carteira precisa estar conectada para confirmar.
 */
export function ReviewDialog(props: ReviewDialogProps) {
  const { quote, collector, wallet, connection, failure } = props
  const connected = wallet.connection === 'connected'
  const blocked = !quote || quote.lines.length === 0 || props.refreshing || props.submitting || !connected
  const summary = walletSummary(wallet)

  return (
    <Dialog open={props.open} onOpenChange={(open) => !props.submitting && props.onOpenChange(open)}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[14px] border-border bg-surface-card p-0 text-cream sm:max-w-[578px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-copper/35 px-6 pt-6 pb-4 sm:px-9">
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-lg leading-6 font-bold text-cream">Revise sua compra</DialogTitle>
            <DialogDescription className="text-sm text-sand-light">
              Confira os valores e a carteira. Nada é cobrado antes de você confirmar.
            </DialogDescription>
          </div>
          <DialogClose aria-label="Fechar revisão" disabled={props.submitting} className={cn('rounded-sm p-1 text-sand-light hover:text-cream', focusRing)}>
            <XIcon className="size-[18px]" />
          </DialogClose>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5 sm:px-9">
          {props.changed && (
            <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-copper bg-surface-dark p-3 text-sm">
              <p className="text-cream">
                {failure?.kind === 'quote-changed' ? failure.message : 'Preço, disponibilidade ou cupom mudaram desde que você abriu a revisão.'} Confira os
                novos valores abaixo.
              </p>
              <button type="button" onClick={props.onAcknowledge} className={cn('font-bold text-copper-light underline underline-offset-4', focusRing)}>
                Revisei os novos valores
              </button>
            </div>
          )}

          <section aria-labelledby="review-items" className="flex flex-col gap-3">
            <h3 id="review-items" className="text-base leading-4 font-bold">
              NFTs
            </h3>
            {quote ? (
              <ul aria-busy={props.refreshing} className="flex flex-col gap-2">
                {quote.lines.map((line) => (
                  <li key={`${line.nftId}:${line.editionId}`} className="flex items-center gap-3 bg-ink/40 pr-3">
                    <NftImage src={line.image} alt="" sizes="48px" className="size-12 shrink-0 rounded-md object-cover" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1 leading-4">
                      <span className="truncate text-sm font-bold">{line.name}</span>
                      <span className="text-xs text-sand">
                        Edição {line.editionLabel} · {formatEth(line.unitPriceEth)} cada
                      </span>
                    </span>
                    <span className="text-sm whitespace-nowrap text-sand-light">(x {line.quantity})</span>
                    <span className="text-sm font-bold whitespace-nowrap text-copper-light">{formatEth(line.lineTotalEth)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-sand-light">Calculando valores…</p>
            )}
          </section>

          {quote && (
            <dl aria-busy={props.refreshing} className="flex flex-col gap-2 border-y border-copper/35 py-3 text-sm">
              <Row label="Subtotal" value={formatEth(quote.subtotalEth)} />
              <Row label={quote.coupon?.label ?? 'Desconto'} value={`(-) ${formatEth(quote.discountEth)}`} />
              <Row label={`Taxa de rede (${NETWORK_LABELS[quote.network]})`} value={formatEth(quote.networkFeeEth)} />
              <div className="flex justify-between gap-3 pt-1 text-base font-bold">
                <dt>Total</dt>
                <dd className="text-lg leading-5 text-copper-light">{formatEth(quote.totalEth)}</dd>
              </div>
            </dl>
          )}

          <section aria-labelledby="review-wallet" className="flex flex-col gap-3">
            <h3 id="review-wallet" className="text-base leading-4 font-bold">
              Carteira
            </h3>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <p className="text-sm leading-5">
                <span className="font-bold">{wallet.nickname}</span> · {PROVIDER_LABELS[collector.provider]}
                <br />
                <span className="text-sand-light">
                  {summary.id} · {NETWORK_LABELS[collector.network]}
                </span>
                <br />
                <span role="status" className={connected ? 'text-copper-light' : 'text-sand'}>
                  {connected ? 'Conectada' : 'Desconectada: conecte para confirmar'}
                </span>
              </p>
              {connected ? (
                <button
                  type="button"
                  onClick={connection.onDisconnect}
                  disabled={connection.disconnecting || props.submitting}
                  className={cn('rounded-[3px] border border-border-soft px-3 py-2 text-sm text-sand-light hover:text-cream disabled:opacity-60', focusRing)}
                >
                  {connection.disconnecting ? 'Desconectando…' : 'Desconectar'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={connection.onConnect}
                  disabled={connection.connecting}
                  className={cn('rounded-[3px] bg-copper px-3 py-2 text-sm font-bold text-ink hover:bg-copper-light disabled:opacity-60', focusRing)}
                >
                  {connection.connecting ? 'Aguardando a carteira…' : 'Conectar carteira'}
                </button>
              )}
            </div>
            {connection.error && (
              <p role="alert" className="text-xs text-[#ff8a7a]">
                {connection.error}
              </p>
            )}
            <p className="text-xs text-sand">
              Recibo para {collector.displayName} ({collector.email}) · {collector.ensName}
            </p>
          </section>

          {failure && failure.kind !== 'quote-changed' && (
            <div role="alert" className="text-sm text-[#ff8a7a]">
              <p>{failure.message}</p>
              {failure.kind === 'order-pending' && failure.orderId && (
                <Link to="/pedido/$orderId" params={{ orderId: failure.orderId }} className={cn('font-bold text-copper-light underline underline-offset-4', focusRing)}>
                  Acompanhar o pedido em processamento
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose
              disabled={props.submitting}
              className={cn('h-[45px] rounded-[8px] border border-border-soft px-5 text-[15px] text-cream hover:border-copper disabled:opacity-60', focusRing)}
            >
              Voltar e editar
            </DialogClose>
            <button
              type="button"
              onClick={props.onConfirm}
              disabled={blocked || props.changed}
              aria-describedby={!connected ? 'review-wallet' : undefined}
              className={cn('h-[45px] rounded-[8px] bg-copper px-5 text-[15px] font-bold text-ink hover:bg-copper-light disabled:cursor-not-allowed disabled:opacity-50', focusRing)}
            >
              {props.submitting ? 'Enviando pedido…' : quote ? `Confirmar e pagar ${formatEth(quote.totalEth)}` : 'Confirmar e pagar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-sand-light">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
