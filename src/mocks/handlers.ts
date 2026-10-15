import { http, HttpResponse, delay } from 'msw'
import {
  AddCartItemInput, CatalogSearch, CollectorInput, CreateOrderInput, LoginInput, Network, Order, PasswordChangeInput,
  ProfileInput, RegisterInput, WalletInput, WalletProvider, WalletSlot, CATEGORIES, NETWORKS,
  type CatalogResponse, type Category, type Session, type WalletsResponse,
} from '@/api/contracts'
import { cmp, pct } from '@/lib/money'
import { api } from './config'
import { commit, db, hashPassword, resetDb, stableStringify, uid, type DbOrder } from './db'
import { ApiFailure, currentUser, fail, readJson, route, zodFields } from './http'
import { closeUserConnections, dropConnections, realtimeHandler, replay } from './realtime'
import { getScenario, setScenario, SCENARIOS, type ScenarioName } from './scenarios'
import {
  buildQuote, bumpCart, cartView, findNft, mutateNft, resolveCart, settleDueOrders, shouldFailFirst, toSummary, validateCoupon,
} from './services'

const PAGE_SIZE = 9
const guestId = (r: Request) => r.headers.get('x-cart-id')

function sessionFor(userId: string): Session {
  const d = db()
  const ttl = getScenario() === 'session-expired' ? 45_000 : 30 * 60_000
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + ttl
  d.sessions[token] = { token, userId, expiresAt }
  commit()
  const u = d.users.find((x) => x.id === userId)!
  return { token, user: { id: u.id, username: u.username, email: u.email }, expiresAt: new Date(expiresAt).toISOString() }
}

const auth = [
  http.post(api('/auth/register'), route('POST /auth/register', async ({ request }) => {
    const parsed = RegisterInput.safeParse(await readJson(request))
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Revise os campos.', zodFields(parsed.error.issues))
    const d = db()
    const { username, email, password } = parsed.data
    if (d.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return fail('EMAIL_TAKEN', 'Este e-mail já está cadastrado.', { email: 'E-mail já cadastrado' })
    if (d.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return fail('USERNAME_TAKEN', 'Nome de usuário indisponível.', { username: 'Nome de usuário em uso' })
    const user = { id: uid('usr'), username, email, passwordHash: await hashPassword(password) }
    d.users.push(user)
    d.profiles[user.id] = { userId: user.id, displayName: username, username, email, ensName: username.replace(/[^a-z0-9-]/gi, '-'), walletNickname: 'Principal', avatarUrl: null, version: 1 }
    d.wallets[user.id] = { primary: null, secondary: null }
    d.favorites[user.id] = []
    commit()
    return HttpResponse.json(sessionFor(user.id), { status: 201 })
  })),
  http.post(api('/auth/login'), route('POST /auth/login', async ({ request }) => {
    const parsed = LoginInput.safeParse(await readJson(request))
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Revise os campos.', zodFields(parsed.error.issues))
    const user = db().users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase())
    if (!user || user.passwordHash !== (await hashPassword(parsed.data.password))) return fail('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    return HttpResponse.json(sessionFor(user.id))
  })),
  http.get(api('/auth/session'), route('GET /auth/session', ({ request }) => {
    const user = currentUser(request, { required: true })
    const token = request.headers.get('authorization')!.slice(7)
    const s = db().sessions[token]!
    return HttpResponse.json<Session>({ token, user: { id: user.id, username: user.username, email: user.email }, expiresAt: new Date(s.expiresAt).toISOString() })
  })),
  http.post(api('/auth/logout'), route('POST /auth/logout', ({ request }) => {
    const token = request.headers.get('authorization')?.slice(7)
    if (token && db().sessions[token]) {
      const userId = db().sessions[token]!.userId
      delete db().sessions[token]
      commit()
      closeUserConnections(userId)
    }
    return new HttpResponse(null, { status: 204 })
  })),
]

const catalog = [
  http.get(api('/nfts'), route('GET /nfts', ({ request }) => {
    const s = getScenario()
    if (s === 'server-error') return fail('INTERNAL', 'Não foi possível carregar o catálogo.')
    currentUser(request)
    const sp = new URL(request.url).searchParams
    const q = CatalogSearch.parse(Object.fromEntries(sp.entries()))
    let list = s === 'empty' ? [] : [...db().nfts]
    const counts = (key: 'category' | 'network', values: readonly string[]) =>
      Object.fromEntries(values.map((v) => [v, list.filter((n) => n[key] === v).length]))
    if (q.q) {
      const term = q.q.toLowerCase()
      list = list.filter((n) => n.name.toLowerCase().includes(term) || n.collection.toLowerCase().includes(term) || n.attributes.some((a) => a.toLowerCase().includes(term)))
    }
    const facets = { categories: counts('category', CATEGORIES) as Record<Category, number>, networks: counts('network', NETWORKS) as Record<Network, number> }
    if (q.category?.length) list = list.filter((n) => q.category!.includes(n.category))
    if (q.network?.length) list = list.filter((n) => q.network!.includes(n.network))
    if (q.minPrice !== undefined) list = list.filter((n) => cmp(n.priceEth, String(q.minPrice)) >= 0)
    if (q.maxPrice !== undefined) list = list.filter((n) => cmp(n.priceEth, String(q.maxPrice)) <= 0)
    if (q.tab === 'new') list = list.filter((n) => Date.parse(n.createdAt) > Date.UTC(2026, 5, 20))
    if (q.tab === 'trending') list = list.filter((n) => n.trendingScore > 600)
    const sort = q.sort ?? (q.tab === 'trending' ? 'trending' : 'recent')
    list.sort((a, b) => {
      if (sort === 'price_asc') return cmp(a.priceEth, b.priceEth) || a.id.localeCompare(b.id)
      if (sort === 'price_desc') return cmp(b.priceEth, a.priceEth) || a.id.localeCompare(b.id)
      if (sort === 'trending') return b.trendingScore - a.trendingScore || a.id.localeCompare(b.id)
      return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
    })
    const total = list.length
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const page = Math.min(q.page ?? 1, totalPages)
    const body: CatalogResponse = {
      items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toSummary),
      page, pageSize: PAGE_SIZE, total, totalPages,
      facets: { ...facets, priceRange: { min: '0.02', max: '12.30' } },
    }
    return HttpResponse.json(body)
  })),
  http.get(api('/nfts/:id'), route<{ id: string }>('GET /nfts/:id', ({ params }) => {
    if (getScenario() === 'server-error') return fail('INTERNAL', 'Não foi possível carregar o NFT.')
    const nft = findNft(params.id)
    if (!nft) return fail('NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json(nft)
  })),
]

const favorites = [
  http.get(api('/favorites'), route('GET /favorites', ({ request }) => {
    const user = currentUser(request, { required: true })
    return HttpResponse.json({ nftIds: db().favorites[user.id] ?? [] })
  })),
  http.put(api('/favorites/:id'), route<{ id: string }>('PUT /favorites/:id', ({ request, params }) => {
    const user = currentUser(request, { required: true })
    if (getScenario() === 'favorites-fail') return fail('INTERNAL', 'Não foi possível salvar o favorito.')
    if (!findNft(params.id)) return fail('NOT_FOUND', 'NFT não encontrado.')
    const set = new Set(db().favorites[user.id] ?? [])
    set.add(params.id)
    db().favorites[user.id] = [...set]
    commit()
    return HttpResponse.json({ nftIds: db().favorites[user.id] })
  })),
  http.delete(api('/favorites/:id'), route<{ id: string }>('DELETE /favorites/:id', ({ request, params }) => {
    const user = currentUser(request, { required: true })
    if (getScenario() === 'favorites-fail') return fail('INTERNAL', 'Não foi possível remover o favorito.')
    db().favorites[user.id] = (db().favorites[user.id] ?? []).filter((id) => id !== params.id)
    commit()
    return HttpResponse.json({ nftIds: db().favorites[user.id] })
  })),
]

function assertAvailability(nftId: string, edition: string, quantity: number) {
  const nft = findNft(nftId)
  if (!nft) throw new ApiFailure('NOT_FOUND', 'NFT não encontrado.')
  const ed = nft.editions.find((e) => e.type === edition)
  if (!ed || ed.available === 0) throw new ApiFailure('AVAILABILITY_CONFLICT', 'Edição indisponível.', undefined, { available: 0 })
  if (quantity > ed.available) throw new ApiFailure('AVAILABILITY_CONFLICT', `Apenas ${ed.available} disponível(is) nesta edição.`, undefined, { available: ed.available })
  return { nft, ed }
}

const cart = [
  http.get(api('/cart'), route('GET /cart', ({ request }) => {
    const user = currentUser(request)
    return HttpResponse.json(cartView(resolveCart(user?.id ?? null, guestId(request))))
  })),
  http.post(api('/cart/items'), route('POST /cart/items', async ({ request }) => {
    const user = currentUser(request)
    const body = await readJson<AddCartItemInput>(request)
    if (!Number.isInteger(body.quantity) || body.quantity < 1) return fail('VALIDATION_ERROR', 'Quantidade inválida.', { quantity: 'Quantidade inválida' })
    const c = resolveCart(user?.id ?? null, guestId(request))
    const existing = c.items.find((i) => i.nftId === body.nftId && i.edition === body.edition)
    const { ed } = assertAvailability(body.nftId, body.edition, (existing?.quantity ?? 0) + body.quantity)
    if (existing) { existing.quantity += body.quantity; existing.addedPriceEth = ed.priceEth } else c.items.push({ id: uid('ci'), nftId: body.nftId, edition: body.edition, quantity: body.quantity, addedPriceEth: ed.priceEth })
    bumpCart(c)
    return HttpResponse.json(cartView(c), { status: 201 })
  })),
  http.patch(api('/cart/items/:itemId'), route<{ itemId: string }>('PATCH /cart/items/:itemId', async ({ request, params }) => {
    const user = currentUser(request)
    const { quantity } = await readJson<{ quantity: number }>(request)
    if (!Number.isInteger(quantity) || quantity < 1) return fail('VALIDATION_ERROR', 'Quantidade inválida.', { quantity: 'Quantidade inválida' })
    const c = resolveCart(user?.id ?? null, guestId(request))
    const item = c.items.find((i) => i.id === params.itemId)
    if (!item) return fail('NOT_FOUND', 'Item não está no carrinho.')
    const { ed } = assertAvailability(item.nftId, item.edition, quantity)
    item.quantity = quantity
    item.addedPriceEth = ed.priceEth
    bumpCart(c)
    return HttpResponse.json(cartView(c))
  })),
  http.delete(api('/cart/items/:itemId'), route<{ itemId: string }>('DELETE /cart/items/:itemId', ({ request, params }) => {
    const user = currentUser(request)
    const c = resolveCart(user?.id ?? null, guestId(request))
    c.items = c.items.filter((i) => i.id !== params.itemId)
    bumpCart(c)
    return HttpResponse.json(cartView(c))
  })),
  http.post(api('/cart/merge'), route('POST /cart/merge', async ({ request }) => {
    const user = currentUser(request, { required: true })
    const { guestCartId } = await readJson<{ guestCartId: string | null }>(request)
    const target = resolveCart(user.id, null)
    const guest = guestCartId ? db().carts[guestCartId] : undefined
    if (guest && guest.ownerId === null) {
      for (const gi of guest.items) {
        const ex = target.items.find((i) => i.nftId === gi.nftId && i.edition === gi.edition)
        const ed = findNft(gi.nftId)?.editions.find((e) => e.type === gi.edition)
        const max = ed?.available ?? 0
        if (ex) ex.quantity = Math.min(max || ex.quantity, ex.quantity + gi.quantity)
        else target.items.push({ ...gi, id: uid('ci') })
      }
      if (!target.couponCode) target.couponCode = guest.couponCode
      delete db().carts[guest.id]
      bumpCart(target)
    }
    return HttpResponse.json(cartView(target))
  })),
  http.post(api('/cart/coupon'), route('POST /cart/coupon', async ({ request }) => {
    const user = currentUser(request)
    const { code } = await readJson<{ code: string }>(request)
    validateCoupon(code ?? '')
    const c = resolveCart(user?.id ?? null, guestId(request))
    c.couponCode = code.trim().toUpperCase()
    bumpCart(c)
    return HttpResponse.json(cartView(c))
  })),
  http.delete(api('/cart/coupon'), route('DELETE /cart/coupon', ({ request }) => {
    const user = currentUser(request)
    const c = resolveCart(user?.id ?? null, guestId(request))
    c.couponCode = null
    bumpCart(c)
    return HttpResponse.json(cartView(c))
  })),
  http.post(api('/quotes'), route('POST /quotes', async ({ request }) => {
    const user = currentUser(request)
    const c = resolveCart(user?.id ?? null, guestId(request))
    return HttpResponse.json(await buildQuote(c, user?.id ?? null))
  })),
]

const orders = [
  http.post(api('/orders'), route('POST /orders', async ({ request }) => {
    const user = currentUser(request, { required: true })
    const key = request.headers.get('idempotency-key')
    if (!key) return fail('VALIDATION_ERROR', 'Idempotency-Key é obrigatório.')
    const body = await readJson<CreateOrderInput>(request)
    const bodyHash = stableStringify(body)
    const d = db()
    const prior = d.idempotency[key]
    if (prior) {
      if (prior.userId !== user.id || prior.bodyHash !== bodyHash) return fail('IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      settleDueOrders()
      return HttpResponse.json(stripOrder(d.orders[prior.orderId]!), { status: 200 })
    }
    const parsed = CollectorInput.safeParse(body.collector)
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Revise os dados do colecionador.', zodFields(parsed.error.issues))
    const wallets = d.wallets[user.id]
    const wallet = [wallets?.primary, wallets?.secondary].find((w) => w?.id === body.walletId)
    if (!wallet) return fail('VALIDATION_ERROR', 'Selecione uma carteira cadastrada.', { walletId: 'Selecione uma carteira' })
    const conn = d.connections[user.id]
    if (!conn || conn.walletId !== wallet.id) return fail('WALLET_REJECTED', 'Conecte a carteira antes de confirmar.')

    const c = resolveCart(user.id, null)
    const scenario = getScenario()
    const first = c.items[0]
    if (first && scenario === 'price-change' && shouldFailFirst('price-change')) {
      mutateNft(first.nftId, (n) => { const ed = n.editions.find((e) => e.type === first.edition); if (ed) ed.priceEth = (Number(ed.priceEth) * 1.1).toFixed(2) })
    }
    if (first && scenario === 'sold-out' && shouldFailFirst('sold-out')) {
      mutateNft(first.nftId, (n) => { const ed = n.editions.find((e) => e.type === first.edition); if (ed) ed.available = 0 })
    }
    const view = cartView(c)
    if (!view.items.length) return fail('VALIDATION_ERROR', 'Seu carrinho está vazio.')
    const blocked = view.items.find((i) => i.notice?.kind === 'sold_out' || i.notice?.kind === 'availability_reduced')
    if (blocked) return fail('AVAILABILITY_CONFLICT', `Disponibilidade alterada: ${blocked.name}.`, undefined, { cart: view })
    const fresh = await buildQuote(c, user.id)
    if (fresh.hash !== body.quoteHash) return fail('QUOTE_STALE', 'Os valores mudaram. Revise e confirme novamente.', undefined, { quote: fresh, cart: view })

    const now = Date.now()
    const order: DbOrder = {
      id: uid('ord'), status: 'pending', version: 1,
      txHash: `0x${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
      explorerUrl: '', createdAt: new Date(now).toISOString(), settledAt: null, declineReason: null,
      network: body.network, provider: body.provider, walletAddress: wallet.address,
      items: view.items.map((i) => ({ nftId: i.nftId, name: i.name, tokenId: i.tokenId, thumb: i.thumb, edition: i.edition, quantity: i.quantity, unitPriceEth: i.unitPriceEth, lineTotalEth: i.lineTotalEth })),
      subtotalEth: fresh.subtotalEth, discountEth: fresh.discountEth, networkFeeEth: fresh.networkFeeEth, totalEth: fresh.totalEth,
      userId: user.id, outcome: scenario === 'payment-declined' ? 'declined' : 'confirmed', settleAt: now + 3000, cartId: c.id,
    }
    order.explorerUrl = `https://sepolia.etherscan.io/tx/${order.txHash}#simulado`
    d.orders[order.id] = order
    d.idempotency[key] = { userId: user.id, bodyHash, orderId: order.id }
    commit()
    if (scenario === 'order-timeout' && shouldFailFirst('order-timeout')) await delay(12_000)
    return HttpResponse.json(stripOrder(order), { status: 201 })
  })),
  http.get(api('/orders/:id'), route<{ id: string }>('GET /orders/:id', ({ request, params }) => {
    const user = currentUser(request, { required: true })
    settleDueOrders()
    const order = db().orders[params.id]
    if (!order || order.userId !== user.id) return fail('NOT_FOUND', 'Pedido não encontrado.')
    return HttpResponse.json(stripOrder(order))
  })),
]
function stripOrder(o: DbOrder): Order {
  const { userId: _u, outcome: _o, settleAt: _s, cartId: _c, ...rest } = o
  return rest
}

const profile = [
  http.get(api('/me/profile'), route('GET /me/profile', ({ request }) => {
    const user = currentUser(request, { required: true })
    return HttpResponse.json(db().profiles[user.id])
  })),
  http.patch(api('/me/profile'), route('PATCH /me/profile', async ({ request }) => {
    const user = currentUser(request, { required: true })
    const body = await readJson<ProfileInput & { avatarUrl?: string | null }>(request)
    const parsed = ProfileInput.safeParse(body)
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Revise os campos.', zodFields(parsed.error.issues))
    const d = db()
    if (d.users.some((u) => u.id !== user.id && u.username.toLowerCase() === parsed.data.username.toLowerCase())) return fail('USERNAME_TAKEN', 'Nome de usuário indisponível.', { username: 'Nome de usuário em uso' })
    if (d.users.some((u) => u.id !== user.id && u.email.toLowerCase() === parsed.data.email.toLowerCase())) return fail('EMAIL_TAKEN', 'E-mail já cadastrado.', { email: 'E-mail já cadastrado' })
    if (body.avatarUrl && body.avatarUrl.length > 400_000) return fail('VALIDATION_ERROR', 'Imagem muito grande.', { avatar: 'Use uma imagem de até 300 KB' })
    const prev = d.profiles[user.id]!
    d.profiles[user.id] = { ...prev, ...parsed.data, avatarUrl: body.avatarUrl === undefined ? prev.avatarUrl : body.avatarUrl, version: prev.version + 1 }
    const u = d.users.find((x) => x.id === user.id)!
    u.username = parsed.data.username
    u.email = parsed.data.email
    commit()
    return HttpResponse.json(d.profiles[user.id])
  })),
  http.post(api('/me/password'), route('POST /me/password', async ({ request }) => {
    const user = currentUser(request, { required: true })
    const parsed = PasswordChangeInput.safeParse(await readJson(request))
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Revise os campos.', zodFields(parsed.error.issues))
    if ((await hashPassword(parsed.data.currentPassword)) !== user.passwordHash) return fail('VALIDATION_ERROR', 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta' })
    db().users.find((u) => u.id === user.id)!.passwordHash = await hashPassword(parsed.data.newPassword)
    commit()
    return new HttpResponse(null, { status: 204 })
  })),
]

const wallets = [
  http.get(api('/me/wallets'), route('GET /me/wallets', ({ request }) => {
    const user = currentUser(request, { required: true })
    return HttpResponse.json<WalletsResponse>(db().wallets[user.id] ?? { primary: null, secondary: null })
  })),
  http.put(api('/me/wallets/:slot'), route<{ slot: string }>('PUT /me/wallets/:slot', async ({ request, params }) => {
    const user = currentUser(request, { required: true })
    const slot = params.slot as WalletSlot
    if (slot !== 'primary' && slot !== 'secondary') return fail('NOT_FOUND', 'Carteira inexistente.')
    const parsed = WalletInput.safeParse(await readJson(request))
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Revise os campos.', zodFields(parsed.error.issues))
    const d = db()
    const current = d.wallets[user.id] ?? { primary: null, secondary: null }
    const other = current[slot === 'primary' ? 'secondary' : 'primary']
    if (slot === 'secondary' && !current.primary) return fail('VALIDATION_ERROR', 'Cadastre a carteira principal primeiro.')
    if (other && other.address.toLowerCase() === parsed.data.address.toLowerCase() && other.network === parsed.data.network) {
      return fail('VALIDATION_ERROR', 'Este endereço já está cadastrado na outra carteira.', { address: 'Endereço já cadastrado nesta rede' })
    }
    const prev = current[slot]
    current[slot] = { ...parsed.data, id: prev?.id ?? `wal_${user.id}_${slot}`, slot, version: (prev?.version ?? 0) + 1 }
    d.wallets[user.id] = current
    commit()
    return HttpResponse.json(current)
  })),
  http.post(api('/me/wallet-connection'), route('POST /me/wallet-connection', async ({ request }) => {
    const user = currentUser(request, { required: true })
    const body = await readJson<{ walletId: string; provider: WalletProvider; network: Network }>(request)
    const w = db().wallets[user.id]
    const wallet = [w?.primary, w?.secondary].find((x) => x?.id === body.walletId)
    if (!wallet) return fail('NOT_FOUND', 'Carteira não encontrada.')
    await delay(600)
    if (getScenario() === 'wallet-reject') return fail('WALLET_REJECTED', 'Conexão recusada na carteira.')
    db().connections[user.id] = { walletId: wallet.id, provider: body.provider, network: body.network, address: wallet.address, connectedAt: new Date().toISOString() }
    commit()
    return HttpResponse.json(db().connections[user.id])
  })),
  http.get(api('/me/wallet-connection'), route('GET /me/wallet-connection', ({ request }) => {
    const user = currentUser(request, { required: true })
    return HttpResponse.json({ connection: db().connections[user.id] ?? null })
  })),
  http.delete(api('/me/wallet-connection'), route('DELETE /me/wallet-connection', ({ request }) => {
    const user = currentUser(request, { required: true })
    db().connections[user.id] = null
    commit()
    return new HttpResponse(null, { status: 204 })
  })),
]

const admin = [
  http.post('/__mock/reset', () => { resetDb(); return HttpResponse.json({ ok: true }) }),
  http.get('/__mock/scenario', () => HttpResponse.json({ current: getScenario(), available: SCENARIOS })),
  http.post('/__mock/scenario', async ({ request }) => {
    const { name } = (await request.json()) as { name: ScenarioName }
    if (!(name in SCENARIOS)) return fail('VALIDATION_ERROR', 'Cenário inexistente.')
    setScenario(name)
    db().flags = {}
    commit()
    return HttpResponse.json({ current: name })
  }),
  http.post('/__mock/nfts/:id', async ({ params, request }) => {
    const { priceDeltaPct, available, edition = '1/50' } = (await request.json()) as { priceDeltaPct?: number; available?: number; edition?: string }
    try {
      const nft = mutateNft(params.id as string, (n) => {
        const ed = n.editions.find((e) => e.type === edition)
        if (!ed) return
        if (priceDeltaPct) ed.priceEth = (Number(ed.priceEth) + Number(pct(ed.priceEth, priceDeltaPct))).toFixed(2)
        if (available !== undefined) ed.available = available
      })
      return HttpResponse.json(nft)
    } catch (e) {
      return e instanceof ApiFailure ? fail(e.code, e.message) : fail('INTERNAL', 'erro')
    }
  }),
  http.post('/__mock/realtime/drop', async ({ request }) => {
    const { offlineMs = 0 } = (await request.json().catch(() => ({}))) as { offlineMs?: number }
    dropConnections(offlineMs)
    return HttpResponse.json({ ok: true })
  }),
  http.post('/__mock/realtime/replay', async ({ request }) => {
    const { kind } = (await request.json()) as { kind: 'duplicate' | 'stale' }
    return HttpResponse.json({ ok: replay(kind) })
  }),
  http.post('/__mock/session/expire', () => {
    for (const s of Object.values(db().sessions)) s.expiresAt = Date.now() - 1
    commit()
    return HttpResponse.json({ ok: true })
  }),
]

export const handlers = [...auth, ...catalog, ...favorites, ...cart, ...orders, ...profile, ...wallets, ...admin, realtimeHandler]
