import { useSyncExternalStore } from 'react'
import type { Session } from '@/api/contracts'
import { readJSON, removeKey, STORAGE, writeJSON } from '@/lib/storage'

type Listener = () => void
type EndReason = 'logout' | 'expired'

let session: Session | null = readJSON<Session>(STORAGE.session)
const listeners = new Set<Listener>()
const endListeners = new Set<(reason: EndReason, previous: Session) => void>()

function emit() { listeners.forEach((l) => l()) }

export const sessionStore = {
  get: () => session,
  token: () => session?.token ?? null,
  set(next: Session) {
    session = next
    writeJSON(STORAGE.session, next)
    emit()
  },
  end(reason: EndReason) {
    const prev = session
    if (!prev) return
    session = null
    removeKey(STORAGE.session)
    endListeners.forEach((l) => l(reason, prev))
    emit()
  },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l) } },
  onEnd(l: (reason: EndReason, previous: Session) => void) { endListeners.add(l); return () => { endListeners.delete(l) } },
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE.session) return
    const next = readJSON<Session>(STORAGE.session)
    if (!next && session) sessionStore.end('logout')
    else if (next && next.token !== session?.token) sessionStore.set(next)
  })
}
