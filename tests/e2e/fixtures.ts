import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio2026!', username: 'ana.coleciona' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio2026!', username: 'bruno.nft' },
}

type Opts = { scenario: string; latency: boolean }

export const test = base.extend<Opts>({
  scenario: ['default', { option: true }],
  latency: [false, { option: true }],
  page: async ({ page, scenario, latency }, use) => {
    await page.addInitScript(({ scenario, latency }) => {
      if (sessionStorage.getItem('__e2e_init')) return
      sessionStorage.setItem('__e2e_init', '1')
      localStorage.setItem('kurio:mock:scenario', scenario)
      if (!latency) localStorage.setItem('kurio:mock:no-latency', '1')
    }, { scenario, latency })
    await use(page)
  },
})
export { expect }

export async function mock(page: Page, path: string, body: unknown = {}) {
  return page.evaluate(async ({ path, body }) => {
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return r.json()
  }, { path, body })
}

export async function setScenario(page: Page, name: string) {
  await mock(page, '/__mock/scenario', { name })
}

export async function waitRealtime(page: Page) {
  await expect(page.locator('footer [aria-live]')).toHaveText(/conectado$/, { timeout: 10_000 })
}

export async function login(page: Page, user = USERS.ana, from = '/entrar') {
  await page.goto(from)
  await page.getByPlaceholder('contato@email.com').fill(user.email)
  await page.getByPlaceholder('Senha').fill(user.password)
  await page.locator('main').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Você entrou na sua conta.')).toBeVisible()
}

export async function addToCart(page: Page, nftId: string, qty = 1) {
  await page.goto(`/nft/${nftId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (let i = 1; i < qty; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByText('Adicionado ao carrinho.')).toBeVisible()
}

export async function reviewCheckout(page: Page) {
  await page.goto('/checkout')
  await expect(page.locator('#collector-address')).not.toHaveValue('')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText(/^Conectada:/)).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).last().click()
  await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeVisible()
}
