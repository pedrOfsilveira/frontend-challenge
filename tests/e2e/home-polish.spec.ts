import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'
import { reset } from './helpers'

test('filtros mantêm ações acessíveis durante rolagem e devolvem foco ao fechar', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await reset(page)
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeAttached()
  for (const viewport of [{ width: 320, height: 640 }, { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 414, height: 896 }, { width: 768, height: 1024 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    const trigger = page.getByRole('button', { name: /^Filtros/, includeHidden: true })
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const dialog = page.getByRole('dialog', { name: 'Filtros', exact: true })
    const heading = dialog.getByRole('heading', { name: 'Filtros', exact: true })
    const initialY = (await heading.boundingBox())!.y
    expect((await dialog.getByRole('combobox', { name: 'Ordenar por:' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await dialog.getByRole('button', { name: /^Ethereum/ }).click()
    await expect(dialog.getByRole('button', { name: /^Ethereum/ })).toHaveAttribute('aria-pressed', 'true')
    expect((await heading.boundingBox())!.y).toBeCloseTo(initialY, 0)
    for (const action of [dialog.getByRole('button', { name: 'Fechar', exact: true }), dialog.getByRole('button', { name: /^Ver \d+ resultado/ })]) {
      const box = (await action.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    }
    if (viewport.width === 390) {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(result.violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('filtros-390.png') })
    }
    await dialog.getByRole('button', { name: 'Limpar', exact: true }).click()
    await dialog.getByRole('button', { name: /^Ver \d+ resultado/ }).click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await trigger.press('Enter')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  }
})

test('paginação intermediária cabe no mobile e o rodapé fica livre da navegação fixa', async ({ page }) => {
  test.setTimeout(90_000)
  await reset(page)
  await page.setViewportSize({ width: 320, height: 896 })
  const pagination = page.getByRole('navigation', { name: 'Paginação do catálogo' })
  await pagination.getByRole('link', { name: 'Próxima página', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(pagination.getByRole('link', { name: 'Página 2', exact: true })).toHaveAttribute('aria-current', 'page')
  await pagination.getByRole('link', { name: 'Próxima página', exact: true }).click()
  await expect(page).toHaveURL(/page=3/)
  await expect(pagination.getByRole('link', { name: 'Página 3', exact: true })).toHaveAttribute('aria-current', 'page')
  for (const width of [320, 360, 390, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 896 })
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(pagination.locator('a[aria-current="page"]:visible')).toHaveCount(1)
    for (const link of await pagination.getByRole('link').all()) {
      const box = await link.boundingBox()
      if (!box) continue
      expect(box.x).toBeGreaterThanOrEqual(23)
      expect(box.x + box.width).toBeLessThanOrEqual(width - 23)
      if (width < 640) expect(box.width).toBeGreaterThanOrEqual(44)
    }
    if (width < 1024) {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
      const copyright = (await page.getByText('© 2026 Kurio. Propriedade digital para todos.', { exact: true }).boundingBox())!
      const nav = (await page.getByRole('navigation', { name: 'Navegação', exact: true }).boundingBox())!
      expect(copyright.y + copyright.height).toBeLessThanOrEqual(nav.y)
    }
  }
  await page.setViewportSize({ width: 320, height: 896 })
  await page.evaluate(() => scrollTo(0, 0))
  const releases = page.getByRole('group', { name: 'Seleção do catálogo' }).getByRole('button', { name: 'Novos lançamentos', exact: true })
  const tab = (await releases.boundingBox())!
  await page.mouse.click(tab.x + tab.width / 2, tab.y - 6)
  await expect(releases).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/tab=new/)
})
