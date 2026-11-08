import { test, expect } from '@playwright/test'
import { ready, reset, signIn } from './helpers'

test.beforeEach(async ({ page }) => reset(page))

test('filtros combinados, ordenação e paginação vivem na URL e no histórico', async ({ page, isMobile }) => {
  await page.getByRole('link', { name: 'Página 2', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()
  const filters = isMobile ? page.getByRole('dialog', { name: 'Filtros' }) : page.getByRole('complementary', { name: 'Filtros' })
  await filters.getByRole('button', { name: /^Arte digital/ }).click()
  await expect(page).toHaveURL(/category=digital-art/)
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  await filters.getByRole('button', { name: /^Ethereum/ }).click()
  await expect(page).toHaveURL(/network=ethereum/)
  await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
  await page.getByRole('option', { name: 'Menor preço', exact: true }).click()
  await expect(page).toHaveURL(/sort=price-asc/)
  if (isMobile) await filters.getByRole('button', { name: /^Ver \d+ resultado/ }).click()
  const selected = page.url()
  await page.reload()
  await ready(page)
  await expect(page).toHaveURL(selected)
  await page.goBack()
  await expect(page).not.toHaveURL(/sort=price-asc/)
  await page.goForward()
  await expect(page).toHaveURL(selected)
})

test('busca mostra resultado vazio e permite recuperação', async ({ page, isMobile }) => {
  if (!isMobile) await page.getByRole('button', { name: 'Abrir busca' }).click()
  const search = page.getByRole('searchbox', { name: 'Buscar NFTs' })
  await search.fill('nenhum-nft-com-este-nome')
  await search.press('Enter')
  await expect(page).toHaveURL(/q=nenhum-nft-com-este-nome/)
  await expect(page.getByText('Nenhum NFT combina com esses filtros.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'limpar busca', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
})

test('detalhe por URL trata NFT inexistente', async ({ page }) => {
  await page.goto('/nft/nao-existe')
  await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
})

test('rota inexistente oferece volta ao mercado', async ({ page }) => {
  await page.goto('/pagina-inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao mercado', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('favorito otimista reverte na falha, mostra erro e permite tentar novamente', async ({ page }) => {
  await page.goto('/entrar?redirect=/nft/emerald-ape-042')
  const favoritesLoaded = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/favorites' && response.status() === 200)
  await signIn(page)
  await favoritesLoaded
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  const favorite = page.getByRole('button', { name: /^Favoritar/ })
  await page.evaluate(() => { window.__kurioMock!.setLatency(500); window.__kurioMock!.failNext('favorites.add', 'server-error') })
  await favorite.click()
  await expect(page.getByRole('button', { name: /^Favoritado$|^Remover Emerald Ape #042 dos favoritos$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('alert')).toContainText('Tente novamente.')
  await expect(favorite).toHaveAttribute('aria-pressed', 'false')
  await favorite.click()
  await expect(page.getByRole('button', { name: /^Favoritado$|^Remover Emerald Ape #042 dos favoritos$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Favoritado$|^Remover Emerald Ape #042 dos favoritos$/ })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: /^Favoritado$|^Remover Emerald Ape #042 dos favoritos$/ })).toHaveAttribute('aria-pressed', 'true')
})

test('rede lenta mostra skeleton; falha de catálogo pode ser recuperada', async ({ page }) => {
  await page.goto('/?scenario=slow')
  await expect(page.getByRole('status').filter({ hasText: 'Carregando NFTs…' })).toBeAttached()
  await expect(page.locator('[data-slot="skeleton"]:visible').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  await page.goto('/?scenario=server-error')
  await expect(page.getByText('Não foi possível carregar o catálogo. Confira sua conexão e tente de novo.', { exact: true })).toBeVisible({ timeout: 20_000 })
  await page.evaluate(() => window.__kurioMock!.setScenario('fast'))
  await page.getByRole('button', { name: 'Tentar de novo', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
})
