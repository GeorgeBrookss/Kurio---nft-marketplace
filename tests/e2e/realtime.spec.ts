import { addToCart, expect, login, mock, reviewCheckout, test, waitRealtime } from './fixtures'

test.describe('Tempo real (Socket.IO via MSW)', () => {
  test('alteração de preço no carrinho atualiza o resumo e é anunciada', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await page.goto('/carrinho')
    await waitRealtime(page)
    await expect(page.getByText('1.206 ETH')).toBeVisible()
    await mock(page, '/__mock/nfts/emerald-ape-042', { priceDeltaPct: 10 })
    await expect(page.getByText('Emerald Ape #042: preço alterado')).toBeVisible()
    await expect(page.getByText('1.326 ETH')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Preço alterado de 1.19 ETH para 1.31 ETH' })).toBeVisible()
  })

  test('edição esgotada bloqueia a finalização', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await page.goto('/carrinho')
    await waitRealtime(page)
    await mock(page, '/__mock/nfts/emerald-ape-042', { available: 0 })
    await expect(page.getByText('Edição esgotada. Remova o item para continuar.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
  })

  test('preço muda durante a revisão do checkout: exige nova confirmação', async ({ page }) => {
    await login(page)
    await addToCart(page, 'emerald-ape-042')
    await waitRealtime(page)
    await reviewCheckout(page)
    await mock(page, '/__mock/nfts/emerald-ape-042', { priceDeltaPct: 10 })
    await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeHidden()
    await expect(page.getByText(/Os valores mudaram enquanto você revisava/)).toBeVisible()
    await page.getByRole('button', { name: 'Revisar pedido' }).last().click()
    await expect(page.getByRole('dialog').getByText('1.326 ETH')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('cell', { name: '1.31 ETH' })).toBeVisible()
  })

  test('eventos duplicados ou antigos não regridem estado nem repetem efeitos', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await page.goto('/carrinho')
    await waitRealtime(page)
    await page.evaluate(() => {
      const w = window as unknown as { __notices: number }
      w.__notices = 0
      new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement && n.textContent?.includes('Emerald Ape #042: preço alterado')) w.__notices++
      }))).observe(document.body, { subtree: true, childList: true })
    })
    await mock(page, '/__mock/nfts/emerald-ape-042', { priceDeltaPct: 10 })
    await expect(page.getByText('1.326 ETH')).toBeVisible()
    await mock(page, '/__mock/realtime/replay', { kind: 'duplicate' })
    await mock(page, '/__mock/realtime/replay', { kind: 'stale' })
    await page.waitForTimeout(800)
    expect(await page.evaluate(() => (window as unknown as { __notices: number }).__notices)).toBe(1)
    await expect(page.getByText('1.326 ETH')).toBeVisible()
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByText('1.31 ETH').first()).toBeVisible()
  })

  test('evento perdido durante desconexão é reconciliado via REST ao reconectar', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await waitRealtime(page)
    await expect(page.getByText('1.19 ETH').first()).toBeVisible()
    await mock(page, '/__mock/realtime/drop', { offlineMs: 2500 })
    await expect(page.locator('footer [aria-live]')).not.toHaveText(/conectado$/)
    await mock(page, '/__mock/nfts/emerald-ape-042', { priceDeltaPct: 20 })
    await waitRealtime(page)
    await expect(page.getByText('1.43 ETH').first()).toBeVisible()
  })

  test('pedido pendente sobrevive a desconexão e refresh sem nova compra', async ({ page }) => {
    await login(page)
    await addToCart(page, 'emerald-ape-042')
    await waitRealtime(page)
    await reviewCheckout(page)
    let posts = 0
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/orders')) posts++ })
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação na rede' })).toBeVisible()
    await mock(page, '/__mock/realtime/drop', { offlineMs: 5000 })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 12_000 })
    expect(posts).toBe(1)
  })

  test.describe('revalidação no servidor', () => {
    test.use({ scenario: 'price-change' })
    test('QUOTE_STALE no envio exige revisar e confirmar novamente', async ({ page }) => {
      await login(page)
      await addToCart(page, 'emerald-ape-042')
      await reviewCheckout(page)
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      await expect(page.getByText(/Os valores mudaram desde a sua revisão/)).toBeVisible()
      await page.getByRole('button', { name: 'Revisar pedido' }).last().click()
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 10_000 })
    })
  })
})
