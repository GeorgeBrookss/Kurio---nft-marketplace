import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Minus, Plus, Star } from 'lucide-react'
import { EDITION_LABEL, NETWORK_LABEL, type EditionType } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { useAddToCart, useCart, useCatalog, useNft } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FavoriteButton, NftCard } from '@/features/catalog/nft-card'
import { formatEth } from '@/lib/money'
import { cn, shortHash } from '@/lib/utils'
import { NotFoundView } from '@/components/layout/not-found'

export function QuantityStepper({ value, min = 1, max, onChange, label, disabled }: { value: number; min?: number; max: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <Button type="button" size="icon-sm" className="rounded-full" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label="Diminuir quantidade"><Minus /></Button>
      <output aria-live="polite" className="min-w-6 text-center text-lg">{value}</output>
      <Button type="button" size="icon-sm" className="rounded-full" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="Aumentar quantidade"><Plus /></Button>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="container mt-8 grid gap-8 lg:grid-cols-[100px_445px_1fr]" aria-busy="true" aria-label="Carregando NFT">
      <div className="hidden flex-col gap-4 lg:flex">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="size-[100px]" />)}</div>
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-6 w-1/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-1/2" /><Skeleton className="h-10 w-full" /></div>
    </div>
  )
}

export function NftDetailPage() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const { data: nft, isPending, isError, error, refetch } = useNft(nftId)
  const { data: cart } = useCart()
  const add = useAddToCart()
  const navigate = useNavigate()
  const [edition, setEdition] = useState<EditionType>('1/50')
  const [qty, setQty] = useState(1)
  const [image, setImage] = useState(0)
  const [tab, setTab] = useState<'details' | 'reviews'>('details')
  const related = useCatalog({ page: 1 })

  if (isPending) return <DetailSkeleton />
  if (isError) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return <NotFoundView title="NFT não encontrado" description="Este NFT não existe ou foi removido do mercado." />
    return (
      <div role="alert" className="container mt-16 text-center">
        <p className="font-bold">Não foi possível carregar este NFT.</p>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <Button className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  const selected = nft.editions.find((e) => e.type === edition) ?? nft.editions[0]!
  const inCart = cart?.items.find((i) => i.nftId === nft.id && i.edition === selected.type)?.quantity ?? 0
  const maxQty = Math.max(0, selected.available - inCart)
  const unavailable = maxQty === 0
  const quantity = Math.min(Math.max(1, qty), Math.max(1, maxQty))

  const buy = async (goToCart: boolean) => {
    await add.mutateAsync({ nftId: nft.id, edition: selected.type, quantity })
    setQty(1)
    if (goToCart) void navigate({ to: '/carrinho' })
  }

  return (
    <div className="container">
      <nav aria-label="Trilha" className="mt-8 hidden md:block text-sm font-bold"><Link to="/">Início</Link> / <Link to="/" hash="catalogo">Mercado</Link></nav>
      <div className="mt-4 grid gap-8 lg:grid-cols-[100px_445px_1fr]">
        <ul className="order-2 flex gap-3 lg:order-none lg:flex-col lg:gap-4" aria-label="Galeria">
          {nft.gallery.map((src, i) => (
            <li key={i}>
              <button type="button" onClick={() => setImage(i)} aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`} aria-current={image === i} className={cn('block overflow-hidden rounded-md border-2', image === i ? 'border-primary' : 'border-transparent')}>
              <img src={src.replace(/\.(webp|png|jpe?g)$/, '-thumb.$1')} alt="" width={100} height={100} className="size-16 object-cover lg:size-[100px]" />
              </button>
            </li>
          ))}
        </ul>
        <div className="bg-surface p-5">
          <img src={nft.gallery[image] ?? nft.image} alt={`Arte do NFT ${nft.name}`} width={445} height={445} fetchPriority="high" className="aspect-square w-full rounded-2xl object-cover" />
        </div>
        <div>
          <h1 className="text-2xl font-bold md:text-[28px]">{nft.name}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <p className="text-xl font-bold text-primary" aria-live="polite">{formatEth(selected.priceEth)}</p>
            <p className="flex items-center gap-1 text-sm">
              <span className="flex text-primary" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn('size-3.5', i < Math.round(nft.rating) && 'fill-primary')} />)}</span>
              <span>{nft.rating.toFixed(1)} · {nft.reviewCount} avaliações de colecionadores</span>
            </p>
          </div>
          <h2 className="mt-4 text-sm font-bold">Sobre este NFT:</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{nft.description}</p>

          <fieldset className="mt-4">
            <legend className="text-sm font-bold">Edição:</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {nft.editions.map((e) => {
                const soldOut = e.available === 0
                return (
                  <button
                    key={e.type} type="button" aria-pressed={edition === e.type} aria-disabled={soldOut}
                    onClick={() => { if (!soldOut) { setEdition(e.type); setQty(1) } }}
                    className={cn('rounded-full border px-3 py-1 text-xs', edition === e.type ? 'border-primary text-primary' : 'border-border', soldOut && 'cursor-not-allowed line-through opacity-50')}
                    title={soldOut ? 'Edição esgotada' : `${e.available} disponível(is)`}
                  >
                    {EDITION_LABEL[e.type]}{soldOut && <span className="sr-only"> (esgotada)</span>}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {selected.available === 0 ? 'Edição esgotada.' : `${selected.available} disponível(is) nesta edição${inCart ? ` · ${inCart} no seu carrinho` : ''}.`}
            </p>
          </fieldset>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <QuantityStepper value={quantity} max={Math.max(1, maxQty)} onChange={setQty} label="Quantidade" disabled={unavailable} />
            <div className="flex gap-2">
              <Button disabled={unavailable || add.isPending} onClick={() => buy(true)}>{unavailable ? 'Indisponível' : 'COMPRAR'}</Button>
              <Button variant="outline" disabled={unavailable || add.isPending} onClick={() => buy(false)}>Adicionar ao carrinho</Button>
              <FavoriteButton nftId={nft.id} name={nft.name} className="size-10 rounded-md border border-primary" />
            </div>
          </div>
          <dl className="mt-6 space-y-3 text-sm text-muted-foreground">
            <div><dt className="inline">ID do token: </dt><dd className="inline">{nft.tokenId}</dd></div>
            <div><dt className="inline">Coleção: </dt><dd className="inline">{nft.collection}</dd></div>
            <div><dt className="inline">Atributos: </dt><dd className="inline">{nft.attributes.join(', ')}</dd></div>
            <div><dt className="inline">Rede: </dt><dd className="inline">{NETWORK_LABEL[nft.network]}</dd></div>
          </dl>
        </div>
      </div>

      <section className="mt-16" aria-label="Informações adicionais">
        <div role="tablist" className="flex gap-8 border-b border-border">
          <button role="tab" type="button" aria-selected={tab === 'details'} onClick={() => setTab('details')} className={cn('border-b-2 pb-2', tab === 'details' ? 'border-primary font-bold text-primary' : 'border-transparent')}>Detalhes do NFT</button>
          <button role="tab" type="button" aria-selected={tab === 'reviews'} onClick={() => setTab('reviews')} className={cn('border-b-2 pb-2', tab === 'reviews' ? 'border-primary font-bold text-primary' : 'border-transparent')}>Avaliações de colecionadores ({nft.reviewCount})</button>
        </div>
        <div role="tabpanel" className="mt-4 max-w-[90ch] space-y-4 text-sm leading-relaxed text-muted-foreground">
          {tab === 'details' ? (
            <>
              <p>{nft.description} A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.</p>
              <p><strong className="text-foreground">Contrato:</strong><br />{shortHash(nft.contract)} · Contrato inteligente ERC-721 verificado.</p>
              <p><strong className="text-foreground">Direitos autorais:</strong><br />Criador recebe {nft.royaltyPct}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
            </>
          ) : (
            <p>As avaliações detalhadas não fazem parte desta demonstração. Nota média: {nft.rating.toFixed(1)} de 5.</p>
          )}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="more-title">
        <h2 id="more-title" className="border-b border-border pb-2 text-lg font-bold text-primary">Mais desta coleção</h2>
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
          {related.data?.items.filter((n) => n.id !== nft.id).slice(0, 5).map((n) => <NftCard key={n.id} nft={n} />)}
        </div>
      </section>
    </div>
  )
}
