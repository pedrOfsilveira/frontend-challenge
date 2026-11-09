import { test, expect, type Request } from '@playwright/test'
import { ready, reset } from './helpers'
import { catalogIds, filterPanel, recordListRequests } from './gap-helpers'

/**
 * Catálogo e detalhe: lacunas de cobertura do enunciado (respostas fora de ordem, filtros
 * combinados conferidos pelos parâmetros REST e pela ordem exibida, edição esgotada e limites).
 */
test.beforeEach(async ({ page }) => reset(page))

const listPath = (request: Request) => request.method() === 'GET' && new URL(request.url()).pathname === '/api/nfts'

test('resposta lenta de um filtro anterior não substitui o resultado do filtro atual', async ({ page, isMobile }) => {
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  // Destino de cada listagem: respondida ou cancelada pelo cliente (ambos são descarte válido).
  const settled = new Map<string, 'finished' | 'canceled'>()
  page.on('requestfinished', (request) => listPath(request) && settled.set(request.url(), 'finished'))
  page.on('requestfailed', (request) => listPath(request) && settled.set(request.url(), 'canceled'))

  // Condição do servidor: a próxima listagem responde em 1,5 s e a seguinte em 150 ms.
  await page.evaluate(() => window.__kurioMock!.reset({ scenario: 'out-of-order' }))
  const filters = await filterPanel(page, isMobile)

  const slowRequest = page.waitForRequest((r) => listPath(r) && new URL(r.url()).searchParams.get('category') === 'digital-art' && !new URL(r.url()).searchParams.has('network'))
  await filters.getByRole('button', { name: /^Arte digital/ }).click()
  const slowUrl = (await slowRequest).url()

  const fastResponse = page.waitForResponse((r) => listPath(r.request()) && new URL(r.url()).searchParams.get('network') === 'ethereum')
  await filters.getByRole('button', { name: /^Ethereum/ }).click()
  const fast = (await (await fastResponse).json()) as { items: { id: string; network: string; category: string }[]; total: number }
  // O servidor segura a primeira por 1,5 s: a segunda resposta chega antes dela.
  expect(settled.get(slowUrl), 'a lenta não pode ter sido respondida antes da rápida').not.toBe('finished')
  expect(fast.items.every((item) => item.network === 'ethereum' && item.category === 'digital-art')).toBe(true)

  await expect.poll(() => catalogIds(page)).toEqual(fast.items.map((item) => item.id))
  // A resposta antiga chega (ou é cancelada) depois; a grade continua no filtro atual.
  await expect.poll(() => settled.has(slowUrl), { timeout: 5_000 }).toBe(true)
  test.info().annotations.push({ type: 'slow-response', description: settled.get(slowUrl)! })
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await catalogIds(page)).toEqual(fast.items.map((item) => item.id))
  if (isMobile) await filters.getByRole('button', { name: /^Ver \d+ resultado/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /NFTs? encontrados?$/ })).toHaveText(`${fast.total} NFTs encontrados`)
  expect(await catalogIds(page)).toEqual(fast.items.map((item) => item.id))
  await expect(page).toHaveURL(/category=digital-art/)
  await expect(page).toHaveURL(/network=ethereum/)
})

test('filtros combinados e ordenação chegam à API e definem os itens e a ordem exibidos', async ({ page, isMobile }) => {
  const requests = recordListRequests(page)
  await page.goto('/?max=7.5&page=2')
  await ready(page)
  await expect(page.getByRole('link', { name: 'Página 2', exact: true })).toHaveAttribute('aria-current', 'page')

  const filters = await filterPanel(page, isMobile)
  await filters.getByRole('button', { name: /^Arte digital/ }).click()
  await filters.getByRole('button', { name: /^Ethereum/ }).click()
  await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
  await page.getByRole('option', { name: 'Menor preço', exact: true }).click()
  if (isMobile) await filters.getByRole('button', { name: /^Ver \d+ resultado/ }).click()

  // Seed determinístico: arte digital + Ethereum até 7,5 ETH, do menor para o maior preço.
  const ascending = ['emerald-ape-042', 'crimson-bloom-795', 'sage-nomad-009', 'lunar-beat-248']
  await expect.poll(() => catalogIds(page)).toEqual(ascending)
  const last = requests.at(-1)!
  expect(Object.fromEntries(last)).toEqual({
    tab: 'all',
    category: 'digital-art',
    network: 'ethereum',
    priceMax: '7.5',
    sort: 'price-asc',
    page: '1',
    pageSize: '9',
  })
  const cards = page.getByRole('region', { name: 'Catálogo de NFTs' }).locator('ul > li').filter({ has: page.locator('a[href^="/nft/"]') })
  await expect(cards.first()).toContainText('1.19 ETH')
  await expect(cards.last()).toContainText('7.21 ETH')
  await expect(page.getByRole('status').filter({ hasText: /NFTs? encontrados?$/ })).toHaveText('4 NFTs encontrados')
  await expect(page.getByRole('link', { name: 'Página 2', exact: true })).toBeHidden()

  const reversed = isMobile ? await filterPanel(page, isMobile) : null
  await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
  await page.getByRole('option', { name: 'Maior preço', exact: true }).click()
  if (reversed) await reversed.getByRole('button', { name: /^Ver \d+ resultado/ }).click()
  await expect.poll(() => catalogIds(page)).toEqual([...ascending].reverse())
  expect(requests.at(-1)!.get('sort')).toBe('price-desc')
  expect(requests.at(-1)!.get('priceMax')).toBe('7.5')
  expect(requests.at(-1)!.get('page')).toBe('1')
})

test('NFT sem edição disponível não permite compra e edição esgotada não é selecionável', async ({ page }) => {
  await page.goto('/nft/cobalt-beat-874')
  await ready(page)
  await expect(page.getByRole('heading', { name: 'Cobalt Beat #874', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(ESGOTADO|Esgotado)$/ })).toBeDisabled()
  for (const label of ['1/1', '1/10', '1/50']) {
    await expect(page.getByRole('button', { name: `Edição ${label}, esgotada`, exact: true })).toHaveAttribute('aria-disabled', 'true')
  }

  await page.goto('/nft/emerald-ape-042')
  const soldOut = page.getByRole('button', { name: 'Edição 1/1, esgotada', exact: true })
  const standard = page.getByRole('button', { name: 'Edição 1/50, 40 disponíveis', exact: true })
  await expect(standard).toHaveAttribute('aria-pressed', 'true')
  // aria-disabled mantém o botão focável/anunciado; o clique precisa ser ignorado pela página.
  await soldOut.click({ force: true })
  await expect(soldOut).toHaveAttribute('aria-pressed', 'false')
  await expect(standard).toHaveAttribute('aria-pressed', 'true')
  await expect(page).not.toHaveURL(/edicao=/)
  await expect(page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ })).toBeEnabled()
})

test('quantidade respeita o estoque da edição no detalhe, no carrinho e na API', async ({ page }) => {
  // Seed: Sage Nomad #009, edição 1/50, 3 unidades.
  await page.goto('/nft/sage-nomad-009')
  await ready(page)
  const increase = page.getByRole('button', { name: 'Aumentar quantidade', exact: true })
  await expect(page.getByRole('button', { name: 'Edição 1/50, 3 disponíveis', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await increase.click()
  await increase.click()
  await expect(page.getByRole('group', { name: 'Quantidade' }).getByRole('status')).toHaveText('3')
  await expect(increase).toBeDisabled()
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
  const line = page.getByRole('group', { name: /Quantidade de Sage Nomad/ })
  await expect(line.getByRole('status')).toHaveText('3')
  await expect(line.getByRole('button', { name: 'Aumentar quantidade', exact: true })).toBeDisabled()

  // Mais uma unidade a partir do detalhe ultrapassa o estoque: a API recusa e o carrinho fica igual.
  await page.goto('/nft/sage-nomad-009')
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await expect(page.getByRole('alert')).toHaveText('Só há 3 unidade(s) disponível(is) da edição 1/50.')
  await expect(page).toHaveURL(/\/nft\/sage-nomad-009$/)
  await page.goto('/carrinho')
  await expect(page.getByRole('group', { name: /Quantidade de Sage Nomad/ }).getByRole('status')).toHaveText('3')
})
