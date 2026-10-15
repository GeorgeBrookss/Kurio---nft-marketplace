import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './contracts'
import { sessionStore } from '@/features/session/session-store'
import { readJSON, STORAGE, writeJSON } from '@/lib/storage'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED',
    message: string,
    public status?: number,
    public fields?: Record<string, string>,
    public details?: unknown,
  ) {
    super(message)
  }
  get isTransient() { return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.code === 'TRANSIENT' || (this.status ?? 0) >= 500 }
}

export const http = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? '/api',
  timeout: Number(import.meta.env.VITE_HTTP_TIMEOUT ?? 8000),
  headers: { 'content-type': 'application/json' },
})

export function guestCartId(): string | null {
  return readJSON<string>(STORAGE.guestCart)
}
export function setGuestCartId(id: string) { writeJSON(STORAGE.guestCart, id) }

http.interceptors.request.use((config) => {
  const token = sessionStore.token()
  if (token) config.headers.set('authorization', `Bearer ${token}`)
  const cart = guestCartId()
  if (cart) config.headers.set('x-cart-id', cart)
  return config
})

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error as unknown)) return Promise.reject(new ApiError('CANCELED', 'Requisição cancelada'))
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return Promise.reject(new ApiError('TIMEOUT', 'O servidor demorou para responder.'))
    }
    if (!error.response) return Promise.reject(new ApiError('NETWORK', 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'))
    const { status, data } = error.response
    const body = data?.error
    const apiError = new ApiError(body?.code ?? 'INTERNAL', body?.message ?? 'Erro inesperado.', status, body?.fields, body?.details)
    const sentToken = (error.config?.headers as Record<string, unknown> | undefined)?.authorization
    if ((apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED') && sentToken && sessionStore.get()) {
      sessionStore.end('expired')
    }
    return Promise.reject(apiError)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await http.request<T>(config)
  return res.data
}
