import { test, expect, type Page } from '@playwright/test'
import { addEmerald, ready, reset, reviewPurchase, signIn } from './helpers'
import { connectWallet, openReview, openReviewFromCart, orderCount, payButton, recordOrderPosts } from './gap-helpers'

/**
 * Checkout: mudanças do servidor durante a revisão, carteira, validade da cotação, sessão e
 * idempotência. Operações do usuário pela interface; `__kurioMock` só muda condições do servidor.
 * Cada teste chama `reset` (o teste de relógio instala o relógio antes da primeira navegação).
 */

const receiptHeading = (page: Page) => page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })
const cartQuantity = (page: Page, name: RegExp) => page.getByRole('group', { name }).getByRole('status')

test('estoque abaixo da quantidade durante a revisão exige nova confirmação e mantém só o que não foi comprado', async ({ page }) => {
  await reset(page)
  await addEmerald(page)
  const increase = page.getByRole('button', { name: 'Aumentar quantidade', exact: true })
  await increase.click()
  await expect(cartQuantity(page, /Quantidade de Emerald Ape/)).toHaveText('2')
  await increase.click()
  await expect(cartQuantity(page, /Quantidade de Emerald Ape/)).toHaveText('3')
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  const review = await reviewPurchase(page)
  await expect(review).toContainText('(x 3)')
  await expect.poll(() => page.evaluate(() => window.__kurioMock!.realtime.connections().some((c) => c.userId === 'user_nova'))).toBe(true)

  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { available: 1 }))
  await expect(review.getByRole('button', { name: 'Revisei os novos valores' })).toBeVisible()
  await expect(payButton(review)).toBeDisabled()
  await expect(review).toContainText('(x 1)')
  await review.getByRole('button', { name: 'Revisei os novos valores' }).click()
  await expect(payButton(review)).toHaveText('Confirmar e pagar 1.206 ETH')
  await payButton(review).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
  const order = await page.evaluate(() => window.__kurioMock!.snapshot().orders[0]!)
  expect(order.lines.map((l) => [l.nftId, l.quantity])).toEqual([['emerald-ape-042', 1]])
  expect(order.totalEth).toBe('1.206')

  await page.evaluate(() => window.__kurioMock!.settlePendingOrders('confirm'))
  await expect(receiptHeading(page)).toBeVisible()
  await expect(page.getByRole('table')).toContainText('Emerald Ape #042')
  // O cabeçalho mobile do pagamento/recibo não tem atalho para o carrinho: acesso direto.
  await page.goto('/carrinho')
  // Comprou 1 de 3: as 2 unidades não compradas continuam no carrinho (agora sem estoque).
  await expect(cartQuantity(page, /Quantidade de Emerald Ape/)).toHaveText('2')
  expect(await orderCount(page)).toBe(1)
})

test('edição esgotada durante a revisão bloqueia o pagamento sem criar pedido nem perder o carrinho', async ({ page }) => {
  await reset(page)
  await addEmerald(page)
  const review = await reviewPurchase(page)
  await expect.poll(() => page.evaluate(() => window.__kurioMock!.realtime.connections().some((c) => c.userId === 'user_nova'))).toBe(true)
  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { available: 0 }))
  await expect(review.getByRole('button', { name: 'Revisei os novos valores' })).toBeVisible()
  await expect(payButton(review)).toBeDisabled()
  await expect(review.getByRole('listitem')).toHaveCount(0)
  await review.getByRole('button', { name: 'Revisei os novos valores' }).click()
  await expect(payButton(review)).toBeDisabled()
  await review.getByRole('button', { name: 'Voltar e editar' }).click()
  await expect(page.getByRole('list', { name: 'Ajustes na cotação' }).filter({ visible: true })).toContainText('Emerald Ape #042 (1/50) esgotou e ficou fora do total.')
  await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeDisabled()
  expect(await orderCount(page)).toBe(0)
  // O cabeçalho mobile do pagamento/recibo não tem atalho para o carrinho: acesso direto.
  await page.goto('/carrinho')
  await expect(page.getByRole('main')).toContainText('Emerald Ape #042')
})

test('cupom inválido é recusado e cupom que expira durante a revisão exige nova confirmação sem desconto', async ({ page, isMobile }) => {
  await reset(page)
  await addEmerald(page)
  const coupon = page.getByRole('textbox', { name: 'Código promocional', exact: true })
  await coupon.fill('NAOEXISTE')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Cupom inválido.')
  await expect(coupon).toHaveAttribute('aria-invalid', 'true')
  await coupon.fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  const summary = page.getByRole('region', { name: isMobile ? 'Resumo do pedido' : 'Resumo da carteira', exact: true })
  await expect(summary).toContainText('Cupom KURIO10 (10%)')

  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  const posts = recordOrderPosts(page)
  const review = await reviewPurchase(page)
  await expect(review).toContainText('Cupom KURIO10 (10%)')
  await expect(payButton(review)).toHaveText('Confirmar e pagar 1.087 ETH')

  // O cupom vence no servidor depois que a revisão abriu (sem evento): a API recusa a cotação.
  await page.evaluate(() => window.__kurioMock!.expireCoupon('KURIO10'))
  await payButton(review).click()
  await expect(review.getByRole('button', { name: 'Revisei os novos valores' })).toBeVisible()
  await expect(payButton(review)).toBeDisabled()
  expect(posts).toEqual([409])
  expect(await orderCount(page)).toBe(0)
  // A revisão precisa mostrar a cotação nova (sem desconto) antes de pedir outra confirmação.
  await expect(review).not.toContainText('Cupom KURIO10 (10%)')
  await review.getByRole('button', { name: 'Revisei os novos valores' }).click()
  await expect(payButton(review)).toHaveText('Confirmar e pagar 1.206 ETH')
  await payButton(review).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
  const order = await page.evaluate(() => window.__kurioMock!.snapshot().orders[0]!)
  expect(order.couponCode).toBeNull()
  expect(order.totalEth).toBe('1.206')
  expect(posts).toEqual([409, 201])
})

test('carteira: recusa, desconexão pelo usuário e queda no servidor são recuperáveis sem pedido duplicado', async ({ page }) => {
  await reset(page)
  await addEmerald(page)
  await page.evaluate(async () => {
    await window.__kurioMock!.setPaymentOutcome('hold')
    await window.__kurioMock!.setWalletConnection('reject')
  })
  const review = await openReviewFromCart(page)
  await expect(review.getByText('Desconectada: conecte para confirmar')).toBeVisible()
  await expect(payButton(review)).toBeDisabled()

  await review.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  await expect(review.getByRole('alert')).toHaveText('A conexão foi recusada na carteira. Tente novamente ou escolha outra carteira.')
  await expect(review.getByText('Desconectada: conecte para confirmar')).toBeVisible()
  await expect(payButton(review)).toBeDisabled()

  await page.evaluate(() => window.__kurioMock!.setWalletConnection('accept'))
  await connectWallet(review)
  await expect(review.getByRole('alert')).toBeHidden()
  await expect(payButton(review)).toBeEnabled()

  await review.getByRole('button', { name: 'Desconectar', exact: true }).click()
  await expect(review.getByText('Desconectada: conecte para confirmar')).toBeVisible()
  await expect(payButton(review)).toBeDisabled()
  await connectWallet(review)

  // A carteira cai do lado do servidor enquanto a tela ainda mostra "Conectada".
  const posts = recordOrderPosts(page)
  await page.evaluate(() => window.__kurioMock!.disconnectWallets())
  await payButton(review).click()
  await expect(review.getByRole('alert')).toHaveText('Conecte a carteira selecionada antes de confirmar.')
  await expect(review.getByText('Desconectada: conecte para confirmar')).toBeVisible()
  await expect(payButton(review)).toBeDisabled()
  expect(await orderCount(page)).toBe(0)
  await connectWallet(review)
  await payButton(review).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
  expect(posts).toEqual([409, 201])
  expect(await orderCount(page)).toBe(1)
})

test('cotação vencida (relógio controlado) é recusada e só segue após nova confirmação', async ({ page }) => {
  // Relógio falso instalado antes da primeira navegação; avança 11 min (validade: 10 min).
  await page.clock.install({ time: new Date('2026-11-09T12:00:00-03:00') })
  await reset(page)
  await addEmerald(page)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  const posts = recordOrderPosts(page)
  const review = await reviewPurchase(page)
  const quote = await page.evaluate(() => Object.values(window.__kurioMock!.snapshot().quotes).at(-1)!)
  expect(Date.parse(quote.expiresAt) - Date.parse(quote.issuedAt)).toBe(10 * 60_000)

  await page.clock.fastForward('11:00')
  await payButton(review).click()
  await expect(review.getByRole('alert')).toContainText('A cotação expirou. Confira os valores e confirme de novo.')
  await expect(payButton(review)).toBeDisabled()
  expect(posts).toEqual([409])
  expect(await orderCount(page)).toBe(0)
  await review.getByRole('button', { name: 'Revisei os novos valores' }).click()
  await expect(payButton(review)).toHaveText('Confirmar e pagar 1.206 ETH')
  await payButton(review).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
  expect(posts).toEqual([409, 201])
  expect(await orderCount(page)).toBe(1)
})

test('unidade adicionada durante pedido pendente continua no carrinho após a confirmação', async ({ page }) => {
  await reset(page)
  await addEmerald(page)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  const review = await reviewPurchase(page)
  await payButton(review).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()

  await page.goto('/nft/emerald-ape-042')
  await ready(page)
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
  await expect(cartQuantity(page, /Quantidade de Emerald Ape/)).toHaveText('2')
  await expect.poll(() => page.evaluate(() => window.__kurioMock!.realtime.connections().some((c) => c.userId === 'user_nova'))).toBe(true)

  // Pedido (1 unidade) confirmado enquanto o carrinho está aberto: sai só o que foi comprado.
  await page.evaluate(() => window.__kurioMock!.settlePendingOrders('confirm'))
  await expect(cartQuantity(page, /Quantidade de Emerald Ape/)).toHaveText('1')
  await page.reload()
  await ready(page)
  await expect(cartQuantity(page, /Quantidade de Emerald Ape/)).toHaveText('1')
  expect(await orderCount(page)).toBe(1)
})

test('sessão que expira com a revisão aberta volta ao pagamento com o rascunho preservado', async ({ page, isMobile }) => {
  await reset(page)
  await addEmerald(page)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await signIn(page)
  await expect(page).toHaveURL(/\/pagamento$/)
  if (isMobile) await page.getByRole('button', { name: 'Revisar dados', exact: true }).click()
  const note = page.getByLabel('Observação do colecionador (opcional)')
  await note.fill('Entregar na carteira fria, por favor.')
  await page.getByLabel(/^Nome de exibição/).fill('Nova S.')
  const posts = recordOrderPosts(page)
  const review = await openReview(page)
  await connectWallet(review)

  await page.evaluate(() => window.__kurioMock!.expireSessions())
  await payButton(review).click()
  await expect(page).toHaveURL(/\/entrar\?.*motivo=expirada/)
  await expect(page.getByText('Sua sessão expirou. Entre novamente para retomar de onde parou.')).toBeVisible()
  expect(posts).toEqual([401])
  expect(await orderCount(page)).toBe(0)

  await signIn(page)
  await expect(page).toHaveURL(/\/pagamento$/)
  if (isMobile) await page.getByRole('button', { name: 'Revisar dados', exact: true }).click()
  await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Entregar na carteira fria, por favor.')
  await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue('Nova S.')
  const resumed = await openReview(page)
  await expect(resumed).toContainText('Emerald Ape #042')
  await expect(resumed).toContainText('Recibo para Nova S.')
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  if (await resumed.getByRole('button', { name: 'Conectar carteira', exact: true }).isVisible()) await connectWallet(resumed)
  await payButton(resumed).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
  const order = await page.evaluate(() => window.__kurioMock!.snapshot().orders[0]!)
  expect(order.note).toBe('Entregar na carteira fria, por favor.')
  expect(order.collector.displayName).toBe('Nova S.')
  expect(posts.at(-1)).toBe(201)
})

/**
 * Evidência complementar de protocolo (fora do fluxo de usuário): a interface deriva a chave do
 * corpo, então "mesma chave + outro corpo" não é alcançável clicando. Aqui o transporte do
 * navegador fala com os handlers MSW diretamente; o efeito visível é conferido na interface depois.
 */
test('protocolo: mesma Idempotency-Key com outro corpo responde 409 sem criar outro pedido', async ({ page }) => {
  await reset(page)
  await addEmerald(page)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  await reviewPurchase(page)

  const result = await page.evaluate(async () => {
    const token = (JSON.parse(localStorage.getItem('kurio.session')!) as { token: string }).token
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-idempotency-key-0001' }
    const quote = (await (await fetch('/api/cart/quote?network=ethereum', { headers })).json()) as { id: string }
    const body = {
      quoteId: quote.id,
      walletId: 'wallet_user_nova_primary',
      note: null,
      collector: {
        displayName: 'Nova Sato', username: 'nova.sato', network: 'ethereum', profileName: 'nova',
        address: '0x7a42c9d1e8b3f40a6c2d9e1b7f3a8c4d2e6b19e8', secondaryAddressOrEns: null, provider: 'metamask',
        referralCode: 'NOVA2026', email: 'nova@kurio.dev', ensName: 'nova.kurio.eth',
      },
    }
    const post = async (payload: unknown) => {
      const response = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify(payload) })
      return { status: response.status, body: (await response.json()) as { id?: string; error?: { code: string } } }
    }
    const first = await post(body)
    const retry = await post(body)
    const changed = await post({ ...body, note: 'outro conteúdo' })
    return { first, retry, changed }
  })
  expect(result.first.status).toBe(201)
  expect(result.retry.status).toBe(200)
  expect(result.retry.body.id).toBe(result.first.body.id)
  expect(result.changed.status).toBe(409)
  expect(result.changed.body.error?.code).toBe('IDEMPOTENCY_CONFLICT')
  const orders = await page.evaluate(() => window.__kurioMock!.snapshot().orders)
  expect(orders).toHaveLength(1)
  expect(orders[0]!.note).toBeNull()

  // Efeito visível: o pagamento reconhece o único pedido pendente em vez de oferecer outra compra.
  await page.reload()
  await ready(page)
  await expect(page.getByRole('status').filter({ hasText: 'Você tem um pedido em processamento' })).toBeVisible()
  await page.getByRole('link', { name: 'Acompanhar pedido', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/pedido/${result.first.body.id}$`))
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
})

/** Total da cotação visível no resumo (desktop) ou no rodapé (mobile). */
const shownTotal = (page: Page, total: string) =>
  expect(page.getByText(`${total} ETH`, { exact: true }).filter({ visible: true }).first()).toBeVisible()

/** Leo (seed): Golden Beat #207 (0,99 ETH) no carrinho, Coinbase em Polygon e Reserva em Ethereum. */
async function leoCheckout(page: Page, isMobile: boolean) {
  await reset(page)
  await page.goto('/entrar?redirect=/pagamento')
  await signIn(page, 'leo@kurio.dev')
  await expect(page).toHaveURL(/\/pagamento$/)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  if (isMobile) await page.getByRole('button', { name: 'Revisar dados', exact: true }).click()
  return page.getByRole('combobox', { name: /^Rede\b/ })
}

test('troca de rede usa a carteira dessa rede e muda a taxa e o total', async ({ page, isMobile }) => {
  const networkField = await leoCheckout(page, isMobile)
  // Cotação da rede escolhida carregada antes de revisar (o caso "revisar durante a troca" está abaixo).
  await networkField.selectOption('polygon')
  await shownTotal(page, '0.992')
  let review = await openReview(page)
  await expect(review).toContainText('Coinbase')
  await expect(review).toContainText('Taxa de rede (Polygon)')
  await expect(payButton(review)).toHaveText('Confirmar e pagar 0.992 ETH')
  await review.getByRole('button', { name: 'Voltar e editar' }).click()
  await expect(review).toBeHidden()

  await networkField.selectOption('ethereum')
  await shownTotal(page, '1.006')
  review = await openReview(page)
  await expect(review).toContainText('Reserva')
  await expect(review).toContainText('Taxa de rede (Ethereum)')
  await connectWallet(review)
  await expect(payButton(review)).toHaveText('Confirmar e pagar 1.006 ETH')
  await payButton(review).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
  const order = await page.evaluate(() => window.__kurioMock!.snapshot().orders[0]!)
  expect([order.network, order.wallet.id, order.networkFeeEth, order.totalEth]).toEqual(['ethereum', 'wallet_user_leo_secondary', '0.016', '1.006'])
})

test('revisar logo após trocar de rede não acusa mudança de preço/estoque/cupom', async ({ page, isMobile }) => {
  // Regressão do bug C-1: com a cotação da rede anterior ainda como placeholder, "Confirmar compra"
  // espera a cotação da nova rede; a revisão não acusa mudança que a pessoa não causou.
  const networkField = await leoCheckout(page, isMobile)
  await networkField.selectOption('polygon')
  await shownTotal(page, '0.992')
  // Condição do servidor: cotação lenta (800 ms) para a troca de rede ficar observável.
  await page.evaluate(() => window.__kurioMock!.setLatency(800))
  await networkField.selectOption('ethereum')
  const review = await openReview(page)
  await expect(review).toContainText('Taxa de rede (Ethereum)')
  await expect(review).toContainText('Reserva')
  await page.evaluate(() => window.__kurioMock!.setLatency(0))
  await connectWallet(review)
  await expect(payButton(review)).toHaveText('Confirmar e pagar 1.006 ETH')
  await expect(review.getByRole('button', { name: 'Revisei os novos valores' })).toBeHidden()
  await expect(payButton(review)).toBeEnabled({ timeout: 3_000 })
})

test('rede sem carteira cadastrada é apontada no campo e não abre a revisão', async ({ page, isMobile }) => {
  await reset(page)
  await addEmerald(page)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await signIn(page)
  await expect(page).toHaveURL(/\/pagamento$/)
  if (isMobile) await page.getByRole('button', { name: 'Revisar dados', exact: true }).click()
  const networkField = page.getByRole('combobox', { name: /^Rede\b/ })
  await networkField.selectOption('polygon')
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(page.getByText('A carteira Cofre principal opera na rede Ethereum.')).toBeVisible()
  await expect(networkField).toHaveAttribute('aria-invalid', 'true')
  await expect(networkField).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Revise sua compra' })).toBeHidden()
  expect(await orderCount(page)).toBe(0)
})
