
import type { EditionType, EthString, Network, Nft, Order, Profile, Quote, Wallet, WalletConnection, WalletProvider } from '@/api/contracts'
import { buildCatalog, SEED_USERS } from './fixtures'

export interface DbUser { id: string; username: string; email: string; passwordHash: string }
export interface DbSession { token: string; userId: string; expiresAt: number }
export interface DbCartItem { id: string; nftId: string; edition: EditionType; quantity: number; addedPriceEth: EthString }
export interface DbCart { id: string; ownerId: string | null; items: DbCartItem[]; couponCode: string | null; version: number }
export interface DbOrder extends Order {
  userId: string
  outcome: 'confirmed' | 'declined'
  settleAt: number
  cartId: string
}
export interface DbState {
  schema: number
  nfts: Nft[]
  users: DbUser[]
  sessions: Record<string, DbSession>
  carts: Record<string, DbCart>
  favorites: Record<string, string[]>
  profiles: Record<string, Profile>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>
  connections: Record<string, WalletConnection | null>
  quotes: Record<string, Quote & { userId: string }>
  orders: Record<string, DbOrder>
  idempotency: Record<string, { userId: string; bodyHash: string; orderId: string }>
  flags: Record<string, boolean>
}

const KEY = 'kurio:mock:db'
const SCHEMA = 4

function seed(): DbState {
  const profiles: Record<string, Profile> = {}
  const wallets: DbState['wallets'] = {}
  for (const u of SEED_USERS) {
    profiles[u.id] = {
      userId: u.id,
      displayName: u.id === 'usr_ana' ? 'Ana Colecionadora' : 'Bruno NFT',
      username: u.username,
      email: u.email,
      ensName: u.username.replace('.', '-'),
      walletNickname: 'Principal',
      avatarUrl: null,
      version: 1,
    }
    wallets[u.id] = {
      primary: {
        id: `wal_${u.id}_primary`, slot: 'primary', version: 1,
        displayName: profiles[u.id]!.displayName, nickname: 'Principal', network: 'ethereum' as Network,
        profileName: u.username, address: u.id === 'usr_ana' ? '0xA91F00000000000000000000000000000000E82C' : '0xB0B0000000000000000000000000000000000B0B',
        ensOrSecondary: '', provider: 'metamask' as WalletProvider, referralCode: 'KURIO', email: u.email, ensName: u.username.replace('.', '-'),
      },
      secondary: u.id === 'usr_ana' ? {
        id: `wal_${u.id}_secondary`, slot: 'secondary', version: 1,
        displayName: 'Reserva', nickname: 'Reserva', network: 'polygon' as Network, profileName: u.username,
        address: '0xC0FFEE000000000000000000000000000000C0DE', ensOrSecondary: 'nova.kurio.eth',
        provider: 'coinbase' as WalletProvider, referralCode: 'KURIO', email: u.email, ensName: 'nova',
      } : null,
    }
  }
  return {
    schema: SCHEMA,
    nfts: buildCatalog(),
    users: SEED_USERS.map((u) => ({ ...u })),
    sessions: {},
    carts: {},
    favorites: { usr_ana: ['emerald-ape-042'], usr_bruno: [] },
    profiles,
    wallets,
    connections: {},
    quotes: {},
    orders: {},
    idempotency: {},
    flags: {},
  }
}

let state: DbState | null = null

export function db(): DbState {
  if (state) return state
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as DbState) : null
    state = parsed && parsed.schema === SCHEMA ? parsed : seed()
  } catch {
    state = seed()
  }
  return state
}

export function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(db())) } catch { /* quota */ }
}

export function resetDb() {
  state = seed()
  commit()
}

export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
export const hashPassword = (pw: string) => sha256(`kurio-salt:${pw}`)

export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}
