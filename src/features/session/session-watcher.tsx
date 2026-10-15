import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { apiClient } from '@/api/endpoints'
import { sessionStore } from './session-store'

export const PRIVATE_PREFIXES = ['/checkout', '/perfil', '/pedido']
export const isPrivatePath = (p: string) => PRIVATE_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`))

export function SessionWatcher() {
  const qc = useQueryClient()
  const router = useRouter()

  useEffect(() => sessionStore.onEnd((reason, prev) => {
    void qc.cancelQueries({ queryKey: ['private', prev.user.id] })
    qc.removeQueries({ queryKey: ['private', prev.user.id] })
    qc.removeQueries({ queryKey: ['cart', `user:${prev.user.id}`] })
    qc.removeQueries({ queryKey: ['quote', `user:${prev.user.id}`] })
    const { pathname, href } = router.state.location
    if (reason === 'expired') {
      toast.warning('Sua sessão expirou.', { description: 'Entre novamente para continuar de onde parou.' })
      if (isPrivatePath(pathname)) void router.navigate({ to: '/entrar', search: { redirect: href, expired: true } })
    } else if (isPrivatePath(pathname)) {
      void router.navigate({ to: '/' })
    }
  }), [qc, router])

  useEffect(() => {
    if (sessionStore.get()) apiClient.auth.session().then((s) => sessionStore.set(s)).catch(() => { /* interceptor trata 401 */ })
  }, [])

  return null
}
