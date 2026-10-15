import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddCartItemInput, Cart, CatalogSearch, FavoritesResponse, ProfileInput, WalletInput, WalletSlot } from './contracts'
import { apiClient } from './endpoints'
import { ApiError, guestCartId, setGuestCartId } from './http'
import { useSession } from '@/features/session/session-store'

export const qk = {
  nftList: (s: CatalogSearch) => ['nfts', 'list', normalizeSearch(s)] as const,
  nftLists: () => ['nfts', 'list'] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  cart: (owner: string) => ['cart', owner] as const,
  quote: (owner: string, version?: number) => (version === undefined ? (['quote', owner] as const) : (['quote', owner, version] as const)),
  private: (uid: string) => ['private', uid] as const,
  favorites: (uid: string) => ['private', uid, 'favorites'] as const,
  profile: (uid: string) => ['private', uid, 'profile'] as const,
  wallets: (uid: string) => ['private', uid, 'wallets'] as const,
  connection: (uid: string) => ['private', uid, 'wallet-connection'] as const,
  order: (uid: string, id: string) => ['private', uid, 'order', id] as const,
}

function normalizeSearch(s: CatalogSearch) {
  return {
    q: s.q || undefined,
    category: s.category?.length ? [...s.category].sort() : undefined,
    network: s.network?.length ? [...s.network].sort() : undefined,
    minPrice: s.minPrice, maxPrice: s.maxPrice, sort: s.sort ?? 'recent', tab: s.tab ?? 'all', page: s.page ?? 1,
  }
}

export function useCartOwner() {
  const session = useSession()
  return session ? `user:${session.user.id}` : `guest:${guestCartId() ?? 'new'}`
}

export function useCatalog(search: CatalogSearch) {
  return useQuery({
    queryKey: qk.nftList(search),
    queryFn: ({ signal }) => apiClient.nfts.list(search, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useNft(id: string) {
  return useQuery({
    queryKey: qk.nft(id),
    queryFn: ({ signal }) => apiClient.nfts.get(id, { signal }),
    retry: (count, e) => !(e instanceof ApiError && e.code === 'NOT_FOUND') && e instanceof ApiError && e.isTransient && count < 2,
  })
}

export function useFavorites() {
  const session = useSession()
  return useQuery({
    queryKey: qk.favorites(session?.user.id ?? 'anon'),
    queryFn: ({ signal }) => apiClient.favorites.list({ signal }),
    enabled: !!session,
    staleTime: 15_000,
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  const session = useSession()
  const key = qk.favorites(session?.user.id ?? 'anon')
  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) =>
      favorite ? apiClient.favorites.add(nftId) : apiClient.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      const ids = new Set(previous?.nftIds ?? [])
      if (favorite) ids.add(nftId)
      else ids.delete(nftId)
      qc.setQueryData<FavoritesResponse>(key, { nftIds: [...ids] })
      return { previous }
    },
    onError: (err, vars, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      toast.error(vars.favorite ? 'Não foi possível favoritar.' : 'Não foi possível remover dos favoritos.', { description: (err as Error).message })
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(key, data)
      toast.success(vars.favorite ? 'Adicionado à lista de interesse.' : 'Removido da lista de interesse.')
    },
  })
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: async ({ signal }) => {
      const cart = await apiClient.cart.get({ signal })
      if (owner.startsWith('guest:') && guestCartId() !== cart.id) setGuestCartId(cart.id)
      return cart
    },
    staleTime: 10_000,
  })
}

function useCartWriter() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return (cart: Cart) => {
    qc.setQueryData(qk.cart(owner), cart)
    void qc.invalidateQueries({ queryKey: qk.quote(owner) })
  }
}

export function useAddToCart() {
  const write = useCartWriter()
  return useMutation({
    mutationFn: (input: AddCartItemInput) => apiClient.cart.add(input),
    onSuccess: (cart) => { write(cart); toast.success('Adicionado ao carrinho.') },
    onError: (e) => toast.error('Não foi possível adicionar ao carrinho.', { description: (e as Error).message }),
  })
}
export function useUpdateCartItem() {
  const write = useCartWriter()
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => apiClient.cart.update(itemId, quantity),
    onSuccess: write,
    onError: (e) => toast.error('Não foi possível alterar a quantidade.', { description: (e as Error).message }),
  })
}
export function useRemoveCartItem() {
  const write = useCartWriter()
  return useMutation({
    mutationFn: (itemId: string) => apiClient.cart.remove(itemId),
    onSuccess: (cart) => { write(cart); toast.success('Item removido do carrinho.') },
    onError: (e) => toast.error('Não foi possível remover o item.', { description: (e as Error).message }),
  })
}
export function useCoupon() {
  const write = useCartWriter()
  const apply = useMutation({ mutationFn: (code: string) => apiClient.cart.applyCoupon(code), onSuccess: (c) => { write(c); toast.success('Código promocional aplicado.') } })
  const remove = useMutation({ mutationFn: () => apiClient.cart.removeCoupon(), onSuccess: (c) => { write(c); toast.success('Código promocional removido.') } })
  return { apply, remove }
}

export function useQuote(cart: Cart | undefined) {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.quote(owner, cart?.version ?? 0),
    queryFn: ({ signal }) => apiClient.cart.quote({ signal }),
    enabled: !!cart && cart.items.length > 0,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}

export function useProfile() {
  const session = useSession()
  return useQuery({ queryKey: qk.profile(session?.user.id ?? 'anon'), queryFn: ({ signal }) => apiClient.profile.get({ signal }), enabled: !!session, staleTime: 15_000 })
}
export function useUpdateProfile() {
  const qc = useQueryClient()
  const session = useSession()
  return useMutation({
    mutationFn: (input: ProfileInput & { avatarUrl?: string | null }) => apiClient.profile.update(input),
    onSuccess: (p) => qc.setQueryData(qk.profile(session!.user.id), p),
  })
}
export function useWallets() {
  const session = useSession()
  return useQuery({ queryKey: qk.wallets(session?.user.id ?? 'anon'), queryFn: ({ signal }) => apiClient.wallets.list({ signal }), enabled: !!session, staleTime: 15_000 })
}
export function useSaveWallet() {
  const qc = useQueryClient()
  const session = useSession()
  return useMutation({
    mutationFn: ({ slot, input }: { slot: WalletSlot; input: WalletInput }) => apiClient.wallets.save(slot, input),
    onSuccess: (w) => qc.setQueryData(qk.wallets(session!.user.id), w),
  })
}
export function useWalletConnection() {
  const session = useSession()
  return useQuery({ queryKey: qk.connection(session?.user.id ?? 'anon'), queryFn: ({ signal }) => apiClient.wallets.connection({ signal }), enabled: !!session })
}

export function useOrder(id: string) {
  const session = useSession()
  return useQuery({
    queryKey: qk.order(session?.user.id ?? 'anon', id),
    queryFn: ({ signal }) => apiClient.orders.get(id, { signal }),
    enabled: !!session,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 5000 : false),
    staleTime: 0,
  })
}
