import { mulberry32 } from './fixtures'

export const SCENARIOS = {
  default: 'Latência curta e estável; tudo funciona.',
  slow: 'Todas as respostas levam ~2,5 s (skeletons).',
  'variable-latency': 'Latência alternada no catálogo: requisições ímpares lentas => respostas fora de ordem.',
  empty: 'Catálogo vazio.',
  offline: 'Falha de conexão em todas as chamadas REST.',
  flaky: 'Primeira chamada de cada rota GET retorna 503; a nova tentativa funciona.',
  'server-error': 'Catálogo e detalhe retornam 500.',
  'session-expired': 'Sessões expiram 45 s após o login.',
  'favorites-fail': 'Mutations de favoritos retornam 500 (rollback otimista).',
  'price-change': 'Na primeira tentativa de pedido o preço do 1º item sobe 10% (QUOTE_STALE).',
  'sold-out': 'Na primeira tentativa de pedido a edição do 1º item esgota.',
  'order-timeout': 'O pedido é criado, mas a resposta demora mais que o timeout do Axios.',
  'payment-declined': 'O pagamento é recusado na liquidação.',
  'wallet-reject': 'A conexão com a carteira é recusada.',
} as const
export type ScenarioName = keyof typeof SCENARIOS

const KEY = 'kurio:mock:scenario'

export function initScenarioFromUrl() {
  const fromUrl = new URLSearchParams(window.location.search).get('scenario')
  if (fromUrl && fromUrl in SCENARIOS) localStorage.setItem(KEY, fromUrl)
}
export function getScenario(): ScenarioName {
  const v = localStorage.getItem(KEY)
  return v && v in SCENARIOS ? (v as ScenarioName) : 'default'
}
export function setScenario(name: ScenarioName) {
  localStorage.setItem(KEY, name)
  counters.clear()
  rnd = mulberry32(42)
}

let rnd = mulberry32(42)
const counters = new Map<string, number>()
export function hit(route: string) {
  const n = (counters.get(route) ?? 0) + 1
  counters.set(route, n)
  return n
}

export function latencyFor(route: string): number {
  if (import.meta.env.MODE === 'test' || localStorage.getItem('kurio:mock:no-latency') === '1') return 0
  const s = getScenario()
  if (s === 'slow') return 2500
  if (s === 'variable-latency' && route === 'GET /nfts') {
    const n = counters.get(route) ?? 1
    return n % 2 === 1 ? 1800 : 200
  }
  return 120 + Math.floor(rnd() * 250)
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
