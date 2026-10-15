import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings2 } from 'lucide-react'
import { useCart } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

const post = (url: string, body?: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => r.json())

export function ScenarioPanel() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const { data: cart } = useCart()
  const scenario = useQuery({
    queryKey: ['__mock', 'scenario'],
    queryFn: () => fetch('/__mock/scenario').then((r) => r.json() as Promise<{ current: string; available: Record<string, string> }>),
    enabled: open,
  })
  const first = cart?.items[0]
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-primary/60 px-3 py-1.5 text-xs text-primary hover:bg-primary/10">
        <Settings2 className="size-4" aria-hidden="true" /> Cenários de demonstração
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-6">
          <DialogTitle>Cenários (MSW)</DialogTitle>
          <DialogDescription>Controle a simulação de rede e eventos. Ativo: <strong>{scenario.data?.current ?? '…'}</strong></DialogDescription>
          <label htmlFor="scenario-select" className="mt-4 block text-sm font-bold">Cenário</label>
          <select id="scenario-select" value={scenario.data?.current ?? 'default'} className="mt-1 h-10 w-full rounded-sm border border-input bg-transparent px-2 text-sm [&>option]:bg-surface"
            onChange={async (e) => { await post('/__mock/scenario', { name: e.target.value }); await scenario.refetch(); void qc.invalidateQueries() }}>
            {Object.entries(scenario.data?.available ?? {}).map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}
          </select>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" disabled={!first} onClick={() => first && post(`/__mock/nfts/${first.nftId}`, { priceDeltaPct: 10, edition: first.edition })}>+10% no 1º item do carrinho</Button>
            <Button variant="outline" disabled={!first} onClick={() => first && post(`/__mock/nfts/${first.nftId}`, { available: 0, edition: first.edition })}>Esgotar 1º item</Button>
            <Button variant="outline" onClick={() => post('/__mock/realtime/replay', { kind: 'duplicate' })}>Reenviar último evento</Button>
            <Button variant="outline" onClick={() => post('/__mock/realtime/replay', { kind: 'stale' })}>Enviar evento antigo</Button>
            <Button variant="outline" onClick={() => post('/__mock/realtime/drop', { offlineMs: 5000 })}>Derrubar socket (5 s)</Button>
            <Button variant="outline" onClick={() => post('/__mock/session/expire')}>Expirar sessões</Button>
          </div>
          <Button variant="destructive" className="mt-6 w-full" onClick={async () => { await post('/__mock/reset'); localStorage.clear(); location.assign('/') }}>Resetar dados e sessão</Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
