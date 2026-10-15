import { expect, test } from './fixtures'

const cards = (page: import('@playwright/test').Page) => page.locator('#catalogo article h3')

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e histórico @mobile', async ({ page, isMobile }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(9)

    await page.getByLabel('Ordenar por:').selectOption('price_asc')
    await expect(page).toHaveURL(/sort=price_asc/)

    if (isMobile) await page.getByRole('button', { name: 'Filtros' }).click()
    const scope = isMobile ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Filtros' })
    await scope.getByRole('button', { name: /Ethereum/ }).click()
    await expect(page).toHaveURL(/network=ethereum/)
    await scope.getByRole('button', { name: /Arte digital/ }).click()
    await expect(page).toHaveURL(/category=arte-digital/)
    if (isMobile) await page.keyboard.press('Escape')

    const prices = await page.locator('#catalogo article p.text-primary').allInnerTexts()
    const nums = prices.map((p) => parseFloat(p))
    expect(nums).toEqual([...nums].sort((a, b) => a - b))

    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await page.getByRole('searchbox', { name: 'Explorar coleções' }).first().fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    await expect(page).not.toHaveURL(/page=2/)
    await expect(cards(page).first()).toContainText('Golden')

    await page.reload()
    await expect(page.getByRole('searchbox', { name: 'Explorar coleções' }).first()).toHaveValue('golden')
    await expect(cards(page).first()).toContainText('Golden')

    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(page).not.toHaveURL(/q=golden/)
  })

  test('resultado vazio oferece limpar filtros', async ({ page }) => {
    await page.goto('/?q=inexistente-xyz')
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(cards(page)).toHaveCount(9)
  })

  test.describe('respostas fora de ordem', () => {
    test.use({ scenario: 'variable-latency', latency: true })
    test('a resposta lenta e antiga não sobrescreve a atual', async ({ page }) => {
      await page.goto('/')
      await expect(cards(page)).toHaveCount(9, { timeout: 10_000 })
      const tablist = page.getByRole('tablist', { name: 'Seções do catálogo' })
      await tablist.getByRole('tab', { name: 'Em alta' }).click()
      await page.getByLabel('Ordenar por:').selectOption('price_desc')
      await page.waitForTimeout(2500)
      await expect(page).toHaveURL(/sort=price_desc/)
      const prices = (await page.locator('#catalogo article p.text-primary').allInnerTexts()).map((p) => parseFloat(p))
      expect(prices).toEqual([...prices].sort((a, b) => b - a))
    })
  })
})

test.describe('Detalhe', () => {
  test('acesso direto, edição esgotada e limite de quantidade @mobile', async ({ page }) => {
    await page.goto('/nft/golden-signal-160')
    await expect(page.getByRole('heading', { level: 1, name: 'Golden Signal #160' })).toBeVisible()
    await expect(page.getByRole('button', { name: '1/1 (esgotada)', exact: true })).toHaveAttribute('aria-disabled', 'true')
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
    for (let i = 0; i < 60 && (await plus.isEnabled()); i++) await plus.click()
    await expect(plus).toBeDisabled()
  })

  test('NFT inexistente mostra 404 e rota inexistente também', async ({ page }) => {
    await page.goto('/nft/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})
