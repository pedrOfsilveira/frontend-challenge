import { expect, type Page } from '@playwright/test'
// Type-only import: test controls alter the simulated server; never inject UI/cache state.
import type {} from '../../src/mocks/controls'

export async function ready(page: Page) {
  await page.waitForFunction(() => Boolean(window.__kurioMock))
}

export async function reset(page: Page) {
  // Every Playwright test has its own fresh browser context and storage.
  await page.goto('/?mock-reset')
  await ready(page)
  await page.evaluate(() => window.__kurioMock!.setLatency(0))
}

export async function signIn(page: Page, email = 'nova@kurio.dev', password = 'kurio123') {
  const form = page.getByRole('form', { name: 'Login', exact: true })
  await expect(form).toBeVisible()
  await form.getByLabel('E-mail', { exact: true }).fill(email)
  await form.getByLabel('Senha', { exact: true }).fill(password)
  await form.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

export async function addEmerald(page: Page) {
  await page.goto('/nft/emerald-ape-042')
  await ready(page)
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
  await expect(page.getByRole('link', { name: 'Conectar e finalizar' })).toBeEnabled()
}

export async function reviewPurchase(page: Page) {
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await signIn(page)
  await expect(page).toHaveURL(/\/pagamento$/)
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  const review = page.getByRole('dialog', { name: 'Revise sua compra' })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  await expect(review.getByRole('button', { name: /^Confirmar e pagar/ })).toBeEnabled()
  return review
}
