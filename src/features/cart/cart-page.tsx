import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { EDITION_LABEL, type Cart, type CartItem, type Quote } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { useCart, useCoupon, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { QuantityStepper } from '@/features/nft/nft-detail-page'
import { useSession } from '@/features/session/session-store'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export function itemNotice(item: CartItem) {
  if (!item.notice) return null
  if (item.notice.kind === 'sold_out') return 'Edição esgotada. Remova o item para continuar.'
  if (item.notice.kind === 'availability_reduced') return `Restam apenas ${item.available}. Ajuste a quantidade.`
  return `Preço alterado de ${formatEth(item.notice.previousPriceEth ?? '0')} para ${formatEth(item.unitPriceEth)}.`
}
export const cartBlocked = (cart?: Cart) => !!cart?.items.some((i) => i.notice?.kind === 'sold_out' || i.notice?.kind === 'availability_reduced')

export function SummaryRows({ quote, loading }: { quote?: Quote; loading?: boolean }) {
  const row = (label: string, value?: string, extra?: string) => (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-right">{loading || !value ? <Skeleton className="inline-block h-5 w-24 align-middle" /> : value}{extra && <span className="block text-[11px] text-primary">{extra}</span>}</dd>
    </div>
  )
  return (
    <dl className="space-y-3 text-sm" aria-busy={loading}>
      {row('Subtotal', quote && formatEth(quote.subtotalEth))}
      {row(quote?.coupon ? `Desconto (${quote.coupon.code} −${quote.coupon.percentOff}%)` : 'Desconto do lançamento', quote && `(-) ${formatEth(quote.discountEth, { suffix: false })}`)}
      {row('Taxa de rede', quote && formatEth(quote.networkFeeEth), 'Taxa estimada')}
      <div className="flex items-baseline justify-between border-t border-border pt-4 text-base font-bold">
        <dt>Total</dt>
        <dd className="text-primary" aria-live="polite">{loading || !quote ? <Skeleton className="inline-block h-6 w-28 align-middle" /> : formatEth(quote.totalEth)}</dd>
      </div>
    </dl>
  )
}

function CouponForm({ cart }: { cart: Cart }) {
  const { apply, remove } = useCoupon()
  const [code, setCode] = useState('')
  const error = apply.error instanceof ApiError ? apply.error.message : null
  if (cart.couponCode) {
    return (
      <div className="flex items-center justify-between rounded-sm border border-primary/50 px-3 py-2 text-sm">
        <span>Código <strong>{cart.couponCode}</strong> aplicado</span>
        <Button variant="link" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}>Remover</Button>
      </div>
    )
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) apply.mutate(code.trim(), { onSuccess: () => setCode('') }) }}>
      <label htmlFor="coupon" className="mb-2 block text-sm font-bold">Código promocional</label>
      <div className="flex">
        <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Digite o código promocional..." aria-invalid={!!error} aria-describedby={error ? 'coupon-error' : undefined} className="h-10 min-w-0 flex-1 rounded-l-sm border border-primary bg-transparent px-3 text-sm" />
        <Button type="submit" className="rounded-l-none" disabled={apply.isPending}>{apply.isPending ? 'Aplicando…' : 'Aplicar'}</Button>
      </div>
      {error && <p id="coupon-error" role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  )
}

function CartRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const notice = itemNotice(item)
  const busy = update.isPending || remove.isPending
  return (
    <li className={cn('bg-surface p-3', busy && 'opacity-70')}>
      <div className="grid grid-cols-[70px_1fr_auto] items-center gap-4 md:grid-cols-[70px_1.4fr_0.8fr_0.9fr_0.8fr_auto]">
        <img src={item.thumb} alt="" width={70} height={70} className="size-[70px] rounded-sm object-cover" />
        <div className="min-w-0">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="block truncate font-bold hover:text-primary">{item.name}</Link>
          <p className="text-xs text-muted-foreground">ID do token: {item.tokenId} · Edição {EDITION_LABEL[item.edition]}</p>
          <p className="text-primary md:hidden">{formatEth(item.lineTotalEth)}</p>
        </div>
        <p className="hidden text-primary md:block">{formatEth(item.unitPriceEth)}</p>
        <div className="col-span-3 flex items-center justify-between md:col-span-1">
          <QuantityStepper
            value={item.quantity}
            max={Math.max(item.quantity, item.available)}
            onChange={(q) => update.mutate({ itemId: item.id, quantity: q })}
            label={`Quantidade de ${item.name}`}
            disabled={busy || item.available === 0}
          />
        </div>
        <p className="hidden font-bold text-primary md:block">{formatEth(item.lineTotalEth)}</p>
        <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(item.id)} disabled={busy} aria-label={`Remover ${item.name} do carrinho`} className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto"><Trash2 /></Button>
      </div>
      {notice && (
        <p role="status" className="mt-2 flex items-center gap-2 text-xs text-primary"><AlertTriangle className="size-4" aria-hidden="true" />{notice}</p>
      )}
    </li>
  )
}

export function CartPage() {
  const { data: cart, isPending, isError, refetch, error } = useCart()
  const quote = useQuote(cart)
  const session = useSession()
  const navigate = useNavigate()
  const blocked = cartBlocked(cart)

  return (
    <div className="container">
      <nav aria-label="Trilha" className="mt-8 hidden md:block text-sm font-bold"><Link to="/">Início</Link> / <Link to="/" hash="catalogo">Mercado</Link> / <span aria-current="page">Carrinho</span></nav>
      <h1 className="sr-only">Carrinho de NFTs</h1>
      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_332px] lg:gap-20">
        <section aria-label="Itens do carrinho">
          <div className="hidden grid-cols-[70px_1.4fr_0.8fr_0.9fr_0.8fr_auto] gap-4 border-b border-border pb-2 font-bold md:grid">
            <span className="col-span-2">NFTs</span><span>Preço</span><span>Edições</span><span>Total</span><span className="w-8" />
          </div>
          {isPending ? (
            <ul className="mt-3 space-y-3" aria-busy="true" aria-label="Carregando carrinho">{[0, 1, 2].map((i) => <li key={i}><Skeleton className="h-[94px] w-full" /></li>)}</ul>
          ) : isError ? (
            <div role="alert" className="mt-6 text-center"><p>{(error as Error).message}</p><Button className="mt-3" onClick={() => refetch()}>Tentar novamente</Button></div>
          ) : cart.items.length === 0 ? (
            <div className="mt-6 rounded-md bg-surface p-8 text-center">
              <p className="font-bold">Seu carrinho está vazio.</p>
              <Button asChild className="mt-4"><Link to="/" hash="catalogo">Explorar NFTs</Link></Button>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">{cart.items.map((i) => <CartRow key={i.id} item={i} />)}</ul>
          )}
        </section>

        <aside aria-labelledby="summary-title" className="space-y-6">
          <h2 id="summary-title" className="border-b border-border pb-2 text-lg font-bold">Resumo da carteira</h2>
          {cart && <CouponForm cart={cart} />}
          {cart && cart.items.length > 0 ? (
            <SummaryRows quote={quote.data} loading={quote.isPending || (quote.isFetching && quote.isPlaceholderData)} />
          ) : isPending ? <SummaryRows loading /> : null}
          {quote.isError && <p role="alert" className="text-sm text-destructive">Não foi possível calcular o total. <button className="underline" onClick={() => quote.refetch()}>Tentar novamente</button></p>}
          {blocked && <p role="alert" className="text-sm text-primary">Ajuste os itens com disponibilidade alterada para continuar.</p>}
          <Button
            size="lg" className="w-full"
            disabled={!cart?.items.length || blocked || !quote.data}
            onClick={() => (session ? navigate({ to: '/checkout' }) : navigate({ to: '/entrar', search: { redirect: '/checkout' } }))}
          >Conectar e finalizar</Button>
          <Button asChild variant="link" className="w-full"><Link to="/" hash="catalogo">Continuar explorando</Link></Button>
        </aside>
      </div>
    </div>
  )
}
