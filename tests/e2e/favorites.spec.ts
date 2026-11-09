import { expect, test } from '@playwright/test'
import { ready, reset, signIn } from './helpers'

test.beforeEach(async ({ page }) => reset(page))

test('navegação de favoritos pede login e retorna à lista vazia', async ({ page }) => {
  await page.getByRole('link', { name: 'Favoritos', exact: true }).filter({ visible: true }).click()
  await signIn(page)
  await expect(page).toHaveURL(/\/favoritos$/)
  await expect(page.getByRole('heading', { name: 'Você ainda não tem favoritos' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Favoritos', exact: true }).filter({ visible: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('main').getByRole('link', { name: 'Explorar catálogo' }).click()
  await expect(page).toHaveURL(/\/#catalogo$/)
})

test('NFT salvo aparece após recarregar e pode ser removido com recuperação de falha', async ({ page }) => {
  await page.goto('/entrar?redirect=/nft/emerald-ape-042')
  await signIn(page)
  await ready(page)
  await page.getByRole('button', { name: /^Favoritar/ }).click()
  await expect(page.getByRole('button', { name: /^Favoritado$|^Remover Emerald Ape #042 dos favoritos$/ })).toBeEnabled()
  await page.goto('/favoritos')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  await page.reload()
  await ready(page)
  const remove = page.getByRole('button', { name: /^Favoritado$|^Remover Emerald Ape #042 dos favoritos$/ }).filter({ visible: true })
  await expect(remove).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => window.__kurioMock!.failNext('favorites.remove', 'server-error'))
  await remove.click()
  await expect(page.getByRole('alert')).toContainText('Tente novamente.')
  await expect(remove).toHaveAttribute('aria-pressed', 'true')
  await remove.click()
  await expect(page.getByRole('heading', { name: 'Você ainda não tem favoritos' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Você ainda não tem favoritos' })).toBeVisible()
})
