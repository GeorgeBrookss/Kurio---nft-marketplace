import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LoginInput, RegisterInput, Session } from '@/api/contracts'
import { apiClient } from '@/api/endpoints'
import { guestCartId } from '@/api/http'
import { removeKey, STORAGE } from '@/lib/storage'
import { sessionStore } from './session-store'

async function establish(qc: ReturnType<typeof useQueryClient>, session: Session) {
  const previous = sessionStore.get()
  if (previous && previous.user.id !== session.user.id) sessionStore.end('logout')
  sessionStore.set(session)
  const guest = guestCartId()
  try {
    const merged = await apiClient.cart.merge(guest)
    qc.setQueryData(['cart', `user:${session.user.id}`], merged)
  } finally {
    removeKey(STORAGE.guestCart)
    qc.removeQueries({ queryKey: ['cart'], predicate: (q) => String(q.queryKey[1]).startsWith('guest:') })
    void qc.invalidateQueries({ queryKey: ['quote'] })
  }
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: LoginInput) => apiClient.auth.login(input), onSuccess: (s) => establish(qc, s) })
}
export function useRegister() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: RegisterInput) => apiClient.auth.register(input), onSuccess: (s) => establish(qc, s) })
}
export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try { await apiClient.auth.logout() } finally { sessionStore.end('logout') }
    },
  })
}
