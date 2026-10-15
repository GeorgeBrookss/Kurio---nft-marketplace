import type {
  AddCartItemInput, Cart, CatalogResponse, CatalogSearch, CreateOrderInput, FavoritesResponse, LoginInput, Network, Nft,
  Order, PasswordChangeInput, Profile, ProfileInput, Quote, RegisterInput, Session, WalletConnection, WalletInput,
  WalletProvider, WalletSlot, WalletsResponse,
} from './contracts'
import { request } from './http'

type Opt = { signal?: AbortSignal }

export function catalogParams(s: CatalogSearch) {
  return {
    q: s.q || undefined,
    category: s.category?.length ? s.category.join(',') : undefined,
    network: s.network?.length ? s.network.join(',') : undefined,
    minPrice: s.minPrice,
    maxPrice: s.maxPrice,
    sort: s.sort,
    tab: s.tab,
    page: s.page,
  }
}

export const apiClient = {
  auth: {
    register: (input: RegisterInput) => request<Session>({ method: 'POST', url: '/auth/register', data: input }),
    login: (input: LoginInput) => request<Session>({ method: 'POST', url: '/auth/login', data: input }),
    session: (o?: Opt) => request<Session>({ url: '/auth/session', signal: o?.signal }),
    logout: () => request<void>({ method: 'POST', url: '/auth/logout' }),
  },
  nfts: {
    list: (s: CatalogSearch, o?: Opt) => request<CatalogResponse>({ url: '/nfts', params: catalogParams(s), signal: o?.signal }),
    get: (id: string, o?: Opt) => request<Nft>({ url: `/nfts/${encodeURIComponent(id)}`, signal: o?.signal }),
  },
  favorites: {
    list: (o?: Opt) => request<FavoritesResponse>({ url: '/favorites', signal: o?.signal }),
    add: (id: string) => request<FavoritesResponse>({ method: 'PUT', url: `/favorites/${id}` }),
    remove: (id: string) => request<FavoritesResponse>({ method: 'DELETE', url: `/favorites/${id}` }),
  },
  cart: {
    get: (o?: Opt) => request<Cart>({ url: '/cart', signal: o?.signal }),
    add: (input: AddCartItemInput) => request<Cart>({ method: 'POST', url: '/cart/items', data: input }),
    update: (itemId: string, quantity: number) => request<Cart>({ method: 'PATCH', url: `/cart/items/${itemId}`, data: { quantity } }),
    remove: (itemId: string) => request<Cart>({ method: 'DELETE', url: `/cart/items/${itemId}` }),
    merge: (guestCartId: string | null) => request<Cart>({ method: 'POST', url: '/cart/merge', data: { guestCartId } }),
    applyCoupon: (code: string) => request<Cart>({ method: 'POST', url: '/cart/coupon', data: { code } }),
    removeCoupon: () => request<Cart>({ method: 'DELETE', url: '/cart/coupon' }),
    quote: (o?: Opt) => request<Quote>({ method: 'POST', url: '/quotes', signal: o?.signal }),
  },
  orders: {
    create: (input: CreateOrderInput, idempotencyKey: string) =>
      request<Order>({ method: 'POST', url: '/orders', data: input, headers: { 'Idempotency-Key': idempotencyKey } }),
    get: (id: string, o?: Opt) => request<Order>({ url: `/orders/${id}`, signal: o?.signal }),
  },
  profile: {
    get: (o?: Opt) => request<Profile>({ url: '/me/profile', signal: o?.signal }),
    update: (input: ProfileInput & { avatarUrl?: string | null }) => request<Profile>({ method: 'PATCH', url: '/me/profile', data: input }),
    changePassword: (input: PasswordChangeInput) => request<void>({ method: 'POST', url: '/me/password', data: input }),
  },
  wallets: {
    list: (o?: Opt) => request<WalletsResponse>({ url: '/me/wallets', signal: o?.signal }),
    save: (slot: WalletSlot, input: WalletInput) => request<WalletsResponse>({ method: 'PUT', url: `/me/wallets/${slot}`, data: input }),
    connection: (o?: Opt) => request<{ connection: WalletConnection | null }>({ url: '/me/wallet-connection', signal: o?.signal }),
    connect: (input: { walletId: string; provider: WalletProvider; network: Network }) =>
      request<WalletConnection>({ method: 'POST', url: '/me/wallet-connection', data: input }),
    disconnect: () => request<void>({ method: 'DELETE', url: '/me/wallet-connection' }),
  },
}
