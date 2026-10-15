import { useEffect } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Loader2, MailOpen, XCircle } from 'lucide-react'
import { EDITION_LABEL, NETWORK_LABEL, WALLET_PROVIDER_LABEL } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { useOrder } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NotFoundView } from '@/components/layout/not-found'
import { formatEth } from '@/lib/money'
import { readJSON, removeKey, STORAGE } from '@/lib/storage'
import { formatDate, shortHash } from '@/lib/utils'
import type { PendingCheckout } from '@/features/checkout/checkout-page'

export function OrderPage() {
  const { orderId } = useParams({ from: '/pedido/$orderId' })
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId)

  useEffect(() => {
    if (!order || order.status === 'pending') return
    const p = readJSON<PendingCheckout>(STORAGE.pendingCheckout)
    if (p?.orderId === order.id) removeKey(STORAGE.pendingCheckout)
  }, [order])

  if (isPending) return <div className="container mt-16 max-w-xl"><Skeleton className="h-[520px] w-full" /></div>
  if (isError) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return <NotFoundView title="Pedido não encontrado" description="Verifique o link ou acesse com a conta que fez a compra." />
    return <div role="alert" className="container mt-16 text-center"><p>{(error as Error).message}</p><Button className="mt-4" onClick={() => refetch()}>Tentar novamente</Button></div>
  }

  if (order.status === 'pending') {
    return (
      <section className="container mt-20 max-w-xl text-center" aria-live="polite" aria-busy="true">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden="true" />
        <h1 className="mt-6 text-xl font-bold">Aguardando confirmação na rede</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pedido {shortHash(order.id, 8, 4)} · {formatEth(order.totalEth)}. Você pode recarregar a página: o estado será recuperado sem criar outra compra.</p>
      </section>
    )
  }

  if (order.status === 'declined') {
    return (
      <section className="container mt-20 max-w-xl text-center" role="alert">
        <XCircle className="mx-auto size-12 text-destructive" aria-hidden="true" />
        <h1 className="mt-6 text-xl font-bold">Pagamento recusado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{order.declineReason ?? 'A transação não foi concluída.'} Seus itens continuam no carrinho.</p>
        <Button asChild className="mt-6"><Link to="/carrinho">Voltar ao carrinho</Link></Button>
      </section>
    )
  }

  return (
    <section className="container mt-12 max-w-[578px]" aria-labelledby="receipt-title">
      <div className="border-b-[10px] border-primary bg-surface">
        <div className="px-6 pb-5 pt-6 text-center">
          <MailOpen className="mx-auto size-16 text-primary" aria-hidden="true" />
          <h1 id="receipt-title" className="mt-4 font-bold text-muted-foreground">Seus NFTs agora estão na sua carteira</h1>
        </div>
        <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary">
          <div className="sm:pr-3"><dt className="font-bold text-muted-foreground">ID da transação</dt><dd>{shortHash(order.txHash, 6, 4)}</dd></div>
          <div className="sm:px-3"><dt className="text-muted-foreground">Data</dt><dd>{formatDate(order.settledAt ?? order.createdAt)}</dd></div>
          <div className="sm:px-3"><dt className="text-muted-foreground">Total</dt><dd>{formatEth(order.totalEth)}</dd></div>
          <div className="sm:pl-3"><dt className="font-bold text-muted-foreground">Carteira</dt><dd>{WALLET_PROVIDER_LABEL[order.provider]}</dd></div>
        </dl>
        <div className="px-6 py-6 sm:px-11">
          <h2 className="font-bold">Detalhes da transação</h2>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-border text-left"><th className="pb-2">NFTs</th><th className="pb-2 text-center">Edições</th><th className="pb-2 text-right">Subtotal</th></tr></thead>
            <tbody>
              {order.items.map((l) => (
                <tr key={`${l.nftId}-${l.edition}`}>
                  <td className="py-2"><div className="flex items-center gap-3"><img src={l.thumb} alt="" width={64} height={64} className="size-16 rounded-sm object-cover" /><div><p className="font-bold">{l.name}</p><p className="text-xs text-muted-foreground">ID do token: {l.tokenId} · {EDITION_LABEL[l.edition]}</p></div></div></td>
                  <td className="text-center">(x {l.quantity})</td>
                  <td className="text-right font-bold text-primary">{formatEth(l.lineTotalEth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatEth(order.subtotalEth)}</dd></div>
            {order.discountEth !== '0' && <div className="flex justify-between"><dt>Desconto</dt><dd>(-) {formatEth(order.discountEth)}</dd></div>}
            <div className="flex justify-between"><dt>Taxa de rede</dt><dd>{formatEth(order.networkFeeEth)}</dd></div>
            <div className="flex justify-between border-b border-border pb-2 font-bold"><dt>Total</dt><dd className="text-primary">{formatEth(order.totalEth)}</dd></div>
          </dl>
          <p className="mt-4 text-center text-sm text-muted-foreground">Transação confirmada na {NETWORK_LABEL[order.network]} (simulação). A propriedade foi transferida para sua carteira conectada e registrada na rede.</p>
          <div className="mt-5 text-center">
            <Button asChild><a href={order.explorerUrl} target="_blank" rel="noreferrer noopener">Ver no Etherscan <span className="sr-only">(simulado, abre em nova aba)</span></a></Button>
          </div>
        </div>
      </div>
    </section>
  )
}
