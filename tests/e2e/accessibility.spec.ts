import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'
import { addEmerald, ready, reset, signIn } from './helpers'

test('a11y automatizada nos fluxos de descoberta, compra e conta', async ({ page }) => {
  test.setTimeout(90_000)
  const scan = async (name: string) => {
    await page.evaluate(() => document.fonts.ready)
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    expect.soft(result.violations, name).toEqual([])
  }
  await reset(page)
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeAttached()
  await scan('Início')
  await addEmerald(page)
  await scan('Carrinho')
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await scan('Login')
  await signIn(page)
  await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeEnabled()
  await scan('Pagamento')
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Revise sua compra' })).toBeVisible()
  await scan('Revisão da compra')
  await page.getByRole('button', { name: 'Fechar revisão', exact: true }).click()
  for (const route of ['/perfil', '/carteiras', '/nft/emerald-ape-042']) {
    await page.goto(route)
    await ready(page)
    await expect(page.locator('main form:visible, main article:visible').first()).toBeVisible()
    await scan(route)
  }
})
