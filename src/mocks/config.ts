export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.kurio.mock'
export const api = (path: string) => `${API_URL.replace(/\/$/, '')}${path}`
