import { CATEGORIES, NETWORKS, type Category, type Edition, type Network, type Nft } from '@/api/contracts'

const IMG_EXT = 'png'

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ART = [
  { key: 'emerald', attrs: ['Óculos', 'Esmeralda', 'Jaqueta'] },
  { key: 'sage', attrs: ['Chapéu', 'Moletom', 'Lilás'] },
  { key: 'ivory', attrs: ['Gola alta', 'Blazer', 'Marfim'] },
  { key: 'golden', attrs: ['Fones', 'Dourado', 'Bomber'] },
] as const

const NAMES = [
  'Emerald Ape', 'Sage Nomad', 'Ivory Baron', 'Golden Beat', 'Neon Vessel', 'Cosmic Bloom', 'Violet Nomad',
  'Golden Frequency', 'Golden Signal', 'Amber Drift', 'Velvet Monk', 'Copper Echo', 'Jade Pilot', 'Onyx Scholar',
  'Saffron Wave', 'Moss Herald',
]

const FIGMA_GRID: Array<[string, number, string, keyof typeof ART_INDEX, string?]> = [
  ['Emerald Ape', 42, '1.19', 'emerald'],
  ['Sage Nomad', 9, '1.69', 'ivory'],
  ['Neon Vessel', 552, '1.99', 'emerald', '2.29'],
  ['Cosmic Bloom', 118, '1.29', 'sage'],
  ['Violet Nomad', 314, '1.39', 'golden'],
  ['Ivory Baron', 88, '1.79', 'ivory'],
  ['Golden Beat', 207, '0.99', 'emerald'],
  ['Golden Frequency', 71, '0.59', 'sage'],
  ['Golden Signal', 160, '0.39', 'golden'],
]
const ART_INDEX = { emerald: 0, sage: 1, ivory: 2, golden: 3 } as const

const pad = (n: number) => String(n).padStart(3, '0')
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function editionsFor(price: string, rnd: () => number): Edition[] {
  const base = Number(price)
  const mk = (type: Edition['type'], factor: number, max: number): Edition => ({
    type,
    priceEth: (Math.round(base * factor * 100) / 100).toFixed(2),
    available: Math.floor(rnd() * max) + (type === '1/1' ? 0 : 1),
  })
  return [mk('1/1', 4, 2), mk('1/10', 2, 10), { type: '1/50', priceEth: price, available: 10 + Math.floor(rnd() * 40) }, mk('open', 0.5, 200)]
}

export function buildCatalog(seed = 2026): Nft[] {
  const rnd = mulberry32(seed)
  const out: Nft[] = []
  const baseDate = Date.UTC(2026, 6, 1)
  const total = 72
  for (let i = 0; i < total; i++) {
    const grid = FIGMA_GRID[i]
    const name = grid ? grid[0] : NAMES[i % NAMES.length]!
    const num = grid ? grid[1] : Math.floor(rnd() * 900) + 10
    const price = grid ? grid[2] : (Math.round((0.05 + rnd() * 6) * 100) / 100).toFixed(2)
    const art = grid ? ART[ART_INDEX[grid[3]]]! : ART[Math.floor(rnd() * ART.length)]!
    const category: Category = i < 9 ? 'arte-digital' : CATEGORIES[Math.floor(rnd() * CATEGORIES.length)]!
    const network: Network = i < 9 ? 'ethereum' : NETWORKS[Math.floor(rnd() * NETWORKS.length)]!
    const id = `${slug(name)}-${pad(num)}`
    if (out.some((n) => n.id === id)) continue
    const editions = editionsFor(price, rnd)
    if (id === 'golden-signal-160') editions.forEach((e) => { if (e.type === '1/1' || e.type === '1/10') e.available = 0 })
    out.push({
      id,
      name: `${name} #${pad(num)}`,
      tokenId: `#${String(num).padStart(4, '0')}`,
      collection: 'Kurio Apes',
      category,
      network,
      priceEth: price,
      compareAtEth: grid?.[4],
      editions,
      image: `/nfts/${art.key}.${IMG_EXT}`,
      thumb: `/nfts/${art.key}-thumb.${IMG_EXT}`,
      gallery: Array.from({ length: 4 }, () => `/nfts/${art.key}.${IMG_EXT}`),
      description: `${name} #${pad(num)} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na ${network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Solana'}.`,
      attributes: [...art.attrs, ...(i % 3 === 2 ? ['Raro'] : [])],
      rating: Math.round((4 + rnd()) * 10) / 10,
      reviewCount: 5 + Math.floor(rnd() * 40),
      rare: i === 2 || (i > 9 && rnd() > 0.85),
      createdAt: new Date(baseDate - i * 36e5 * 7).toISOString(),
      trendingScore: Math.floor(rnd() * 1000),
      contract: `0x7A42${Math.floor(rnd() * 1e8).toString(16).padStart(8, '0')}19E8`,
      royaltyPct: 5,
      version: 1,
    })
  }
  return out
}

export const SEED_PASSWORD_HASH = '8843acc9aef04a4125c9dc489e0c94eb3349f917c474d30de9a9637cc24891cb'

export const SEED_USERS = [
  { id: 'usr_ana', username: 'ana.coleciona', email: 'ana@kurio.dev', passwordHash: SEED_PASSWORD_HASH },
  { id: 'usr_bruno', username: 'bruno.nft', email: 'bruno@kurio.dev', passwordHash: SEED_PASSWORD_HASH },
]

export const COUPONS: Record<string, { percentOff: number; expiresAt: string }> = {
  KURIO10: { percentOff: 10, expiresAt: '2099-12-31T23:59:59Z' },
  LANCAMENTO20: { percentOff: 20, expiresAt: '2026-01-01T00:00:00Z' },
}
