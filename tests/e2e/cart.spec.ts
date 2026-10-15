import { addToCart, expect, login, test } from './fixtures'

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh e login @mobile', async ({ page }) => {
    test.setTimeout(90_000)
    await addToCart(page, 'emerald-ape-042')
    await addToCart(page, 'ivory-baron-088')
    await page.goto('/carrinho')
    await expect(page.getByText('2.996 ETH')).toBeVisible()

    await page.getByRole('group', { name: 'Quantidade de Emerald Ape #042' }).getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(page.getByText('4.186 ETH')).toBeVisible()

    const coupon = page.getByLabel('Código promocional')
    await coupon.fill('XYZ')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Código promocional inválido.')).toBeVisible()
    await coupon.fill('LANCAMENTO20')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Este código promocional expirou.')).toBeVisible()
    await coupon.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Código KURIO10 aplicado')).toBeVisible()
    await expect(page.getByText('3.769 ETH')).toBeVisible()

    await page.getByRole('button', { name: 'Remover Ivory Baron #088 do carrinho' }).click()
    await expect(page.getByRole('link', { name: 'Ivory Baron #088' })).toBeHidden()

    await page.reload()
    await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()

    await login(page)
    await page.goto('/carrinho')
    await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByText('Código KURIO10 aplicado')).toBeVisible()
  })
})
