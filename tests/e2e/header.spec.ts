import { test, expect } from '@playwright/test'
import { reset, signIn } from './helpers'

test('header alinha os controles, navega entre seções e abre busca sem deslocar o menu', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await reset(page)
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeAttached()
  await page.evaluate(() => document.fonts.ready)
  const header = page.getByRole('banner')
  const nav = header.getByRole('navigation', { name: 'Principal' })
  const search = header.getByRole('button', { name: /^(Abrir|Fechar) busca$/ })

  for (const width of [1024, 1264, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(() => scrollTo(0, 0))
    const logo = (await header.getByRole('link', { name: 'Kurio — início' }).boundingBox())!
    const center = logo.y + logo.height / 2
    for (const item of [nav.getByRole('link', { name: 'Início', exact: true }), nav.getByRole('link', { name: 'Mercado', exact: true }), search, header.getByRole('link', { name: /^Carrinho,/ }), header.getByRole('link', { name: 'Entrar', exact: true })]) {
      const box = (await item.boundingBox())!
      expect(Math.abs(box.y + box.height / 2 - center)).toBeLessThanOrEqual(1)
    }
    const before = (await nav.boundingBox())!
    await search.click()
    const input = header.getByRole('searchbox', { name: 'Buscar NFTs' })
    await expect(input).toBeFocused()
    const after = (await nav.boundingBox())!
    expect(after.x).toBeCloseTo(before.x, 0)
    expect(after.width).toBeCloseTo(before.width, 0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await expect(input).toBeHidden()
    await expect(search).toBeFocused()
    if (width === 1264) await header.screenshot({ path: testInfo.outputPath('header-1264.png') })
  }

  await nav.getByRole('link', { name: 'Mercado', exact: true }).click()
  await expect(page).toHaveURL(/#catalogo$/)
  await expect(nav.getByRole('link', { name: 'Mercado', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Início', exact: true })).not.toHaveAttribute('aria-current')
  await nav.getByRole('link', { name: 'Aprenda', exact: true }).click()
  await expect(page).toHaveURL(/#aprenda$/)
  await expect(nav.getByRole('link', { name: 'Aprenda', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Diário da Cunhagem' })).toBeInViewport()
  await nav.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await expect(nav.getByRole('link', { name: 'Criadores', exact: true })).toHaveAttribute('aria-disabled', 'true')

  await search.click()
  await header.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('Emerald')
  await header.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page).toHaveURL(/q=Emerald.*#catalogo$/)
  await expect(header.getByRole('searchbox')).toBeHidden()
  await expect(nav.getByRole('link', { name: 'Mercado', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.reload()
  await expect(nav.getByRole('link', { name: 'Mercado', exact: true })).toHaveAttribute('aria-current', 'page')
  await header.getByRole('link', { name: 'Entrar', exact: true }).click()
  await signIn(page)
  await page.setViewportSize({ width: 1024, height: 1000 })
  await expect(header.getByRole('link', { name: 'Minha conta', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024)
  await nav.getByRole('link', { name: 'Favoritos', exact: true }).click()
  await expect(page).toHaveURL(/\/favoritos$/)
  await expect(nav.getByRole('link', { name: 'Favoritos', exact: true })).toHaveAttribute('aria-current', 'page')
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 896 })
    await expect(header).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Navegação', exact: true })).toBeVisible()
  }
  expect(errors).toEqual([])
})
