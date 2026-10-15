/**
 * Auditoria Lighthouse: build otimizado + cenário padrão dos mocks.
 * 3 execuções por página/perfil; o relatório usa a mediana (scripts/lighthouse-median.mjs).
 * Perfis: mobile (padrão do Lighthouse, Moto G Power + 4G lento) e desktop (preset desktop).
 */
const urls = ['http://127.0.0.1:4173/', 'http://127.0.0.1:4173/nft/emerald-ape-042']
const preset = process.env.LH_PRESET === 'desktop' ? 'desktop' : undefined

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
      startServerReadyPattern: 'Local',
      url: urls,
      numberOfRuns: 3,
      chromePath: process.env.CHROME_PATH || undefined,
      settings: {
        ...(preset ? { preset } : {}),
        chromeFlags: '--headless=new --no-sandbox',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['warn', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:seo': ['warn', { minScore: 0.9, aggregationMethod: 'median-run' }],
      },
    },
    upload: { target: 'filesystem', outputDir: `./lighthouse/reports/${preset ?? 'mobile'}` },
  },
}
