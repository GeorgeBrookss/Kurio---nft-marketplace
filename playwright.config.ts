import { defineConfig, devices } from '@playwright/test'


const executablePath = process.env.CHROME_PATH || undefined
const launchOptions = { executablePath, args: process.env.CHROME_PATH ? ['--no-proxy-server'] : [] }
const PORT = Number(process.env.E2E_PORT ?? 4173)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  reporter: [['html', { open: 'never' }], ['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CHROME_PATH ? 'off' : 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, launchOptions }, grep: /@mobile/ },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
