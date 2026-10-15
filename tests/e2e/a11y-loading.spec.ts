import { expect, setScenario, test } from './fixtures'

test.describe('Acessibilidade', () => {
  test('pular para conteúdo, foco visível e foco preso no diálogo', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#catalogo article').first()).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()

    const entrar = page.getByRole('banner').getByRole('button', { name: 'Entrar' })
    await entrar.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(entrar).toBeFocused()
  })

  test('erros de formulário associados aos campos', async ({ page }) => {
    await page.goto('/entrar')
    await page.locator('main').getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.locator('#login-email')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Informe um e-mail válido')
    await expect(email).toBeFocused()
  })
})

test.describe('Carregamento e falhas', () => {
  test.describe('lento', () => {
    test.use({ scenario: 'slow', latency: true })
    test('skeletons durante carregamento lento @mobile', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByLabel('Carregando catálogo')).toBeVisible()
      await expect(page.locator('#catalogo article').first()).toBeVisible({ timeout: 10_000 })
      await page.goto('/nft/emerald-ape-042')
      await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    })
  })

  test.describe('erro', () => {
    test.use({ scenario: 'server-error' })
    test('feedback de falha e recuperação após nova tentativa', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('alert').getByText('Não foi possível carregar o catálogo.').first()).toBeVisible({ timeout: 15_000 })
      await setScenario(page, 'default')
      await page.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page.locator('#catalogo article').first()).toBeVisible()
    })
  })

  test.describe('instável', () => {
    test.use({ scenario: 'flaky' })
    test('falha transitória é recuperada por retry automático', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('#catalogo article').first()).toBeVisible({ timeout: 10_000 })
    })
  })
})
