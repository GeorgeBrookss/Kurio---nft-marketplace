import { addToCart, expect, login, test } from './fixtures'

test.describe('Regressão visual @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })
  async function settle(page: import('@playwright/test').Page) {
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.setAttribute('loading', 'eager')))
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  }
  const mask = (page: import('@playwright/test').Page) => [page.locator('[data-sonner-toaster]'), page.locator('footer [aria-hidden][title^="Tempo real"]')]

  test('início', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#catalogo article')).toHaveCount(9)
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true, mask: mask(page), timeout: 20_000 })
  })
  test('detalhe', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('#more-title ~ div article')).toHaveCount(5)
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true, mask: mask(page), timeout: 20_000 })
  })
  test('carrinho', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await page.goto('/carrinho')
    await expect(page.getByText('1.206 ETH')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true, mask: mask(page), timeout: 20_000 })
  })
  test('pagamento', async ({ page }) => {
    await login(page)
    await addToCart(page, 'emerald-ape-042')
    await page.goto('/checkout')
    await expect(page.locator('#collector-address')).not.toHaveValue('')
    await expect(page.getByText('1.206 ETH')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true, mask: mask(page), timeout: 20_000 })
  })
})
