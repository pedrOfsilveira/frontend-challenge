import { test, expect } from '@playwright/test'
import { addEmerald, ready, reset, reviewPurchase } from './helpers'

test.beforeEach(async ({ page }) => reset(page))

test('preço por Socket.IO exige nova confirmação e duplicata não regride a revisão', async ({ page }) => {
  await addEmerald(page)
  const review = await reviewPurchase(page)
  await expect.poll(() => page.evaluate(() => window.__kurioMock!.realtime.connections().some((c) => c.userId === 'user_nova'))).toBe(true)
  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { priceEth: '2.5' }))
  await expect(review.getByRole('button', { name: 'Revisei os novos valores' })).toBeVisible()
  await expect(review.getByRole('button', { name: /^Confirmar e pagar/ })).toBeDisabled()
  await expect(review).toContainText('2.50 ETH')
  await page.evaluate(() => window.__kurioMock!.updateNft('emerald-ape-042', { priceEth: '3.5' }))
  await expect(review).toContainText('3.50 ETH')
  await page.evaluate(() => {
    const events = window.__kurioMock!.events().filter((e) => e.type === 'nft.updated')
    window.__kurioMock!.realtime.replay(events[0]!.id)
    window.__kurioMock!.realtime.replay(events.at(-1)!.id)
  })
  await review.getByRole('button', { name: 'Revisei os novos valores' }).click()
  await expect(review.getByRole('button', { name: /^Confirmar e pagar 3\.516 ETH/ })).toBeEnabled()
  await expect(review).not.toContainText('2.50 ETH')
})

test('reconexão recupera confirmação perdida sem criar outro pedido', async ({ page }) => {
  await addEmerald(page)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  const review = await reviewPurchase(page)
  await review.getByRole('button', { name: /^Confirmar e pagar/ }).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
  const orderURL = page.url()
  await page.evaluate(() => window.__kurioMock!.realtime.pause())
  await expect.poll(() => page.evaluate(() => window.__kurioMock!.realtime.connections().length)).toBe(0)
  await page.evaluate(() => window.__kurioMock!.settlePendingOrders('confirm'))
  // Resume only after the simulated server changed state without a connected client.
  await page.evaluate(() => window.__kurioMock!.realtime.resume())
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  await expect(page).toHaveURL(orderURL)
  await page.reload()
  await ready(page)
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  expect(await page.evaluate(() => window.__kurioMock!.snapshot().orders.length)).toBe(1)
})

for (const failure of ['after-commit', 'timeout-after-commit'] as const) {
test(`${failure}: retry recupera o pedido persistido após uma única submissão`, async ({ page }) => {
  await addEmerald(page)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  const review = await reviewPurchase(page)
  const keys: string[] = []
  const failures: string[] = []
  const responses: number[] = []
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/orders') responses.push(response.status())
  })
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname === '/api/orders') failures.push(request.failure()?.errorText ?? '')
  })
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') {
      keys.push(request.headers()['idempotency-key'] ?? '')
    }
  })
  await page.evaluate((kind) => window.__kurioMock!.failNext('orders.create', kind), failure)
  await review.getByRole('button', { name: /^Confirmar e pagar/ }).click()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible({ timeout: failure === 'timeout-after-commit' ? 20_000 : 10_000 })
  expect(keys.length).toBeGreaterThanOrEqual(2)
  expect(keys[0]).not.toBe('')
  expect(new Set(keys).size).toBe(1)
  expect(responses).toEqual([200])
  if (failure === 'timeout-after-commit') expect(failures.some((message) => /ERR_ABORTED|ERR_TIMED_OUT/.test(message)), JSON.stringify(failures)).toBe(true)
  expect(await page.evaluate(() => window.__kurioMock!.snapshot().orders.length)).toBe(1)
  await page.evaluate(() => window.__kurioMock!.settlePendingOrders('confirm'))
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
})
}

test('clique repetido no pagamento cria apenas um pedido', async ({ page }) => {
  await addEmerald(page)
  await page.evaluate(() => window.__kurioMock!.setPaymentOutcome('hold'))
  const review = await reviewPurchase(page)
  await review.getByRole('button', { name: /^Confirmar e pagar/ }).dblclick()
  await expect(page.getByRole('heading', { name: 'Processando o pagamento…' })).toBeVisible()
  expect(await page.evaluate(() => window.__kurioMock!.snapshot().orders.length)).toBe(1)
})
