// Lê os JSON gerados pelo LHCI e imprime a mediana por página/perfil (categorias + LCP, CLS, TBT).
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const rows = []
for (const profile of ['mobile', 'desktop']) {
  const dir = join('lighthouse/reports', profile)
  if (!existsSync(dir)) continue
  const byUrl = new Map()
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.report.json'))) {
    const lhr = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    if (!lhr.categories) continue
    const list = byUrl.get(lhr.finalDisplayedUrl) ?? []
    list.push(lhr)
    byUrl.set(lhr.finalDisplayedUrl, list)
  }
  for (const [url, runs] of byUrl) {
    const cat = (k) => Math.round(median(runs.map((r) => r.categories[k].score)) * 100)
    const audit = (k) => median(runs.map((r) => r.audits[k].numericValue))
    rows.push({ profile, url, runs: runs.length, performance: cat('performance'), accessibility: cat('accessibility'), bestPractices: cat('best-practices'), seo: cat('seo'), lcpMs: Math.round(audit('largest-contentful-paint')), cls: +audit('cumulative-layout-shift').toFixed(3), tbtMs: Math.round(audit('total-blocking-time')), lighthouse: runs[0].lighthouseVersion, chrome: runs[0].environment?.hostUserAgent })
  }
}
console.table(rows.map(({ chrome: _c, ...r }) => r))
writeFileSync('lighthouse/reports/summary.json', JSON.stringify(rows, null, 2))
