export const STORAGE = {
  session: 'kurio:session',
  guestCart: 'kurio:guest-cart-id',
  pendingCheckout: 'kurio:pending-checkout',
} as const

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
export function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage cheio ou bloqueado: a sessão segue apenas em memória */
  }
}
export function removeKey(key: string) {
  try { localStorage.removeItem(key) } catch { /* noop */ }
}
