import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CollectorInput, EDITION_LABEL, NETWORKS, NETWORK_LABEL, WALLET_PROVIDERS, WALLET_PROVIDER_LABEL,
  type Cart, type CreateOrderInput, type Network, type Quote, type Wallet, type WalletProvider,
} from '@/api/contracts'
import { apiClient } from '@/api/endpoints'
import { ApiError } from '@/api/http'
import { qk, useCart, useCartOwner, useProfile, useQuote, useWalletConnection, useWallets } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, NativeSelect } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cartBlocked, SummaryRows } from '@/features/cart/cart-page'
import { useSession } from '@/features/session/session-store'
import { formatEth } from '@/lib/money'
import { readJSON, removeKey, STORAGE, writeJSON } from '@/lib/storage'
import { useZodForm } from '@/lib/use-form'
import { cn, shortHash } from '@/lib/utils'

type CollectorForm = {
  displayName: string; username: string; network: string; profileName: string; address: string; ensOrSecondary: string
  provider: string; referralCode: string; email: string; ensName: string; note: string
}
export interface PendingCheckout { userId: string; key: string; body: CreateOrderInput; orderId?: string }

const DRAFT_KEY = 'kurio:checkout-draft'
const emptyForm: CollectorForm = { displayName: '', username: '', network: '', profileName: '', address: '', ensOrSecondary: '', provider: '', referralCode: '', email: '', ensName: '', note: '' }

function fromWallet(w: Wallet | null, username: string, base: CollectorForm): CollectorForm {
  if (!w) return { ...base, username }
  return { ...base, displayName: w.displayName, username, network: w.network, profileName: w.profileName, address: w.address, ensOrSecondary: w.ensOrSecondary ?? '', provider: w.provider, referralCode: w.referralCode, email: w.email, ensName: w.ensName }
}

function usePlaceOrder() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: async (pending: PendingCheckout) => {
      let lastError: unknown
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await apiClient.orders.create(pending.body, pending.key)
        } catch (e) {
          lastError = e
          if (!(e instanceof ApiError) || !e.isTransient) throw e
          toast.info('Confirmando o pedido com o servidor…', { id: 'order-retry' })
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
        }
      }
      throw lastError
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.code === 'QUOTE_STALE' || e.code === 'AVAILABILITY_CONFLICT')) {
        const details = e.details as { quote?: Quote; cart?: Cart } | undefined
        if (details?.cart) qc.setQueryData(qk.cart(owner), details.cart)
        void qc.invalidateQueries({ queryKey: ['cart'] })
        void qc.invalidateQueries({ queryKey: ['quote'] })
      }
    },
  })
}

function WalletOption({ wallet, selected, onSelect }: { wallet: Wallet; selected: boolean; onSelect: () => void }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-md bg-surface p-4', selected && 'ring-1 ring-primary')}>
      <input type="radio" name="wallet" checked={selected} onChange={onSelect} className="mt-1 accent-[hsl(var(--primary))]" />
      <span className="text-sm">
        <strong className="block">{wallet.slot === 'primary' ? 'Principal' : 'Reserva'} · {wallet.nickname}</strong>
        <span className="block text-muted-foreground">{wallet.ensOrSecondary || shortHash(wallet.address)}</span>
        <span className="block text-muted-foreground">Rede {NETWORK_LABEL[wallet.network]}</span>
      </span>
    </label>
  )
}

export function CheckoutPage() {
  const session = useSession()!
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: cart, isPending: cartPending } = useCart()
  const quote = useQuote(cart)
  const wallets = useWallets()
  const profile = useProfile()
  const connection = useWalletConnection()
  const place = usePlaceOrder()
  const submitting = useRef(false)

  const [walletId, setWalletId] = useState<string | null>(null)
  const [provider, setProvider] = useState<WalletProvider>('coinbase')
  const [network, setNetwork] = useState<Network>('ethereum')
  const [useSecondary, setUseSecondary] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [staleNotice, setStaleNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingCheckout | null>(() => {
    const p = readJSON<PendingCheckout>(STORAGE.pendingCheckout)
    return p && p.userId === session.user.id ? p : null
  })

  const f = useZodForm(CollectorInput, readJSON<CollectorForm>(DRAFT_KEY) ?? emptyForm, 'collector')

  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !wallets.data || !profile.data) return
    prefilled.current = true
    const w = wallets.data.primary
    const filled = fromWallet(w, profile.data.username, emptyForm)
    f.setValues((v) => Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val || filled[k as keyof CollectorForm]])) as CollectorForm)
    if (w) { setWalletId(w.id); setNetwork(w.network); setProvider(w.provider) }
  }, [wallets.data, profile.data, f])
  useEffect(() => {
    if (!walletId && wallets.data?.primary) setWalletId(wallets.data.primary.id)
  }, [walletId, wallets.data])
  useEffect(() => { writeJSON(DRAFT_KEY, f.values) }, [f.values])

  const connect = useMutation({
    mutationFn: () => apiClient.wallets.connect({ walletId: walletId!, provider, network }),
    onSuccess: (c) => { qc.setQueryData(qk.connection(session.user.id), { connection: c }); toast.success(`${WALLET_PROVIDER_LABEL[c.provider]} conectada.`) },
    onError: (e) => toast.error('Conexão com a carteira recusada.', { description: (e as Error).message }),
  })
  const disconnect = useMutation({
    mutationFn: () => apiClient.wallets.disconnect(),
    onSuccess: () => { qc.setQueryData(qk.connection(session.user.id), { connection: null }); toast.info('Carteira desconectada.') },
  })

  const conn = connection.data?.connection ?? null
  const connected = !!conn && conn.walletId === walletId && conn.provider === provider && conn.network === network
  const blocked = cartBlocked(cart)
  const allWallets = useMemo(() => [wallets.data?.primary, wallets.data?.secondary].filter((w): w is Wallet => !!w), [wallets.data])

  const reviewedHash = useRef<string | null>(null)
  useEffect(() => {
    if (reviewOpen && reviewedHash.current && quote.data && quote.data.hash !== reviewedHash.current) {
      setReviewOpen(false)
      setStaleNotice('Os valores mudaram enquanto você revisava. Confira o novo total e confirme novamente.')
    }
  }, [quote.data, reviewOpen])

  const openReview = f.submit(() => {
    if (!walletId) { toast.error('Selecione uma carteira cadastrada.'); return }
    if (!connected) { toast.error('Conecte a carteira selecionada antes de revisar.'); return }
    if (!quote.data || blocked) return
    reviewedHash.current = quote.data.hash
    setStaleNotice(null)
    setReviewOpen(true)
  })

  const send = async (p: PendingCheckout) => {
    if (submitting.current) return
    submitting.current = true
    writeJSON(STORAGE.pendingCheckout, p)
    setPending(p)
    try {
      const order = await place.mutateAsync(p)
      const saved = { ...p, orderId: order.id }
      writeJSON(STORAGE.pendingCheckout, saved)
      removeKey(DRAFT_KEY)
      void navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
    } catch (e) {
      const err = e as ApiError
      setReviewOpen(false)
      if (err.code === 'QUOTE_STALE') setStaleNotice('Os valores mudaram desde a sua revisão. Confira o novo total e confirme novamente.')
      else if (err.code === 'AVAILABILITY_CONFLICT') setStaleNotice(`${err.message} Ajuste o carrinho para continuar.`)
      else toast.error('Não foi possível enviar o pedido.', { description: err.message })
      if (!err.isTransient) { removeKey(STORAGE.pendingCheckout); setPending(null) }
    } finally {
      submitting.current = false
    }
  }

  const confirm = () => {
    if (!quote.data || !walletId) return
    const body: CreateOrderInput = {
      quoteId: quote.data.id, quoteHash: quote.data.hash, walletId, network, provider,
      collector: CollectorInput.parse(f.values),
    }
    const sameAttempt = pending && pending.body.quoteHash === body.quoteHash && JSON.stringify(pending.body) === JSON.stringify(body)
    void send(sameAttempt ? pending : { userId: session.user.id, key: crypto.randomUUID(), body })
  }

  if (!cartPending && cart && cart.items.length === 0 && !pending) {
    return (
      <div className="container mt-16 text-center">
        <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
        <Button asChild className="mt-4"><Link to="/" hash="catalogo">Explorar NFTs</Link></Button>
      </div>
    )
  }

  const switchWallet = (secondary: boolean) => {
    setUseSecondary(secondary)
    const w = secondary ? wallets.data?.secondary ?? null : wallets.data?.primary ?? null
    if (w) { f.setValues((v) => fromWallet(w, v.username, v)); setWalletId(w.id); setNetwork(w.network); setProvider(w.provider) }
  }

  return (
    <div className="container">
      <nav aria-label="Trilha" className="mt-8 hidden md:block text-sm font-bold"><Link to="/">Início</Link> / <Link to="/carrinho">Carrinho</Link> / <span aria-current="page">Pagamento</span></nav>
      <h1 className="sr-only">Pagamento</h1>

      {pending && (
        <div role="status" className="mt-4 rounded-md border border-primary/60 bg-surface p-4 text-sm">
          {pending.orderId ? (
            <>Você tem um pedido em andamento. <Link className="font-bold text-primary underline" to="/pedido/$orderId" params={{ orderId: pending.orderId }}>Acompanhar pedido</Link></>
          ) : (
            <>Uma tentativa de compra não recebeu resposta. <button className="font-bold text-primary underline" disabled={place.isPending} onClick={() => send(pending)}>Retomar sem duplicar</button></>
          )}
        </div>
      )}
      {staleNotice && <p role="alert" className="mt-4 rounded-md border border-primary bg-primary/10 p-4 text-sm">{staleNotice}</p>}

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_405px]">
        <form noValidate onSubmit={openReview} aria-labelledby="collector-title" className="space-y-5">
          <h2 id="collector-title" className="text-lg font-bold">Perfil do colecionador</h2>
          {f.formError && <p role="alert" className="text-sm text-destructive">{f.formError}</p>}
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <Field id="collector-displayName" label="Nome de exibição" required error={f.errors.displayName}>{(a) => <Input {...a} {...f.bind('displayName')} />}</Field>
            <Field id="collector-username" label="Nome de usuário" required error={f.errors.username}>{(a) => <Input {...a} {...f.bind('username')} autoComplete="username" />}</Field>
            <Field id="collector-network" label="Rede" required error={f.errors.network}>
              {(a) => (
                <NativeSelect {...a} {...f.bind('network')} onChange={(e) => { f.set('network', e.target.value); if (e.target.value) setNetwork(e.target.value as Network) }}>
                  <option value="">Selecione uma rede</option>
                  {NETWORKS.map((n) => <option key={n} value={n}>{NETWORK_LABEL[n]}</option>)}
                </NativeSelect>
              )}
            </Field>
            <Field id="collector-profileName" label="Nome do perfil" required error={f.errors.profileName}>{(a) => <Input {...a} {...f.bind('profileName')} />}</Field>
            <Field id="collector-address" label="Endereço da carteira" required error={f.errors.address}>{(a) => <Input {...a} {...f.bind('address')} placeholder="Endereço 0x da carteira" spellCheck={false} />}</Field>
            <Field id="collector-ensOrSecondary" label="ENS ou carteira secundária (opcional)" error={f.errors.ensOrSecondary}>{(a) => <Input {...a} {...f.bind('ensOrSecondary')} />}</Field>
            <Field id="collector-provider" label="Tipo de carteira" required error={f.errors.provider}>
              {(a) => (
                <NativeSelect {...a} {...f.bind('provider')} onChange={(e) => { f.set('provider', e.target.value); if (e.target.value) setProvider(e.target.value as WalletProvider) }}>
                  <option value="">Selecione uma carteira</option>
                  {WALLET_PROVIDERS.map((p) => <option key={p} value={p}>{WALLET_PROVIDER_LABEL[p]}</option>)}
                </NativeSelect>
              )}
            </Field>
            <Field id="collector-referralCode" label="Código de indicação" required error={f.errors.referralCode}>{(a) => <Input {...a} {...f.bind('referralCode')} />}</Field>
            <Field id="collector-email" label="E-mail" required error={f.errors.email}>{(a) => <Input {...a} {...f.bind('email')} type="email" autoComplete="email" />}</Field>
            <Field id="collector-ensName" label="Nome ENS" required error={f.errors.ensName} hint="Sufixo .eth">{(a) => <Input {...a} {...f.bind('ensName')} />}</Field>
          </div>
          {wallets.data?.secondary && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useSecondary} onChange={(e) => switchWallet(e.target.checked)} className="accent-[hsl(var(--primary))]" /> Usar outra carteira?
            </label>
          )}
          <Field id="collector-note" label="Observação do colecionador (opcional)" error={f.errors.note}>
            {(a) => <textarea {...a} {...f.bind('note')} rows={5} maxLength={280} className="w-full max-w-md rounded-sm border border-input bg-transparent p-3 text-sm" />}
          </Field>
          <button type="submit" className="sr-only">Revisar pedido</button>
        </form>

        <aside aria-labelledby="checkout-summary" className="space-y-5">
          <h2 id="checkout-summary" className="text-lg font-bold">Seus NFTs</h2>
          {cartPending ? <Skeleton className="h-40 w-full" /> : (
            <ul className="space-y-2">
              {cart?.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 bg-surface p-2">
                  <img src={i.thumb} alt="" width={64} height={64} className="size-16 rounded-sm object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{i.name}</p>
                    <p className="text-xs text-muted-foreground">ID do token: {i.tokenId} · {EDITION_LABEL[i.edition]}</p>
                    {i.notice && <p className="text-xs text-primary" role="status">{i.notice.kind === 'price_changed' ? 'Preço atualizado' : 'Disponibilidade alterada'}</p>}
                  </div>
                  <span className="text-xs">(x {i.quantity})</span>
                  <span className="font-bold text-primary">{formatEth(i.lineTotalEth)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-center text-sm">Tem um código promocional? <Link to="/carrinho" className="text-primary underline">Aplique aqui</Link></p>
          <SummaryRows quote={quote.data} loading={quote.isPending || quote.isFetching} />

          <fieldset className="space-y-3">
            <legend className="mb-2 w-full text-center font-bold">Carteira e rede</legend>
            {wallets.isPending ? <Skeleton className="h-24 w-full" /> : allWallets.length === 0 ? (
              <p className="text-sm">Nenhuma carteira cadastrada. <Link to="/perfil/carteiras" className="text-primary underline">Cadastrar carteira</Link></p>
            ) : allWallets.map((w) => <WalletOption key={w.id} wallet={w} selected={walletId === w.id} onSelect={() => { setWalletId(w.id); setNetwork(w.network) }} />)}
            <div role="radiogroup" aria-label="Provedor da carteira" className="space-y-2">
              {WALLET_PROVIDERS.map((p) => (
                <label key={p} className={cn('flex cursor-pointer items-center gap-3 border border-border px-4 py-3 text-sm', provider === p && 'border-foreground')}>
                  <input type="radio" name="provider" checked={provider === p} onChange={() => setProvider(p)} className="accent-[hsl(var(--primary))]" />
                  {WALLET_PROVIDER_LABEL[p]}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 text-sm" aria-live="polite">
              <span>{connected ? `Conectada: ${shortHash(conn!.address)} (${NETWORK_LABEL[conn!.network]})` : 'Carteira não conectada'}</span>
              {connected ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>Desconectar</Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => connect.mutate()} disabled={!walletId || connect.isPending}>{connect.isPending ? 'Conectando…' : 'Conectar carteira'}</Button>
              )}
            </div>
          </fieldset>

          <Button size="lg" className="w-full" onClick={() => openReview()} disabled={!quote.data || blocked || place.isPending}>
            Revisar pedido
          </Button>
        </aside>
      </div>

      <Dialog open={reviewOpen} onOpenChange={(o) => !place.isPending && setReviewOpen(o)}>
        <DialogContent className="p-6 sm:p-10">
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription className="mt-1">Confira itens, carteira e valores antes de confirmar.</DialogDescription>
          <ul className="mt-6 space-y-2 text-sm">
            {quote.data?.items.map((l) => {
              const item = cart?.items.find((i) => i.id === l.cartItemId)
              return <li key={l.cartItemId} className="flex justify-between gap-2"><span>{item?.name ?? l.nftId} ({EDITION_LABEL[l.edition]}) × {l.quantity}</span><span className="text-primary">{formatEth(l.lineTotalEth)}</span></li>
            })}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">Carteira: {WALLET_PROVIDER_LABEL[provider]} · {shortHash(conn?.address ?? '')} · {NETWORK_LABEL[network]}</p>
          <div className="mt-6"><SummaryRows quote={quote.data} /></div>
          <Button size="lg" className="mt-8 w-full" onClick={confirm} disabled={place.isPending} aria-busy={place.isPending}>
            {place.isPending ? 'Enviando pedido…' : 'Confirmar compra'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
