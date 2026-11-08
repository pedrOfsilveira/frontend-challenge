import { test, expect } from '@playwright/test'
import { addEmerald, ready, reset } from './helpers'

test.beforeEach(async ({ page }) => reset(page))

test('quantidades, cupom e carrinho persistem após refresh', async ({ page, isMobile }) => {
  await addEmerald(page)
  await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).click()
  await expect(page.getByRole('group', { name: /Quantidade de Emerald Ape/ }).getByRole('status')).toHaveText('2')
  const coupon = page.getByRole('textbox', { name: 'Código promocional', exact: true })
  await coupon.fill('EXPIRADO25')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Este cupom expirou.')
  await coupon.fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  const summary = page.getByRole('region', { name: isMobile ? 'Resumo do pedido' : 'Resumo da carteira', exact: true })
  await expect(summary).toContainText('Cupom KURIO10 (10%)')
  await page.reload()
  await ready(page)
  await expect(page.getByRole('group', { name: /Quantidade de Emerald Ape/ }).getByRole('status')).toHaveText('2')
  await expect(summary).toContainText('Cupom KURIO10 (10%)')
  await page.getByRole('button', { name: 'Remover', exact: true }).click()
  await expect(coupon).toBeVisible()
  await page.getByRole('button', { name: /Remover Emerald Ape #042/ }).click()
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})
