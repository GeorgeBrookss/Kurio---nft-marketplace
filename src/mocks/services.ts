import type { Cart, CartItem, Nft, NftSummary, Quote } from '@/api/contracts'
import { add, cmp, mul, pct, sub } from '@/lib/money'
import { COUPONS } from './fixtures'
import { commit, db, sha256, stableStringify, uid, type DbCart, type DbOrder } from './db'
import { ApiFailure } from './http'
import { emitNftUpdated, emitOrderUpdated } from './realtime'
import { getScenario } from './scenarios'

export const NETWORK_FEE = '0.016'

export const findNft = (id: string) => db().nfts.find((n) => n.id === id)

export function toSummary(n: Nft): NftSummary {
  const ed = n.editions.find((e) => e.type === '1/50')
  return {
    id: n.id, name: n.name, tokenId: n.tokenId, priceEth: n.priceEth, compareAtEth: n.compareAtEth, image: n.image,
    thumb: n.thumb, rare: n.rare, network: n.network, category: n.category, version: n.version,
    soldOut: n.editions.every((e) => e.available === 0) || (ed?.available ?? 0) === 0,
  }
}

export function resolveCart(userId: string | null, guestCartId: string | null): DbCart {
  const d = db()
  if (userId) {
    let cart = Object.values(d.carts).find((c) => c.ownerId === userId)
    if (!cart) {
      cart = { id: uid('cart'), ownerId: userId, items: [], couponCode: null, version: 1 }
      d.carts[cart.id] = cart
      commit()
    }
    return cart
  }
  if (guestCartId && d.carts[guestCartId] && d.carts[guestCartId]!.ownerId === null) return d.carts[guestCartId]!
  const id = guestCartId && /^cart_[a-z0-9]+$/.test(guestCartId) ? guestCartId : uid('cart')
  const cart: DbCart = { id, ownerId: null, items: [], couponCode: null, version: 1 }
  d.carts[id] = cart
  commit()
  return cart
}

export function cartView(cart: DbCart): Cart {
  const items: CartItem[] = []
  for (const it of cart.items) {
    const nft = findNft(it.nftId)
    const ed = nft?.editions.find((e) => e.type === it.edition)
    if (!nft || !ed) continue
    let notice: CartItem['notice']
    if (ed.available === 0) notice = { kind: 'sold_out' }
    else if (it.quantity > ed.available) notice = { kind: 'availability_reduced' }
    else if (cmp(ed.priceEth, it.addedPriceEth) !== 0) notice = { kind: 'price_changed', previousPriceEth: it.addedPriceEth }
    items.push({
      id: it.id, nftId: it.nftId, edition: it.edition, quantity: it.quantity, unitPriceEth: ed.priceEth,
      lineTotalEth: mul(ed.priceEth, it.quantity), available: ed.available, name: nft.name, tokenId: nft.tokenId,
      thumb: nft.thumb, notice,
    })
  }
  return { id: cart.id, items, couponCode: cart.couponCode, version: cart.version }
}

export function bumpCart(cart: DbCart) {
  cart.version += 1
  commit()
}

export function validateCoupon(code: string) {
  const c = COUPONS[code.trim().toUpperCase()]
  if (!c) throw new ApiFailure('COUPON_INVALID', 'Código promocional inválido.', { code: 'Código promocional inválido' })
  if (new Date(c.expiresAt).getTime() < Date.now()) throw new ApiFailure('COUPON_EXPIRED', 'Este código promocional expirou.', { code: 'Código expirado' })
  return c
}

export async function buildQuote(cart: DbCart, userId: string | null): Promise<Quote> {
  const view = cartView(cart)
  const lines = view.items.map((i) => ({
    cartItemId: i.id, nftId: i.nftId, edition: i.edition, quantity: i.quantity, unitPriceEth: i.unitPriceEth, lineTotalEth: i.lineTotalEth,
  }))
  const subtotal = lines.length ? add(...lines.map((l) => l.lineTotalEth)) : '0'
  let coupon: Quote['coupon'] = null
  if (cart.couponCode) {
    try {
      coupon = { code: cart.couponCode, percentOff: validateCoupon(cart.couponCode).percentOff }
    } catch {
      cart.couponCode = null
    }
  }
  const discount = coupon ? pct(subtotal, coupon.percentOff) : '0'
  const fee = lines.length ? NETWORK_FEE : '0'
  const total = add(sub(subtotal, discount), fee)
  const core = { lines, subtotal, discount, fee, total, coupon, cartVersion: cart.version }
  const hash = (await sha256(stableStringify(core))).slice(0, 16)
  const now = Date.now()
  const quote: Quote = {
    id: uid('qt'), hash, cartVersion: cart.version, items: lines, subtotalEth: subtotal, discountEth: discount,
    networkFeeEth: fee, totalEth: total, coupon, issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + 5 * 60_000).toISOString(),
  }
  db().quotes[quote.id] = { ...quote, userId: userId ?? 'guest' }
  commit()
  return quote
}

export function mutateNft(id: string, change: (n: Nft) => void) {
  const nft = findNft(id)
  if (!nft) throw new ApiFailure('NOT_FOUND', 'NFT não encontrado.')
  change(nft)
  const std = nft.editions.find((e) => e.type === '1/50')
  if (std) nft.priceEth = std.priceEth
  nft.version += 1
  commit()
  emitNftUpdated(nft)
  return nft
}

export function settleDueOrders() {
  const d = db()
  const now = Date.now()
  for (const order of Object.values(d.orders)) {
    if (order.status !== 'pending' || order.settleAt > now) continue
    settle(order)
  }
}

function settle(order: DbOrder) {
  const d = db()
  let outcome = order.outcome
  let reason: string | null = outcome === 'declined' ? 'Pagamento recusado pela carteira (simulação).' : null
  if (outcome === 'confirmed') {
    for (const line of order.items) {
      const ed = findNft(line.nftId)?.editions.find((e) => e.type === line.edition)
      if (!ed || ed.available < line.quantity) { outcome = 'declined'; reason = `Edição esgotada: ${line.name}`; break }
    }
  }
  order.status = outcome
  order.declineReason = reason
  order.settledAt = new Date().toISOString()
  order.version += 1
  if (outcome === 'confirmed') {
    const cart = d.carts[order.cartId]
    for (const line of order.items) {
      mutateNft(line.nftId, (n) => {
        const ed = n.editions.find((e) => e.type === line.edition)
        if (ed) ed.available -= line.quantity
      })
      if (cart) {
        const ci = cart.items.find((i) => i.nftId === line.nftId && i.edition === line.edition)
        if (ci) ci.quantity -= line.quantity
      }
    }
    if (cart) {
      cart.items = cart.items.filter((i) => i.quantity > 0)
      cart.couponCode = cart.items.length ? cart.couponCode : null
      cart.version += 1
    }
  }
  commit()
  emitOrderUpdated(order)
}

export function shouldFailFirst(flag: string) {
  const d = db()
  if (d.flags[flag]) return false
  d.flags[flag] = true
  commit()
  return true
}

export const scenarioIs = (name: Parameters<typeof getScenario> extends [] ? ReturnType<typeof getScenario> : never) => getScenario() === name

if (typeof window !== 'undefined') setInterval(settleDueOrders, 500)
