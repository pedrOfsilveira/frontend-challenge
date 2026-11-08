import { test, expect, type Page } from '@playwright/test'
import { addEmerald, ready, reset, signIn } from './helpers'

async function visualReady(page: Page) {
  await ready(page)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(Array.from(document.images).filter((image) => {
      const box = image.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0
    }).map((image) => image.decode().catch(() => undefined)))
  })
}

test('regressão visual de início, detalhe, carrinho e pagamento', async ({ page }) => {
  await reset(page)
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeAttached()
  await visualReady(page)
  await expect(page).toHaveScreenshot('inicio.png', { animations: 'disabled' })
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  await visualReady(page)
  await expect(page).toHaveScreenshot('detalhe.png', { animations: 'disabled' })
  await addEmerald(page)
  await expect(page.getByRole('link', { name: 'Conectar e finalizar' })).not.toHaveAttribute('aria-disabled', 'true')
  await visualReady(page)
  await expect(page).toHaveScreenshot('carrinho.png', { animations: 'disabled' })
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await signIn(page)
  await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeEnabled()
  await visualReady(page)
  await expect(page).toHaveScreenshot('pagamento.png', { animations: 'disabled' })
})
