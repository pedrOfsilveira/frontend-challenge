import { expect, type Page, type Request } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Helpers for the requirement-gap specs. Same rule as `helpers.ts`: user operations go
 * through the UI; `window.__kurioMock` only changes simulated server conditions.
 */

const path = (request: Request) => new URL(request.url()).pathname

/** Outgoing catalog list requests (page-level, before MSW answers them). */
export function recordListRequests(page: Page) {
  const seen: URLSearchParams[] = []
  page.on('request', (request) => {
    if (request.method() === 'GET' && path(request) === '/api/nfts') seen.push(new URL(request.url()).searchParams)
  })
  return seen
}

/** Ids of the NFTs rendered in the catalog grid, in display order. */
export function catalogIds(page: Page) {
  return page
    .getByRole('region', { name: 'Catálogo de NFTs' })
    .locator('ul > li a[href^="/nft/"]')
    .evaluateAll((links) => [...new Set(links.map((a) => new URL((a as HTMLAnchorElement).href).pathname.replace('/nft/', '')))])
}

/** Desktop shows the filter sidebar; mobile opens the filter dialog. */
export async function filterPanel(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole('complementary', { name: 'Filtros' })
  await page.getByRole('button', { name: /^Filtros/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Filtros' })
  await expect(dialog).toBeVisible()
  return dialog
}

/** From the cart: log in as Nova, land on checkout and open the review dialog (wallet still disconnected). */
export async function openReviewFromCart(page: Page) {
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await signIn(page)
  await expect(page).toHaveURL(/\/pagamento$/)
  return openReview(page)
}

export async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
  const review = page.getByRole('dialog', { name: 'Revise sua compra' })
  await expect(review).toBeVisible()
  return review
}

export async function connectWallet(review: ReturnType<Page['getByRole']>) {
  await review.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  await expect(review.getByText('Conectada', { exact: true })).toBeVisible()
}

export const payButton = (review: ReturnType<Page['getByRole']>) => review.getByRole('button', { name: /^Confirmar e pagar/ })

/** Records every POST /api/orders (status or network failure) to prove no extra order request succeeded. */
export function recordOrderPosts(page: Page) {
  const statuses: (number | 'failed')[] = []
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && path(response.request()) === '/api/orders') statuses.push(response.status())
  })
  page.on('requestfailed', (request) => {
    if (request.method() === 'POST' && path(request) === '/api/orders') statuses.push('failed')
  })
  return statuses
}

export const orderCount = (page: Page) => page.evaluate(() => window.__kurioMock!.snapshot().orders.length)
