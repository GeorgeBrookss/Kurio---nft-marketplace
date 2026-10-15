import { HttpResponse, delay, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { db, type DbUser } from './db'
import { getScenario, hit, latencyFor } from './scenarios'

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422, UNAUTHENTICATED: 401, SESSION_EXPIRED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  EMAIL_TAKEN: 409, USERNAME_TAKEN: 409, INVALID_CREDENTIALS: 401, AVAILABILITY_CONFLICT: 409, QUOTE_STALE: 409,
  IDEMPOTENCY_CONFLICT: 409, COUPON_INVALID: 422, COUPON_EXPIRED: 422, WALLET_REJECTED: 409, TRANSIENT: 503, INTERNAL: 500,
}

export class ApiFailure extends Error {
  constructor(public code: ApiErrorCode, message: string, public fields?: Record<string, string>, public details?: unknown) {
    super(message)
  }
}

export function fail(code: ApiErrorCode, message: string, fields?: Record<string, string>, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, fields, details } }
  return HttpResponse.json(body, { status: STATUS[code] })
}

export function route<P extends PathParams = PathParams, B extends DefaultBodyType = DefaultBodyType>(
  name: string,
  resolver: HttpResponseResolver<P, B>,
): HttpResponseResolver<P, B> {
  return async (info) => {
    const n = hit(name)
    await delay(latencyFor(name))
    const s = getScenario()
    if (s === 'offline') return HttpResponse.error()
    if (s === 'flaky' && name.startsWith('GET') && n === 1) return fail('TRANSIENT', 'Serviço temporariamente indisponível. Tente novamente.')
    try {
      return await resolver(info)
    } catch (e) {
      if (e instanceof ApiFailure) return fail(e.code, e.message, e.fields, e.details)
      console.error('[mock]', e)
      return fail('INTERNAL', 'Erro inesperado no servidor simulado.')
    }
  }
}

export function currentUser(request: Request, { required }: { required: true }): DbUser
export function currentUser(request: Request, opts?: { required?: false }): DbUser | null
export function currentUser(request: Request, opts: { required?: boolean } = {}): DbUser | null {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    if (opts.required) throw new ApiFailure('UNAUTHENTICATED', 'Entre para continuar.')
    return null
  }
  const session = db().sessions[token]
  if (!session) {
    if (opts.required) throw new ApiFailure('UNAUTHENTICATED', 'Sessão inválida.')
    return null
  }
  if (session.expiresAt <= Date.now()) {
    throw new ApiFailure('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  return db().users.find((u) => u.id === session.userId) ?? null
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiFailure('VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
}

export function zodFields(issues: Array<{ path: Array<string | number>; message: string }>) {
  const fields: Record<string, string> = {}
  for (const i of issues) {
    const k = i.path.join('.')
    if (!fields[k]) fields[k] = i.message
  }
  return fields
}
