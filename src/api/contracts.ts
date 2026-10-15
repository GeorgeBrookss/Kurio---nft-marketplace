import { z } from 'zod'

export type EthString = string

export const CATEGORIES = [
  'arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis',
  'generativa', 'jogos', 'assinaturas', 'utilidade',
] as const
export type Category = (typeof CATEGORIES)[number]
export const CATEGORY_LABEL: Record<Category, string> = {
  'arte-digital': 'Arte digital', fotografia: 'Fotografia', musica: 'Música', 'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis', generativa: 'Generativa', jogos: 'Jogos', assinaturas: 'Assinaturas', utilidade: 'Utilidade',
}

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof NETWORKS)[number]
export const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

export const EDITIONS = ['1/1', '1/10', '1/50', 'open'] as const
export type EditionType = (typeof EDITIONS)[number]
export const EDITION_LABEL: Record<EditionType, string> = { '1/1': '1/1', '1/10': '1/10', '1/50': '1/50', open: 'Aberta' }

export const SORTS = ['recent', 'price_asc', 'price_desc', 'trending'] as const
export type Sort = (typeof SORTS)[number]
export const SORT_LABEL: Record<Sort, string> = {
  recent: 'Listados recentemente', price_asc: 'Menor preço', price_desc: 'Maior preço', trending: 'Em alta',
}
export const TABS = ['all', 'new', 'trending'] as const
export type CatalogTab = (typeof TABS)[number]
export const TAB_LABEL: Record<CatalogTab, string> = { all: 'Todos os NFTs', new: 'Novos lançamentos', trending: 'Em alta' }

export const WALLET_PROVIDERS = ['metamask', 'walletconnect', 'coinbase'] as const
export type WalletProvider = (typeof WALLET_PROVIDERS)[number]
export const WALLET_PROVIDER_LABEL: Record<WalletProvider, string> = {
  metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet',
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'SESSION_EXPIRED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'EMAIL_TAKEN' | 'USERNAME_TAKEN' | 'INVALID_CREDENTIALS' | 'AVAILABILITY_CONFLICT'
  | 'QUOTE_STALE' | 'IDEMPOTENCY_CONFLICT' | 'COUPON_INVALID' | 'COUPON_EXPIRED'
  | 'WALLET_REJECTED' | 'TRANSIENT' | 'INTERNAL'
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string>; details?: unknown }
}

export interface Edition { type: EditionType; available: number; priceEth: EthString }
export interface Nft {
  id: string
  name: string
  tokenId: string
  collection: string
  category: Category
  network: Network
  priceEth: EthString
  compareAtEth?: EthString
  editions: Edition[]
  image: string
  thumb: string
  gallery: string[]
  description: string
  attributes: string[]
  rating: number
  reviewCount: number
  rare: boolean
  createdAt: string
  trendingScore: number
  contract: string
  royaltyPct: number
  version: number
}
export type NftSummary = Pick<Nft, 'id' | 'name' | 'tokenId' | 'priceEth' | 'compareAtEth' | 'image' | 'thumb' | 'rare' | 'network' | 'category' | 'version'> & { soldOut: boolean }

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(z.enum(values)))

export const CatalogSearch = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: csv(CATEGORIES).optional().catch(undefined),
  network: csv(NETWORKS).optional().catch(undefined),
  minPrice: z.coerce.number().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  tab: z.enum(TABS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof CatalogSearch>
export interface Paginated<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
export interface CatalogFacets { categories: Record<Category, number>; networks: Record<Network, number>; priceRange: { min: string; max: string } }
export type CatalogResponse = Paginated<NftSummary> & { facets: CatalogFacets }

export interface User { id: string; username: string; email: string }
export interface Session { token: string; user: User; expiresAt: string }

export const LoginInput = z.object({
  email: z.string().trim().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof LoginInput>
export const PasswordRule = z.string().min(8, 'Mínimo de 8 caracteres').regex(/[A-Za-z]/, 'Inclua uma letra').regex(/\d/, 'Inclua um número')
export const RegisterInput = z.object({
  username: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(24, 'Máximo de 24 caracteres').regex(/^[a-z0-9_.]+$/i, 'Use letras, números, ponto ou _'),
  email: z.string().trim().email('Informe um e-mail válido'),
  password: PasswordRule,
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
export type RegisterInput = z.infer<typeof RegisterInput>

export interface FavoritesResponse { nftIds: string[] }

export interface CartItem {
  id: string
  nftId: string
  edition: EditionType
  quantity: number
  unitPriceEth: EthString
  lineTotalEth: EthString
  available: number
  name: string
  tokenId: string
  thumb: string
  notice?: { kind: 'price_changed' | 'availability_reduced' | 'sold_out'; previousPriceEth?: EthString }
}
export interface Cart { id: string; items: CartItem[]; couponCode: string | null; version: number }
export interface AddCartItemInput { nftId: string; edition: EditionType; quantity: number }

export interface QuoteLine { cartItemId: string; nftId: string; edition: EditionType; quantity: number; unitPriceEth: EthString; lineTotalEth: EthString }
export interface Quote {
  id: string
  hash: string
  cartVersion: number
  items: QuoteLine[]
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
  coupon: { code: string; percentOff: number } | null
  issuedAt: string
  expiresAt: string
}

const ensLabel = z.string().trim().min(3, 'Informe o nome ENS').regex(/^[a-z0-9-]+$/i, 'Use letras, números ou hífen')
export const ProfileInput = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  username: z.string().trim().min(3, 'Mínimo de 3 caracteres').regex(/^[a-z0-9_.]+$/i, 'Use letras, números, ponto ou _'),
  email: z.string().trim().email('Informe um e-mail válido'),
  ensName: ensLabel,
  walletNickname: z.string().trim().min(2, 'Informe o apelido da carteira'),
})
export type ProfileInput = z.infer<typeof ProfileInput>
export interface Profile extends ProfileInput { userId: string; avatarUrl: string | null; version: number }
export const PasswordChangeInput = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: PasswordRule,
  confirmPassword: z.string(),
}).refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
export type PasswordChangeInput = z.infer<typeof PasswordChangeInput>

const walletFields = {
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  network: z.enum(NETWORKS, { errorMap: () => ({ message: 'Selecione uma rede' }) }),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'Use 0x seguido de 40 caracteres hexadecimais'),
  ensOrSecondary: z.string().trim().optional(),
  provider: z.enum(WALLET_PROVIDERS, { errorMap: () => ({ message: 'Selecione uma carteira' }) }),
  referralCode: z.string().trim().min(4, 'Informe o código de indicação'),
  email: z.string().trim().email('Informe um e-mail válido'),
  ensName: ensLabel,
}
export const WalletInput = z.object({ ...walletFields, nickname: z.string().trim().min(2, 'Informe o apelido da carteira') })
export type WalletInput = z.infer<typeof WalletInput>
export type WalletSlot = 'primary' | 'secondary'
export interface Wallet extends WalletInput { id: string; slot: WalletSlot; version: number }
export interface WalletsResponse { primary: Wallet | null; secondary: Wallet | null }
export interface WalletConnection { walletId: string; provider: WalletProvider; network: Network; address: string; connectedAt: string }

export const CollectorInput = z.object({
  ...walletFields,
  username: z.string().trim().min(3, 'Informe o nome de usuário'),
  note: z.string().max(280, 'Máximo de 280 caracteres').optional(),
})
export type CollectorInput = z.infer<typeof CollectorInput>
export interface CreateOrderInput {
  quoteId: string
  quoteHash: string
  walletId: string
  network: Network
  provider: WalletProvider
  collector: CollectorInput
}
export type OrderStatus = 'pending' | 'confirmed' | 'declined'
export interface OrderLine { nftId: string; name: string; tokenId: string; thumb: string; edition: EditionType; quantity: number; unitPriceEth: EthString; lineTotalEth: EthString }
export interface Order {
  id: string
  status: OrderStatus
  version: number
  txHash: string
  explorerUrl: string
  createdAt: string
  settledAt: string | null
  declineReason: string | null
  network: Network
  provider: WalletProvider
  walletAddress: string
  items: OrderLine[]
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
}

export interface RealtimeEnvelope<T> { eventId: string; resource: { type: 'nft' | 'order'; id: string }; version: number; emittedAt: string; data: T }
export type NftUpdatedEvent = RealtimeEnvelope<{ priceEth: EthString; editions: Edition[] }>
export type OrderUpdatedEvent = RealtimeEnvelope<Pick<Order, 'id' | 'status' | 'declineReason' | 'settledAt' | 'txHash'>>
export interface ServerToClientEvents {
  'nft.updated': (e: NftUpdatedEvent) => void
  'order.updated': (e: OrderUpdatedEvent) => void
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientToServerEvents {}
