import { test, expect, type Page } from '@playwright/test'
import { addEmerald, reset, reviewPurchase } from './helpers'

const widths = [320, 390, 414, 768, 1024, 1440]

async function expectPageFits(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  const size = { available: page.viewportSize()!.width, actual: await page.evaluate(() => document.documentElement.scrollWidth) }
  expect(size.actual, `Document overflows at ${size.available}px`).toBeLessThanOrEqual(size.available)
}

test('catálogo, promoções e detalhe cabem entre 320 e 1440 px', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await reset(page)
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeAttached()
  for (const width of widths) {
    await page.setViewportSize({ width, height: 896 })
    await expectPageFits(page)
    if (width <= 414) {
      const hero = page.getByRole('region', { name: 'SEJA DONO DA CULTURA DIGITAL' })
      const banner = (await hero.boundingBox())!
      expect(banner.height / banner.width).toBeCloseTo(190 / 366, 2)
      const tabs = page.getByRole('group', { name: 'Seleção do catálogo' })
      const buttons = await tabs.getByRole('button').all()
      const boxes = await Promise.all(buttons.map((button) => button.boundingBox()))
      for (const box of boxes) {
        expect(box!.y).toBeCloseTo(boxes[0]!.y, 0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 24 + 1)
      }
    }
    const promos = page.getByRole('region', { name: 'Destaques do mercado' })
    await promos.scrollIntoViewIfNeeded()
    const content = await promos.locator('article').evaluateAll((cards) => cards.flatMap((card) => {
      const bounds = card.getBoundingClientRect()
      return [...card.querySelectorAll('h2,p,a')].map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          text: element.textContent,
          fits: rect.left >= bounds.left && rect.right <= bounds.right + 1 && rect.bottom <= bounds.bottom + 1,
          clipped: element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1,
        }
      })
    }))
    for (const item of content) {
      expect(item.fits, `${width}px: ${item.text}`).toBe(true)
      expect(item.clipped, `${width}px: ${item.text}`).toBe(false)
    }
    if (width === 414) {
      const hero = page.getByRole('region', { name: 'SEJA DONO DA CULTURA DIGITAL' })
      expect((await hero.boundingBox())!.height).toBeCloseTo(190, 0)
    }
    await promos.screenshot({ path: testInfo.outputPath(`promos-${width}.png`) })
  }
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  for (const width of widths) {
    await page.setViewportSize({ width, height: 896 })
    await expectPageFits(page)
  }
})

test('revisão mantém preços, pagamento e fechar visíveis; carteiras permitem rótulos longos', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await reset(page)
  await addEmerald(page)
  const review = await reviewPurchase(page)
  for (const width of widths) {
    await page.setViewportSize({ width, height: 896 })
    await expectPageFits(page)
    const size = await review.evaluate((element) => ({ available: element.clientWidth, actual: element.scrollWidth }))
    expect(size.actual, `Review overflows at ${width}px`).toBeLessThanOrEqual(size.available)
    const bounds = (await review.boundingBox())!
    for (const control of [review.getByRole('button', { name: 'Fechar revisão' }), review.getByRole('button', { name: /^Confirmar e pagar/ })]) {
      await control.scrollIntoViewIfNeeded()
      const box = (await control.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(bounds.x)
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
    }
    await review.screenshot({ path: testInfo.outputPath(`review-${width}.png`) })
  }
  await page.setViewportSize({ width: 320, height: 896 })
  await review.getByRole('button', { name: 'Fechar revisão' }).click()
  await expect(review).toBeHidden()
  await page.goto('/carteiras')
  await expect(page.getByRole('form', { name: 'Carteira principal', exact: true })).toBeVisible()
  for (const width of widths) {
    await page.setViewportSize({ width, height: 896 })
    await expectPageFits(page)
  }
})
