import { addToCart, expect, login, reviewCheckout, test, waitRealtime } from './fixtures'

test.describe('Compra', () => {
  test('compra completa do catálogo ao recibo @mobile', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Emerald Ape #042/ }).first().click()
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL(/\/carrinho/)
    await expect(page.getByText('2.396 ETH')).toBeVisible()

    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect/)
    await page.getByPlaceholder('contato@email.com').fill('ana@kurio.dev')
    await page.getByPlaceholder('Senha').fill('Kurio2026!')
    await page.locator('main').getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await waitRealtime(page)

    await reviewCheckout(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/pedido\/ord_/)
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação na rede' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('cell', { name: '2.38 ETH' })).toBeVisible()
    await expect(page.getByText('2.396 ETH').first()).toBeVisible()

    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('recibo é snapshot: mudança posterior no catálogo não altera valores', async ({ page }) => {
    await login(page)
    await addToCart(page, 'sage-nomad-009')
    await reviewCheckout(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 10_000 })
    const url = page.url()
    await page.evaluate(() => fetch('/__mock/nfts/sage-nomad-009', { method: 'POST', body: JSON.stringify({ priceDeltaPct: 50 }) }))
    await page.goto(url)
    await expect(page.getByRole('cell', { name: '1.69 ETH' })).toBeVisible()
  })
})

test.describe('Falhas de pagamento', () => {
  test.describe('recusa', () => {
    test.use({ scenario: 'payment-declined' })
    test('pagamento recusado preserva o carrinho', async ({ page }) => {
      await login(page)
      await addToCart(page, 'emerald-ape-042')
      await reviewCheckout(page)
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
      await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
    })
  })

  test('cliques repetidos criam um único pedido', async ({ page }) => {
    await login(page)
    await addToCart(page, 'emerald-ape-042')
    await reviewCheckout(page)
    const posts: string[] = []
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/orders')) posts.push(r.url()) })
    await page.getByRole('button', { name: 'Confirmar compra' }).evaluate((b: HTMLButtonElement) => { b.click(); b.click(); b.click() })
    await expect(page).toHaveURL(/\/pedido\/ord_/)
    expect(posts).toHaveLength(1)
  })

  test.describe('timeout', () => {
    test.use({ scenario: 'order-timeout' })
    test('timeout após criar o pedido recupera o MESMO pedido pela idempotência', async ({ page }) => {
      test.setTimeout(60_000)
      await login(page)
      await addToCart(page, 'emerald-ape-042')
      await reviewCheckout(page)
      const keys: string[] = []
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/orders')) keys.push(r.headers()['idempotency-key'] ?? '') })
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 25_000 })
      expect(keys.length).toBeGreaterThanOrEqual(2)
      expect(new Set(keys).size).toBe(1)
      await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 10_000 })
    })
  })
})
