import { test, expect } from '@playwright/test'
import { ready, reset, signIn } from './helpers'

/** Conta e sessão: expiração fora do checkout, isolamento entre usuários e falhas transitórias. */
test.beforeEach(async ({ page }) => reset(page))

const favoriteButton = /^Favoritado$|^Remover Emerald Ape #042 dos favoritos$/

test('sessão que expira durante a navegação privada retoma a tela pedida após o login', async ({ page }) => {
  await page.goto('/perfil')
  await signIn(page)
  await expect(page.getByRole('form', { name: 'Perfil do colecionador' })).toBeVisible()
  await page.evaluate(() => window.__kurioMock!.expireSessions())
  await page.getByRole('navigation', { name: 'Meu perfil' }).getByRole('link', { name: 'Carteiras' }).click()
  await expect(page).toHaveURL(/\/entrar\?.*motivo=expirada/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/carteiras')
  await expect(page.getByText('Sua sessão expirou. Entre novamente para retomar de onde parou.')).toBeVisible()
  await signIn(page)
  await expect(page).toHaveURL(/\/carteiras$/)
  await expect(page.getByRole('form', { name: 'Carteira principal', exact: true })).toBeVisible()
})

test('troca de usuário não mostra favoritos nem perfil da conta anterior', async ({ page }) => {
  await page.goto('/entrar?redirect=/nft/emerald-ape-042')
  await signIn(page)
  await ready(page)
  // O botão muda de forma otimista: espera o servidor gravar antes de sair da página.
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === '/api/favorites/emerald-ape-042')
  await page.getByRole('button', { name: /^Favoritar/ }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByRole('button', { name: favoriteButton })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/favoritos')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()

  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/entrar?redirect=/favoritos')
  await signIn(page, 'leo@kurio.dev')
  await expect(page).toHaveURL(/\/favoritos$/)
  // Seed: Leo favoritou Neon Vessel #552 e Golden Beat #207; o favorito de Nova não pode aparecer.
  await expect(page.getByRole('link', { name: 'Neon Vessel #552', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Golden Beat #207', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeHidden()
  await page.goto('/perfil')
  const form = page.getByRole('form', { name: 'Perfil do colecionador' })
  await expect(form.getByLabel(/^Nome de usuário/)).toHaveValue('leo.martins')
  await expect(page.getByRole('main')).not.toContainText('nova@kurio.dev')
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('button', { name: /^Favoritar/ })).toHaveAttribute('aria-pressed', 'false')
})

test('falha transitória ao salvar perfil e carteira preserva o que foi digitado e permite repetir', async ({ page }) => {
  await page.goto('/perfil')
  await signIn(page)
  const form = page.getByRole('form', { name: 'Perfil do colecionador' })
  await expect(form).toBeVisible()
  await page.evaluate(() => window.__kurioMock!.failNext('profile.update', 'server-error'))
  await form.getByLabel(/^Nome de exibição/).fill('Nova Depois da Falha')
  await form.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('Tente novamente')
  await expect(form.getByLabel(/^Nome de exibição/)).toHaveValue('Nova Depois da Falha')
  await form.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(form.getByRole('status')).toHaveText('Perfil atualizado.')

  await page.getByRole('navigation', { name: 'Meu perfil' }).getByRole('link', { name: 'Carteiras' }).click()
  const primary = page.getByRole('form', { name: 'Carteira principal', exact: true })
  await page.evaluate(() => window.__kurioMock!.failNext('wallets.save', 'network'))
  await primary.getByLabel(/^Apelido da carteira/).fill('Principal após falha')
  await primary.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(primary.getByRole('alert')).toBeVisible()
  await expect(primary.getByLabel(/^Apelido da carteira/)).toHaveValue('Principal após falha')
  await primary.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(primary.getByRole('status')).toHaveText('Carteira principal salva.')

  await page.reload()
  await ready(page)
  await expect(primary.getByLabel(/^Apelido da carteira/)).toHaveValue('Principal após falha')
  await page.getByRole('navigation', { name: 'Meu perfil' }).getByRole('link', { name: 'Perfil' }).click()
  await expect(form.getByLabel(/^Nome de exibição/)).toHaveValue('Nova Depois da Falha')
})
