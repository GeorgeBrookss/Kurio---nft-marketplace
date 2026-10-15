import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { useFavorites, useToggleFavorite } from '@/api/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/session/session-store'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function FavoriteButton({ nftId, name, className }: { nftId: string; name: string; className?: string }) {
  const session = useSession()
  const { data } = useFavorites()
  const toggle = useToggleFavorite()
  const active = !!data?.nftIds.includes(nftId)
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remover ${name} da lista de interesse` : `Adicionar ${name} à lista de interesse`}
      className={cn('grid size-9 place-items-center rounded-full bg-background/80 text-primary hover:bg-background', className)}
      onClick={(e) => {
        e.preventDefault()
        if (!session) { toast.info('Entre para salvar favoritos.'); return }
        toggle.mutate({ nftId, favorite: !active })
      }}
    >
      <Heart className={cn('size-4', active && 'fill-primary')} aria-hidden="true" />
    </button>
  )
}

export function NftCard({ nft, priority = false }: { nft: NftSummary; priority?: boolean }) {
  return (
    <article className="group relative">
      <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block rounded-md focus-visible:outline-offset-4">
        <div className="relative aspect-[258/300] bg-surface p-[clamp(8px,1.5vw,20px)]">
          {nft.rare && <span className="absolute left-0 top-6 z-10 bg-primary px-4 py-1 text-sm font-bold text-primary-foreground">RARO</span>}
          <img
            src={nft.image}
            alt={`Arte do NFT ${nft.name}`}
            width={480}
            height={480}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className="size-full rounded-lg object-cover"
          />
          {nft.soldOut && <span className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-sm bg-background/90 px-3 py-1 text-xs font-bold">Esgotado</span>}
        </div>
        <h3 className="mt-3 truncate text-base">{nft.name}</h3>
      </Link>
      <p className="mt-1 text-lg font-bold text-primary">
        {formatEth(nft.priceEth)}
        {nft.compareAtEth && <s className="ml-3 font-normal text-muted-foreground"><span className="sr-only">de </span>{formatEth(nft.compareAtEth)}</s>}
      </p>
      <FavoriteButton nftId={nft.id} name={nft.name} className="absolute right-3 top-3 opacity-100 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100" />
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[258/300] w-full rounded-none" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-2 h-6 w-1/3" />
    </div>
  )
}
