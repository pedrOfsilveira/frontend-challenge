import { test, expect } from '@playwright/test'
import { reset } from './helpers'

test('compra mobile adapta altura, toque, rodapé e texto a 200%', async ({ page }, testInfo) => {
  await reset(page)
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  const bar = page.getByRole('region', { name: 'Compra do NFT', exact: true })
  const footer = page.getByRole('contentinfo')

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expect(bar).toHaveAttribute('data-flow', 'false')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    if (viewport.height < 500) expect((await bar.boundingBox())!.height).toBeLessThan(100)
    for (const button of await bar.getByRole('group', { name: 'Quantidade' }).getByRole('button').all()) {
      const bounds = (await button.boundingBox())!
      expect(bounds.width).toBeGreaterThanOrEqual(44)
      expect(bounds.height).toBeGreaterThanOrEqual(44)
    }
    if (viewport.width < 640) {
      expect((await footer.boundingBox())!.height).toBeLessThan(800)
      const extras = footer.locator('details').filter({ has: page.locator('summary', { hasText: 'Sobre a Kurio e novidades' }) })
      await extras.locator('summary').click()
      await expect(footer.getByRole('region', { name: 'Newsletter' })).toContainText('As inscrições na newsletter ainda não estão abertas.')
      await expect(footer.getByRole('textbox')).toHaveCount(0)
      await extras.locator('summary').click()
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(async () => (await footer.boundingBox())!.y + (await footer.boundingBox())!.height - (await bar.boundingBox())!.y).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 320, height: 568 })
  await bar.getByRole('button', { name: 'Adicionar ao carrinho e continuar aqui', exact: true }).click()
  await expect(bar.getByRole('status').filter({ hasText: 'no carrinho' })).toContainText('no carrinho')
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expect(bar).toHaveAttribute('data-flow', 'true')
  await bar.scrollIntoViewIfNeeded()
  const geometry = await bar.getByRole('button', { name: 'Comprar NFT', exact: true }).evaluate((button) => {
    const range = document.createRange()
    range.selectNodeContents(button)
    const text = range.getBoundingClientRect()
    const bounds = button.getBoundingClientRect()
    return { fits: text.left >= bounds.left && text.right <= bounds.right + 1 && text.top >= bounds.top && text.bottom <= bounds.bottom + 1 }
  })
  expect(geometry.fits).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  const status = bar.getByRole('status').filter({ hasText: 'no carrinho' })
  const size = await status.evaluate((element) => ({ height: element.clientHeight, scroll: element.scrollHeight }))
  expect(size.scroll).toBeLessThanOrEqual(size.height)
  await bar.screenshot({ path: testInfo.outputPath('compra-320-texto-200.png') })
})
