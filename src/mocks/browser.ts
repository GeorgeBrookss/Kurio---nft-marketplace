import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { initScenarioFromUrl } from './scenarios'

export async function startMocks() {
  initScenarioFromUrl()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  const post = (url: string, body?: unknown) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => r.json())
  Object.assign(window, {
    __kurioMock: {
      reset: () => post('/__mock/reset'),
      scenario: (name: string) => post('/__mock/scenario', { name }),
      updateNft: (id: string, change: { priceDeltaPct?: number; available?: number; edition?: string }) => post(`/__mock/nfts/${id}`, change),
      dropRealtime: (offlineMs = 0) => post('/__mock/realtime/drop', { offlineMs }),
      replay: (kind: 'duplicate' | 'stale') => post('/__mock/realtime/replay', { kind }),
      expireSessions: () => post('/__mock/session/expire'),
    },
  })
  return worker
}
