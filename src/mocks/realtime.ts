import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent, Nft } from '@/api/contracts'
import { SOCKET_URL } from './config'
import { db, type DbOrder } from './db'

const link = ws.link(`${SOCKET_URL}/*`)

interface Conn { userId: string | null; emit: (event: string, payload: unknown) => void; close: () => void }
const conns = new Set<Conn>()
const recent: Array<{ event: string; payload: NftUpdatedEvent | OrderUpdatedEvent; userId: string | null }> = []
let offlineUntil = 0

function remember(event: string, payload: NftUpdatedEvent | OrderUpdatedEvent, userId: string | null) {
  recent.push({ event, payload, userId })
  if (recent.length > 50) recent.shift()
}

export const realtimeHandler = link.addEventListener('connection', (connection) => {
  if (Date.now() < offlineUntil) {
    setTimeout(() => connection.client.close(4000, 'mock offline'), 0)
    return
  }
  const token = new URL(connection.client.url).searchParams.get('token')
  const session = token ? db().sessions[token] : undefined
  const userId = session && session.expiresAt > Date.now() ? session.userId : null
  const io = toSocketIo(connection)
  const ping = setInterval(() => connection.client.send('2'), 20_000)
  const conn: Conn = {
    userId,
    emit: (event, payload) => io.client.emit(event, payload),
    close: () => connection.client.close(),
  }
  conns.add(conn)
  connection.client.addEventListener('close', () => {
    clearInterval(ping)
    conns.delete(conn)
  })
})

export function emitNftUpdated(nft: Nft) {
  const payload: NftUpdatedEvent = {
    eventId: `evt_${crypto.randomUUID()}`,
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    emittedAt: new Date().toISOString(),
    data: { priceEth: nft.priceEth, editions: nft.editions },
  }
  remember('nft.updated', payload, null)
  conns.forEach((c) => c.emit('nft.updated', payload))
}

export function emitOrderUpdated(order: DbOrder) {
  const payload: OrderUpdatedEvent = {
    eventId: `evt_${crypto.randomUUID()}`,
    resource: { type: 'order', id: order.id },
    version: order.version,
    emittedAt: new Date().toISOString(),
    data: { id: order.id, status: order.status, declineReason: order.declineReason, settledAt: order.settledAt, txHash: order.txHash },
  }
  remember('order.updated', payload, order.userId)
  conns.forEach((c) => { if (c.userId === order.userId) c.emit('order.updated', payload) })
}

export function replay(kind: 'duplicate' | 'stale') {
  const last = recent[recent.length - 1]
  if (!last) return false
  const payload = kind === 'duplicate' ? last.payload : { ...last.payload, eventId: `evt_${crypto.randomUUID()}`, version: Math.max(0, last.payload.version - 1) }
  conns.forEach((c) => { if (last.userId === null || c.userId === last.userId) c.emit(last.event, payload) })
  return true
}

export function dropConnections(offlineMs = 0) {
  offlineUntil = Date.now() + offlineMs
  conns.forEach((c) => c.close())
}

export function closeUserConnections(userId: string) {
  conns.forEach((c) => { if (c.userId === userId) c.close() })
}
