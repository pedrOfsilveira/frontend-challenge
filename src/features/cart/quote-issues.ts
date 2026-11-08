import type { Cart, QuoteIssue } from '@/api/contracts'
import { formatEth } from '@/lib/format'

/** Ajustes que o servidor fez na cotação, em frases para o usuário. */
export function describeIssue(issue: QuoteIssue, cart: Cart) {
  const line = 'nftId' in issue ? cart.items.find((l) => l.nftId === issue.nftId && l.editionId === issue.editionId) : undefined
  const name = line ? `${line.name} (${line.editionLabel})` : 'Um item'
  switch (issue.type) {
    case 'sold_out':
      return `${name} esgotou e ficou fora do total.`
    case 'quantity_reduced':
      return `${name}: só ${issue.to} disponível(is), a cotação considera ${issue.to} de ${issue.from}.`
    case 'price_changed':
      return `${name} mudou de ${formatEth(issue.fromEth)} para ${formatEth(issue.toEth)}.`
    case 'coupon_removed':
      return issue.reason === 'expired'
        ? `O cupom ${issue.code} expirou e não foi aplicado.`
        : issue.reason === 'minimum_not_met'
          ? `O cupom ${issue.code} exige um subtotal maior e não foi aplicado.`
          : `O cupom ${issue.code} não é mais válido.`
  }
}
