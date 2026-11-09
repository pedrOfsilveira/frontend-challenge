import { test, expect, type Locator, type Page } from '@playwright/test'
import { addEmerald, ready, reset, reviewPurchase, signIn } from './helpers'

/**
 * Regressões de acessibilidade encontradas na verificação da Wave 2 (teclado, foco, anúncios,
 * alvo de toque, movimento reduzido e recorte interno). Complementa o axe de `accessibility.spec.ts`;
 * nenhuma das duas suítes é uma certificação de acessibilidade.
 *
 * `test.fail()` marca achados fora deste escopo de arquivos, com o pedido ao coordenador
 * (W2B-Rn em NOTES/handoff-w2b.md). Depois de aplicar o diff, remova o `test.fail()`.
 */

const focused = (page: Page) => page.evaluate(() => document.activeElement?.closest('button, a, input, select, textarea, summary, [tabindex]')?.outerHTML.slice(0, 120) ?? 'body')

/** Leo (seed): Golden Beat #207 no carrinho, Coinbase em Polygon e Reserva em Ethereum. */
async function leoCheckout(page: Page, isMobile: boolean) {
  await reset(page)
  await page.goto('/entrar?redirect=/pagamento')
  await signIn(page, 'leo@kurio.dev')
  await expect(page).toHaveURL(/\/pagamento$/)
  await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true }).filter({ visible: true })).toBeEnabled()
  if (isMobile) await page.getByRole('button', { name: 'Revisar dados', exact: true }).click()
  return page.getByRole('combobox', { name: /^Rede\b/ })
}

test('pílulas de edição têm alvo de toque de 44 × 44 px abaixo de lg (::after)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'O ::after só existe abaixo de lg; no desktop a pílula de 28 px cumpre o mínimo AA de 24 px.')
  await reset(page)
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  const chips = page.getByRole('button', { name: /^Edição .+(esgotada|disponíveis?)$/ }).filter({ visible: true })
  expect(await chips.count()).toBeGreaterThan(0)
  for (const chip of await chips.all()) {
    await chip.scrollIntoViewIfNeeded()
    // boundingBox() não enxerga o ::after: o que vale é qual elemento recebe o toque em cada ponto.
    const misses = await chip.evaluate((button) => {
      const box = button.getBoundingClientRect()
      const cx = box.left + box.width / 2
      const cy = box.top + box.height / 2
      const out: string[] = []
      for (const [dx, dy] of <[number, number][]>[[-21.5, 0], [21.5, 0], [0, -21.5], [0, 21.5], [-21.5, -21.5], [21.5, 21.5], [-21.5, 21.5], [21.5, -21.5]]) {
        const hit = document.elementFromPoint(cx + dx, cy + dy)
        if (!hit || !button.contains(hit)) out.push(`${dx},${dy} → ${hit?.tagName ?? 'nada'}`)
      }
      return out
    })
    expect(misses, await chip.getAttribute('aria-label') ?? '').toEqual([])
  }
})

test('quantidade no limite continua focada e anuncia o valor', async ({ page, isMobile }) => {
  await reset(page)
  // Seed: Sage Nomad #009, edição 1/50 com 3 unidades.
  await page.goto('/nft/sage-nomad-009')
  await ready(page)
  const group = page.getByRole('group', { name: 'Quantidade', exact: true }).filter({ visible: true })
  const increase = group.getByRole('button', { name: 'Aumentar quantidade', exact: true })
  const decrease = group.getByRole('button', { name: 'Diminuir quantidade', exact: true })
  await expect(decrease).toBeDisabled()
  await increase.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(group.getByRole('status')).toHaveText('3')
  await expect(increase).toBeDisabled()
  // Antes, o `disabled` nativo tirava o foco do botão e o teclado voltava para o <body>.
  await expect(increase).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(group.getByRole('status')).toHaveText('3')
  await page.keyboard.press('Shift+Tab')
  await expect(decrease).toBeFocused()
  for (let i = 0; i < 3; i++) await page.keyboard.press('Enter')
  await expect(group.getByRole('status')).toHaveText('1')
  await expect(decrease).toBeFocused()
  if (isMobile) return
  // Carrinho desktop usa o mesmo seletor.
  await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
  const line = page.getByRole('group', { name: /Quantidade de Sage Nomad/ })
  await line.getByRole('button', { name: 'Diminuir quantidade', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(line.getByRole('button', { name: 'Diminuir quantidade', exact: true })).toBeFocused()
})

test('glossário abre pelo teclado, tem nome e devolve o foco ao fechar', async ({ page }) => {
  await reset(page)
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  const trigger = page.getByRole('button', { name: 'Edição (o que é isso?)', exact: true }).filter({ visible: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const popover = page.getByRole('dialog', { name: 'Edição', exact: true })
  await expect(popover).toBeVisible()
  await expect(popover).toContainText('tiragem')
  await page.keyboard.press('Escape')
  await expect(popover).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('foco por teclado não fica escondido atrás da barra de compra mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'A barra fixa só existe abaixo de lg.')
  await reset(page)
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  const bar = page.getByRole('region', { name: 'Compra do NFT', exact: true })
  await expect(bar).toHaveAttribute('data-flow', 'false')
  const hidden: string[] = []
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    const overlap = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      const barBox = document.querySelector('.nft-buybar')?.getBoundingClientRect()
      if (!element || element === document.body || !barBox || element.closest('.nft-buybar')) return null
      const box = element.getBoundingClientRect()
      // 2.4.11 (AA): o componente focado não pode ficar inteiramente coberto; aqui exigimos que nada dele fique.
      return box.bottom > barBox.top + 1 && box.top < barBox.bottom ? `${element.tagName} "${(element.textContent ?? '').trim().slice(0, 30)}"` : null
    })
    if (overlap) hidden.push(overlap)
  }
  expect(hidden).toEqual([])
})

test('login prende o foco, associa erros e Esc fecha', async ({ page }) => {
  await reset(page)
  await addEmerald(page)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  const form = page.getByRole('form', { name: 'Login', exact: true })
  await expect(form).toBeVisible()
  const dialog = page.getByRole('dialog')
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), await focused(page)).toBe(true)
  }
  await form.getByRole('button', { name: 'Entrar', exact: true }).click()
  const email = form.getByLabel('E-mail', { exact: true })
  await expect(email).toBeFocused()
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toHaveAccessibleDescription('Informe um e-mail válido.')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/$/)
})

test('senha errada anuncia o erro e devolve o foco ao formulário (W2B-R6)', async ({ page }) => {
  test.fail(true, 'W2B-R6: auth-form.tsx desabilita o fieldset durante o envio e não devolve o foco no erro.')
  await reset(page)
  await page.goto('/entrar')
  await ready(page)
  const form = page.getByRole('form', { name: 'Login', exact: true })
  await form.getByLabel('E-mail', { exact: true }).fill('nova@kurio.dev')
  await form.getByLabel('Senha', { exact: true }).fill('errada123')
  await form.getByLabel('Senha', { exact: true }).press('Enter')
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await expect(form.getByLabel('Senha', { exact: true })).toBeFocused({ timeout: 2_000 })
})

test('pagamento: erro de campo recebe foco e descrição; revisão prende o foco', async ({ page }) => {
  await reset(page)
  await addEmerald(page)
  const review = await reviewPurchase(page)
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), await focused(page)).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(review).toBeHidden()
  const isMobile = await page.getByRole('button', { name: 'Revisar dados', exact: true }).isVisible()
  if (isMobile) await page.getByRole('button', { name: 'Revisar dados', exact: true }).click()
  const name = page.getByLabel(/^Nome de exibição/)
  await name.fill('')
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).filter({ visible: true }).click()
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(name).toHaveAccessibleDescription('Informe o nome de exibição.')
  await expect(page.getByRole('alert').filter({ hasText: 'Revise 1 campo(s) destacado(s).' })).toBeAttached()
})

test('fechar a revisão devolve o foco a "Confirmar compra" (W2B-R1)', async ({ page }) => {
  test.fail(true, 'W2B-R1: pagamento.tsx desmonta o ReviewDialog ao fechar; o Radix não consegue restaurar o foco.')
  await reset(page)
  await addEmerald(page)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await signIn(page)
  const cta = page.getByRole('button', { name: 'Confirmar compra', exact: true }).filter({ visible: true })
  await expect(cta).toBeEnabled()
  await cta.focus()
  await page.keyboard.press('Enter')
  const review = page.getByRole('dialog', { name: 'Revise sua compra' })
  await expect(review).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(review).toBeHidden()
  await expect(cta).toBeFocused({ timeout: 2_000 })
})

test('"Confirmar compra" desabilitado explica que a cotação da nova rede está chegando (C-1, W2B-R3)', async ({ page, isMobile }) => {
  test.fail(true, 'W2B-R3: o botão fica disabled sem aria-describedby nem anúncio do motivo.')
  const network = await leoCheckout(page, isMobile)
  // Condição do servidor: segura a próxima cotação para a troca de rede ficar observável.
  await page.evaluate(() => window.__kurioMock!.holdNext('cart.quote'))
  await network.selectOption('polygon')
  const cta = page.getByRole('button', { name: 'Confirmar compra', exact: true }).filter({ visible: true })
  await expect(cta).toBeDisabled()
  await expect(cta).toHaveAccessibleDescription(/cotação|valores/i, { timeout: 2_000 })
  await page.evaluate(() => window.__kurioMock!.releaseHeld('cart.quote'))
  await expect(cta).toBeEnabled()
  await expect(cta).toHaveAccessibleDescription('')
})

test('total do pagamento mobile é anunciado quando a cotação muda (W2B-R4)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'No desktop o resumo (QuoteTotals) já tem a região aria-live.')
  test.fail(true, 'W2B-R4: a região aria-live do total está só no <aside> desktop (display:none no mobile).')
  const network = await leoCheckout(page, isMobile)
  await network.selectOption('polygon')
  const live = page.locator('[aria-live="polite"]', { hasText: 'Total atualizado: 0.992 ETH' })
  await expect.poll(() => live.evaluateAll((nodes) => nodes.some((node) => (node as HTMLElement).checkVisibility()))).toBe(true)
})

test('títulos do carrinho não cortam descendentes (W2B-R5)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Só o cartão mobile (15 px em linha de 16 px) corta; a tabela desktop cabe.')
  test.fail(true, 'W2B-R5: cart-lines.tsx usa truncate com line-height 16 px em fonte de 15–16 px; o "p" de "Ape" é cortado.')
  await reset(page)
  await addEmerald(page)
  const title = page.getByRole('link', { name: 'Emerald Ape #042', exact: true }).filter({ visible: true })
  const [scroll, client] = await title.evaluate((link) => [link.scrollHeight, link.clientHeight])
  expect(scroll).toBeLessThanOrEqual(client)
})

test('recibo confirmado com movimento reduzido não anima deslocamento nem escala', async ({ page }) => {
  await reset(page)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('confirm'))
  await addEmerald(page)
  const review = await reviewPurchase(page)
  await review.getByRole('button', { name: /^Confirmar e pagar/ }).click()
  const heading = page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })
  await expect(heading).toBeVisible({ timeout: 15_000 })
  await expect(heading).toBeFocused()
  const moving = await page.evaluate(() =>
    document.getAnimations().flatMap((animation) => {
      const effect = animation.effect as KeyframeEffect | null
      const frames = effect?.getKeyframes() ?? []
      const target = effect?.target as Element | null
      const moves = frames.some((frame) => (frame.transform && frame.transform !== 'none' && !/^translateY\(0(px)?\)$/.test(String(frame.transform))) || frame.scale || frame.translate)
      return moves && target && getComputedStyle(target).display !== 'none' ? [`${(animation as CSSAnimation).animationName} @ ${target.className}`] : []
    }),
  )
  expect(moving).toEqual([])
})

/** Equivalente ao zoom de 200% numa janela de 1440 × 1000: 720 × 500 px CSS. */
test('zoom de 200% (720 px) não cria rolagem horizontal nem corta ações', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Uma passada basta; mobile tem nft-mobile-layout (texto a 200%) e responsive (320 px).')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 720, height: 500 })
  const fits = async (label: string, actions: Locator[]) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth), label).toBeLessThanOrEqual(720)
    for (const action of actions) {
      await action.scrollIntoViewIfNeeded()
      const box = (await action.boundingBox())!
      expect(box.x, label).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width, label).toBeLessThanOrEqual(720)
    }
  }
  await reset(page)
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeAttached()
  await fits('início', [page.getByRole('button', { name: /^Filtros/ })])
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  await fits('detalhe', [page.getByRole('button', { name: 'Comprar NFT', exact: true })])
  await page.getByRole('button', { name: 'Comprar NFT', exact: true }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
  await fits('carrinho', [page.getByRole('link', { name: 'Conectar e finalizar' })])
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await signIn(page)
  const cta = page.getByRole('button', { name: 'Confirmar compra', exact: true }).filter({ visible: true })
  await expect(cta).toBeEnabled()
  await fits('pagamento', [cta])
  await cta.click()
  const review = page.getByRole('dialog', { name: 'Revise sua compra' })
  await fits('revisão', [review.getByRole('button', { name: 'Fechar revisão', exact: true }), review.getByRole('button', { name: 'Conectar carteira', exact: true })])
  await page.keyboard.press('Escape')
  for (const route of ['/perfil', '/carteiras']) {
    await page.goto(route)
    await ready(page)
    await expect(page.locator('main form:visible').first()).toBeVisible()
    await fits(route, [page.locator('main form:visible button[type="submit"]').first()])
  }
})
