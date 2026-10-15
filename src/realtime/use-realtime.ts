import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import type { Cart, CatalogResponse, ClientToServerEvents, Nft, NftUpdatedEvent, Order, OrderUpdatedEvent, ServerToClientEvents } from '@/api/contracts'
import { qk } from '@/api/queries'
import { useSession } from '@/features/session/session-store'
import { formatEth } from '@/lib/money'
import { VersionTracker } from './version-tracker'

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.kurio.mock'

export type RealtimeStatus = 'connecting' | 'online' | 'offline'
let status: RealtimeStatus = 'connecting'
const subs = new Set<() => void>()
function setStatus(s: RealtimeStatus) { status = s; subs.forEach((f) => f()) }
export function useRealtimeStatus() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => status, () => status)
}

function applyNft(qc: QueryClient, e: NftUpdatedEvent) {
  const std = e.data.editions.find((x) => x.type === '1/50')
  qc.setQueriesData<CatalogResponse>({ queryKey: qk.nftLists() }, (old) => old && {
    ...old,
    items: old.items.map((n) => (n.id === e.resource.id && n.version < e.version
      ? { ...n, priceEth: e.data.priceEth, version: e.version, soldOut: (std?.available ?? 0) === 0 }
      : n)),
  })
  qc.setQueryData<Nft>(qk.nft(e.resource.id), (old) => (old && old.version < e.version ? { ...old, priceEth: e.data.priceEth, editions: e.data.editions, version: e.version } : old))

  const carts = qc.getQueriesData<Cart>({ queryKey: ['cart'] })
  for (const [key, cart] of carts) {
    const item = cart?.items.find((i) => i.nftId === e.resource.id)
    if (!item) continue
    void qc.invalidateQueries({ queryKey: key })
    void qc.invalidateQueries({ queryKey: ['quote', key[1]] })
    const ed = e.data.editions.find((x) => x.type === item.edition)
    if (ed && ed.available < item.quantity) toast.warning(`${item.name}: disponibilidade alterada`, { description: ed.available ? `Restam ${ed.available} unidade(s) na edição ${item.edition}.` : 'Edição esgotada.' })
    else if (ed && ed.priceEth !== item.unitPriceEth) toast.info(`${item.name}: preço alterado`, { description: `${formatEth(item.unitPriceEth)} → ${formatEth(ed.priceEth)}. O resumo foi atualizado.` })
  }
}

function applyOrder(qc: QueryClient, uid: string, e: OrderUpdatedEvent) {
  const key = qk.order(uid, e.resource.id)
  let changed = false
  qc.setQueryData<Order>(key, (old) => {
    if (!old || old.version >= e.version) return old
    changed = true
    return { ...old, ...e.data, version: e.version }
  })
  if (!qc.getQueryData(key)) void qc.invalidateQueries({ queryKey: key })
  if (changed && e.data.status !== 'pending') {
    void qc.invalidateQueries({ queryKey: ['cart'] })
    void qc.invalidateQueries({ queryKey: ['quote'] })
  }
}

export function useRealtime() {
  const qc = useQueryClient()
  const session = useSession()
  const token = session?.token
  const uid = session?.user.id

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      cleanup = connect(io)
    })
    return () => { disposed = true; cleanup() }

    function connect(io: typeof import('socket.io-client').io) {
    const tracker = new VersionTracker()
    let connectedOnce = false
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
      transports: ['websocket'],
      query: token ? { token } : {},
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 5000,
    })
    setStatus('connecting')

    socket.on('connect', () => {
      setStatus('online')
      if (connectedOnce) {
        void qc.invalidateQueries({ queryKey: ['nfts'] })
        void qc.invalidateQueries({ queryKey: ['cart'] })
        void qc.invalidateQueries({ queryKey: ['quote'] })
        if (uid) void qc.invalidateQueries({ queryKey: [...qk.private(uid), 'order'] })
      }
      connectedOnce = true
    })
    socket.on('disconnect', () => setStatus('offline'))
    socket.io.on('reconnect_attempt', () => setStatus('connecting'))

    socket.on('nft.updated', (e) => { if (tracker.accept(e)) applyNft(qc, e) })
    socket.on('order.updated', (e) => { if (uid && tracker.accept(e)) applyOrder(qc, uid, e) })

    return () => {
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
    }
    }
  }, [qc, token, uid])
}
