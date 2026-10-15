import { expect, login, setScenario, test } from './fixtures'

test.describe('Favoritos', () => {
  test('persistem para o usuário e falha de mutation faz rollback', async ({ page }) => {
    await login(page)
    await page.goto('/nft/sage-nomad-009')
    const fav = page.getByRole('button', { name: /lista de interesse/ }).first()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: /lista de interesse/ }).first()).toHaveAttribute('aria-pressed', 'true')

    await setScenario(page, 'favorites-fail')
    const fav2 = page.getByRole('button', { name: /lista de interesse/ }).first()
    await fav2.click()
    await expect(page.getByText('Não foi possível remover dos favoritos.')).toBeVisible()
    await expect(fav2).toHaveAttribute('aria-pressed', 'true')

    await setScenario(page, 'default')
    await fav2.click()
    await expect(fav2).toHaveAttribute('aria-pressed', 'false')
  })
})
