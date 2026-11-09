import { test, expect, type Page } from '@playwright/test'
import { addEmerald, ready, reset, reviewPurchase } from './helpers'

/**
 * Consistência REST × Socket.IO. Todo estado muda só no servidor simulado (`__kurioMock`);
 * a interface fica sabendo pelo Socket.IO (socket.io-client + binding do MSW) ou pelo REST
 * (Axios + MSW). A referência de "certo" é sempre a resposta REST do mesmo momento.
 */

test.beforeEach(async ({ page }) => reset(page))

const PAGE_SIZE = 9

type ListResponse = { items: { id: string; name: string; priceEth: string }[]; total: number; totalPages: number; page: number }

/** O que o servidor responde agora para a mesma busca da URL (fetch passa pelo MSW, como o Axios). */
async function restList(page: Page, search: Record<string, string>) {
  // `probe` (ignorado pelo servidor) separa as leituras do teste das requisições do app.
  const query = new URLSearchParams({ tab: 'all', sort: 'recent', page: '1', pageSize: String(PAGE_SIZE), probe: '1' })
  for (const [key, value] of Object.entries(search)) query.set(key === 'max' ? 'priceMax' : key === 'min' ? 'priceMin' : key, value)
  return page.evaluate(async (qs) => (await fetch(`/api/nfts?${qs}`)).json() as Promise<ListResponse>, query.toString())
}

const cardNames = (page: Page) => page.locator('#catalogo ul > li h3').allInnerTexts()
const emeraldCard = (page: Page) => page.locator('#catalogo li').filter({ has: page.getByRole('link', { name: 'Emerald Ape #042', exact: true }) })
const resultStatus = (page: Page) => page.locator('#catalogo p[role="status"]')
const countText = (total: number) => `${total} ${total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}`

/** A grade, o contador e a paginação batem com o REST. */
async function expectListMatchesRest(page: Page, search: Record<string, string>) {
  await expect
    .poll(async () => {
      const rest = await restList(page, search)
      const pageLink = (n: number) => page.getByRole('link', { name: `Página ${n}`, exact: true }).count()
      return {
        names: (await cardNames(page)).join(' | ') === rest.items.map((item) => item.name).join(' | '),
        count: (await resultStatus(page).innerText()) === countText(rest.total),
        // A última página que o REST conhece aparece; a seguinte, não.
        lastPage: rest.totalPages <= 1 || (await pageLink(rest.totalPages)) > 0,
        noExtraPage: (await pageLink(Math.max(rest.totalPages, 1) + 1)) === 0,
      }
    }, { timeout: 10_000 })
    .toEqual({ names: true, count: true, lastPage: true, noExtraPage: true })
}

async function waitConnected(page: Page, userId: string | null = null) {
  await expect.poll(() => page.evaluate((id) => window.__kurioMock!.realtime.connections().some((c) => c.userId === id), userId)).toBe(true)
}

async function openCatalog(page: Page, search: Record<string, string>) {
  await page.goto(`/?${new URLSearchParams(search)}`)
  await ready(page)
  await page.evaluate(() => window.__kurioMock!.setLatency(0))
  await expect(resultStatus(page)).toHaveText(/NFTs? encontrados?$/)
  await waitConnected(page)
}

test('filtro de preço ativo: NFT que passa do teto sai da lista e o contador acompanha o REST', async ({ page }) => {
  const search = { q: 'Emerald', max: '2', sort: 'price-asc' }
  await openCatalog(page, search)
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  await expectListMatchesRest(page, search)

  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { priceEth: '99' }))

  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeHidden()
  await expect(page.getByText('Nenhum NFT combina com esses filtros.')).toBeVisible()
  await expect(resultStatus(page)).toHaveText(countText(0))
  await expectListMatchesRest(page, search)
})

test('ordenação por preço ativa: NFT de fora da página entra na posição que o REST manda', async ({ page }) => {
  const search = { sort: 'price-asc' }
  await openCatalog(page, search)
  await expect(page.getByRole('link', { name: /^Ivory Baron/ })).toHaveCount(0)

  // Estava na 12ª posição (fora da página 1): o evento é de um NFT que a lista nem tinha.
  await page.evaluate(() => window.__kurioMock!.updateNft('ivory-baron-088', { priceEth: '0.1' }))

  await expect.poll(async () => (await cardNames(page))[0]).toMatch(/^Ivory Baron/)
  await expectListMatchesRest(page, search)
})

test('paginação: total e número de páginas se recompõem quando um item sai do filtro', async ({ page }) => {
  // max=1.69 com price-asc: 10 NFTs, 2 páginas.
  const search = { max: '1.69', sort: 'price-asc' }
  await openCatalog(page, search)
  await expect(resultStatus(page)).toHaveText(countText(10))
  await expect(page.getByRole('navigation', { name: 'Paginação do catálogo' }).getByRole('link', { name: 'Página 2' }).first()).toBeAttached()

  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { priceEth: '99' }))

  await expect(resultStatus(page)).toHaveText(countText(9))
  await expect(page.getByRole('link', { name: 'Página 2' })).toHaveCount(0)
  await expectListMatchesRest(page, search)
})

test('evento duplicado ou antigo não desfaz o REST, e um evento não vira laço de refetch', async ({ page }) => {
  const search = { q: 'Emerald', max: '2', sort: 'price-asc' }
  await openCatalog(page, search)
  const appListRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (request.method() === 'GET' && url.pathname === '/api/nfts' && !url.searchParams.has('probe')) appListRequests.push(url.search)
  })

  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { priceEth: '99' }))
  await expect(page.getByText('Nenhum NFT combina com esses filtros.')).toBeVisible()
  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { priceEth: '1.5' }))
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  await expect(emeraldCard(page)).toContainText('1.50 ETH')

  // Reenvia o evento antigo (99 ETH) e uma duplicata do atual (1.5 ETH).
  const appRequestsBefore = appListRequests.length
  const replayed = await page.evaluate(() => {
    const events = window.__kurioMock!.events().filter((e) => e.type === 'nft.updated')
    window.__kurioMock!.realtime.replay(events[0]!.id)
    window.__kurioMock!.realtime.replay(events.at(-1)!.id)
    return events.length
  })
  expect(replayed).toBe(2)
  await page.waitForTimeout(1_500)
  await expect(emeraldCard(page)).toContainText('1.50 ETH')
  await expectListMatchesRest(page, search)
  // Duplicata e evento antigo são descartados antes de qualquer refetch; e nada fica refazendo a lista.
  expect(appListRequests.slice(appRequestsBefore)).toEqual([])
})

test('order.updated chega pelo Socket.IO sem depender do polling REST de 4 s', async ({ page }) => {
  await addEmerald(page)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  const review = await reviewPurchase(page)
  await waitConnected(page, 'user_nova')
  await review.getByRole('button', { name: /^Confirmar e pagar/ }).click()
  await expect(page).toHaveURL(/\/pedido\/[^/]+$/)
  const orderId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!)
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()

  const orderReads: { at: number; status: string }[] = []
  page.on('response', async (response) => {
    if (response.request().method() !== 'GET' || new URL(response.url()).pathname !== `/api/orders/${orderId}`) return
    const at = Date.now()
    const body = (await response.json().catch(() => null)) as { status?: string } | null
    orderReads.push({ at, status: body?.status ?? 'unknown' })
  })
  // Começa logo depois de um polling: o próximo só sai daqui a ~4 s.
  await page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === `/api/orders/${orderId}`)
  const settledAt = Date.now()
  await page.evaluate(() => window.__kurioMock!.settlePendingOrders('confirm'))

  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 2_500 })
  const visibleAt = Date.now()
  expect(visibleAt - settledAt).toBeLessThan(3_000)
  // Nenhuma leitura REST do pedido entre a decisão no servidor e a tela confirmada.
  expect(orderReads.filter((read) => read.at >= settledAt && read.at <= visibleAt)).toEqual([])
  // Evidência do transporte: o servidor publicou o evento e a conexão da Nova estava aberta.
  const published = await page.evaluate((id) => window.__kurioMock!.events().filter((e) => e.type === 'order.updated' && e.resource.id === id).map((e) => e.type === 'order.updated' && e.data.status), orderId)
  expect(published).toContain('confirmed')
  expect(await page.evaluate(() => window.__kurioMock!.realtime.connections().map((c) => c.userId))).toContain('user_nova')
  expect(await page.evaluate(() => window.__kurioMock!.snapshot().orders.length)).toBe(1)
})

/**
 * Resposta REST calculada antes de uma mudança e entregue depois. Depende do controle
 * `holdNext/heldCount/releaseHeld` pedido ao coordenador (NOTES/handoff-a.md); sem ele, pula.
 */
type HoldControls = { holdNext(route: string, count?: number): void; heldCount(route: string): number; releaseHeld(route: string): void }
const holds = (page: Page) => page.evaluate(() => typeof (window.__kurioMock as unknown as Partial<HoldControls>).holdNext === 'function')

async function openDetailWithHeldResponse(page: Page) {
  await page.evaluate(() => (window.__kurioMock as unknown as HoldControls).holdNext('nfts.detail'))
  await page.getByRole('link', { name: 'Emerald Ape #042', exact: true }).click()
  await expect(page).toHaveURL(/\/nft\/emerald-ape-042$/)
  // A resposta já foi calculada com o preço antigo e está retida.
  await expect.poll(() => page.evaluate(() => (window.__kurioMock as unknown as HoldControls).heldCount('nfts.detail'))).toBe(1)
}

async function expectDetailMatchesRest(page: Page) {
  const rest = await page.evaluate(async () => ((await (await fetch('/api/nfts/emerald-ape-042')).json()) as { priceEth: string }).priceEth)
  expect(rest).toBe('99')
  // O preço vigente da edição é o do REST atual (o aviso "mudou de 1.19 para 99" pode aparecer).
  await expect(page.getByRole('main')).toContainText('Preço da edição 1/50: 99.00 ETH')
  await expect(page.getByRole('main')).not.toContainText('Preço da edição 1/50: 1.19 ETH')
}

test('reconexão com resposta REST antiga em voo: o CONNECT não confia nela e o detalhe chega ao estado do servidor', async ({ page }) => {
  await openCatalog(page, { sort: 'price-asc' })
  test.skip(!(await holds(page)), 'depende do controle __kurioMock.holdNext (pedido ao coordenador)')
  await page.evaluate(() => window.__kurioMock!.realtime.pause())
  await expect.poll(() => page.evaluate(() => window.__kurioMock!.realtime.connections().length)).toBe(0)

  await openDetailWithHeldResponse(page)
  // Mudança sem ninguém conectado: o evento se perde.
  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { priceEth: '99' }))
  await page.evaluate(() => window.__kurioMock!.realtime.resume())
  await waitConnected(page)
  // Só agora, depois do CONNECT, a resposta antiga chega.
  await page.evaluate(() => (window.__kurioMock as unknown as HoldControls).releaseHeld('nfts.detail'))

  await expectDetailMatchesRest(page)
})

test('evento durante a primeira carga: resposta em voo de antes do evento não fica valendo', async ({ page }) => {
  await openCatalog(page, { sort: 'price-asc' })
  test.skip(!(await holds(page)), 'depende do controle __kurioMock.holdNext (pedido ao coordenador)')
  await openDetailWithHeldResponse(page)
  // Conectado: o evento chega, mas o detalhe ainda não tem dados onde aplicá-lo.
  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { priceEth: '99' }))
  await expect.poll(() => page.evaluate(() => window.__kurioMock!.events().length)).toBe(1)
  await page.waitForTimeout(300)
  await page.evaluate(() => (window.__kurioMock as unknown as HoldControls).releaseHeld('nfts.detail'))

  await expectDetailMatchesRest(page)
})
