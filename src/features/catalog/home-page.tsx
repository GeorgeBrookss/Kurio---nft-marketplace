import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  CATEGORIES, CATEGORY_LABEL, NETWORKS, NETWORK_LABEL, SORTS, SORT_LABEL, TABS, TAB_LABEL,
  type CatalogFacets, type CatalogSearch, type Category, type Network,
} from '@/api/contracts'
import { ApiError } from '@/api/http'
import { useCatalog } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { NftCard, NftCardSkeleton } from './nft-card'

export type HomeSearch = {
  q?: string; category?: string; network?: string; minPrice?: number; maxPrice?: number
  sort?: CatalogSearch['sort']; tab?: CatalogSearch['tab']; page?: number
}

export function toCatalogSearch(s: HomeSearch): CatalogSearch {
  const pick = <T extends string>(raw: string | undefined, allowed: readonly T[]) =>
    raw ? (raw.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v))) : undefined
  return { ...s, category: pick<Category>(s.category, CATEGORIES), network: pick<Network>(s.network, NETWORKS) }
}

function useCatalogUrl() {
  const raw = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const search = toCatalogSearch(raw)
  const update = (patch: Partial<HomeSearch>, opts: { replace?: boolean; keepPage?: boolean } = {}) =>
    navigate({
      search: (prev) => {
        const next: HomeSearch = { ...prev, ...patch }
        if (!opts.keepPage) delete next.page
        for (const k of Object.keys(next) as Array<keyof HomeSearch>) if (next[k] === '' || next[k] === undefined) delete next[k]
        return next
      },
      replace: opts.replace,
      resetScroll: false,
    })
  return { raw, search, update }
}

function toggleCsv(current: string | undefined, value: string) {
  const set = new Set(current ? current.split(',') : [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].sort().join(',') : undefined
}

function Filters({ facets }: { facets?: CatalogFacets }) {
  const { raw, search, update } = useCatalogUrl()
  const [min, setMin] = useState(String(raw.minPrice ?? '0.02'))
  const [max, setMax] = useState(String(raw.maxPrice ?? '12.30'))
  useEffect(() => { setMin(String(raw.minPrice ?? '0.02')); setMax(String(raw.maxPrice ?? '12.30')) }, [raw.minPrice, raw.maxPrice])
  const id = useId()
  const optionCls = (active: boolean) => cn('flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-muted', active ? 'font-bold text-primary' : 'text-muted-foreground')
  return (
    <div className="space-y-8 bg-surface p-5">
      <section aria-labelledby={`${id}-col`}>
        <h2 id={`${id}-col`} className="mb-3 text-lg font-bold">Coleções</h2>
        <ul className="space-y-1">
          {CATEGORIES.map((c) => {
            const active = !!search.category?.includes(c)
            return (
              <li key={c}>
                <button type="button" aria-pressed={active} className={optionCls(active)} onClick={() => update({ category: toggleCsv(raw.category, c) })}>
                  <span>{active && <span aria-hidden="true">✓ </span>}{CATEGORY_LABEL[c]}</span>
                  <span aria-label={`${facets?.categories[c] ?? 0} itens`}>({facets?.categories[c] ?? '–'})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <section aria-labelledby={`${id}-price`}>
        <h2 id={`${id}-price`} className="mb-3 text-lg font-bold">Faixa de preço</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            const a = Number(min), b = Number(max)
            if (Number.isNaN(a) || Number.isNaN(b) || a > b) { toast.error('Faixa de preço inválida.'); return }
            update({ minPrice: a, maxPrice: b })
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Mínimo (ETH)
              <input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className="mt-1 h-9 w-full rounded-sm border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="text-xs">Máximo (ETH)
              <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className="mt-1 h-9 w-full rounded-sm border border-input bg-transparent px-2 text-sm" />
            </label>
          </div>
          <p className="text-sm">Preço: {min || '0'} - {max || '∞'} ETH</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm">Aplicar</Button>
            {(raw.minPrice !== undefined || raw.maxPrice !== undefined) && (
              <Button type="button" size="sm" variant="ghost" onClick={() => update({ minPrice: undefined, maxPrice: undefined })}>Limpar</Button>
            )}
          </div>
        </form>
      </section>
      <section aria-labelledby={`${id}-net`}>
        <h2 id={`${id}-net`} className="mb-3 text-lg font-bold">Rede</h2>
        <ul className="space-y-1">
          {NETWORKS.map((n) => {
            const active = !!search.network?.includes(n)
            return (
              <li key={n}>
                <button type="button" aria-pressed={active} className={optionCls(active)} onClick={() => update({ network: toggleCsv(raw.network, n) })}>
                  <span>{active && <span aria-hidden="true">✓ </span>}{NETWORK_LABEL[n]}</span>
                  <span>({facets?.networks[n] ?? '–'})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function SearchBox() {
  const { raw, update } = useCatalogUrl()
  const [value, setValue] = useState(raw.q ?? '')
  useEffect(() => setValue(raw.q ?? ''), [raw.q])
  useEffect(() => {
    if ((raw.q ?? '') === value.trim()) return
    const t = setTimeout(() => update({ q: value.trim() || undefined }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <label htmlFor="catalog-search" className="sr-only">Explorar coleções</label>
      <input
        id="catalog-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Explorar coleções"
        className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm"
      />
    </div>
  )
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const { update } = useCatalogUrl()
  if (totalPages <= 1) return null
  const go = (p: number) => { void update({ page: p === 1 ? undefined : p }, { keepPage: true }); document.getElementById('catalogo')?.scrollIntoView() }
  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-end gap-2">
      <Button variant="surface" size="icon-sm" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Página anterior"><ChevronLeft /></Button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <Button key={p} size="icon-sm" variant={p === page ? 'default' : 'surface'} aria-current={p === page ? 'page' : undefined} onClick={() => go(p)} aria-label={`Página ${p}`}>{p}</Button>
      ))}
      <Button variant="surface" size="icon-sm" disabled={page >= totalPages} onClick={() => go(page + 1)} aria-label="Próxima página"><ChevronRight /></Button>
    </nav>
  )
}

function Catalog() {
  const { raw, search, update } = useCatalogUrl()
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useCatalog(search)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const tab = search.tab ?? 'all'
  const activeFilters = [raw.q, raw.category, raw.network, raw.minPrice, raw.maxPrice].some((v) => v !== undefined)

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="container mt-16 scroll-mt-4">
      <h2 id="catalog-title" className="sr-only">Catálogo de NFTs</h2>
      <div className="grid gap-8 lg:grid-cols-[310px_1fr]">
        <aside className="hidden lg:block" aria-label="Filtros"><Filters facets={data?.facets} /></aside>
        <div className="min-w-0">
          <div className="mb-4 lg:hidden"><SearchBox /></div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border">
            <div role="tablist" aria-label="Seções do catálogo" className="flex gap-4 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t} role="tab" aria-selected={tab === t} type="button"
                  className={cn('whitespace-nowrap border-b-2 pb-2 text-sm', tab === t ? 'border-primary text-primary' : 'border-transparent hover:text-primary')}
                  onClick={() => update({ tab: t === 'all' ? undefined : t })}
                >{TAB_LABEL[t]}</button>
              ))}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 pb-2">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal /> Filtros</Button>
              <label htmlFor="catalog-sort" className="sr-only text-sm sm:not-sr-only">Ordenar por:</label>
              <select id="catalog-sort" value={search.sort ?? 'recent'} onChange={(e) => update({ sort: e.target.value === 'recent' ? undefined : (e.target.value as HomeSearch['sort']) })} className="h-8 max-w-[13rem] rounded-sm bg-transparent text-sm [&>option]:bg-surface">
                {SORTS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          <div className="hidden pt-4 lg:block"><SearchBox /></div>

          {activeFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              {data && <span>{data.total} resultado(s)</span>}
              <Button variant="link" size="sm" onClick={() => update({ q: undefined, category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined })}><X /> Limpar filtros</Button>
            </div>
          )}
          <p aria-live="polite" className="sr-only">{isFetching ? 'Atualizando resultados…' : data ? `${data.total} NFTs encontrados` : ''}</p>

          {isPending ? (
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-8" aria-busy="true" aria-label="Carregando catálogo">
              {Array.from({ length: 9 }, (_, i) => <NftCardSkeleton key={i} />)}
            </div>
          ) : isError ? (
            <div role="alert" className="mt-10 rounded-md border border-destructive/50 p-8 text-center">
              <p className="font-bold">Não foi possível carregar o catálogo.</p>
              <p className="mt-2 text-sm text-muted-foreground">{(error as ApiError).message}</p>
              <Button className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
          ) : data.items.length === 0 ? (
            <div className="mt-10 rounded-md bg-surface p-8 text-center">
              <p className="font-bold">Nenhum NFT encontrado.</p>
              <p className="mt-2 text-sm text-muted-foreground">Ajuste a busca ou remova filtros para ver mais obras.</p>
              {activeFilters && <Button className="mt-4" onClick={() => update({ q: undefined, category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined })}>Limpar filtros</Button>}
            </div>
          ) : (
            <div className={cn('mt-6 grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity md:grid-cols-3 md:gap-x-8', isPlaceholderData && 'opacity-60')} aria-busy={isFetching}>
              {data.items.map((n, i) => <NftCard key={n.id} nft={n} priority={i < 3} />)}
            </div>
          )}
          {data && !isError && <Pagination page={data.page} totalPages={data.totalPages} />}
        </div>
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent side="left" aria-describedby={undefined}>
          <DialogTitle className="mb-4">Filtros</DialogTitle>
          <Filters facets={data?.facets} />
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Hero() {
  return (
    <section className="container mt-4 md:mt-3" aria-labelledby="hero-title">
      <div className="grid items-center gap-8 overflow-hidden rounded-2xl bg-surface p-5 md:grid-cols-[1fr_450px] md:rounded-none md:bg-transparent md:p-0">
        <div className="md:pl-12">
          <p className="text-xs md:text-sm">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="mt-3 text-2xl font-bold leading-snug md:text-[42px] md:leading-[1.65]">SEJA DONO DO FUTURO<br />DA ARTE DIGITAL</h1>
          <p className="mt-4 max-w-[60ch] text-xs leading-relaxed text-muted-foreground md:text-sm">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <Button asChild className="mt-8 px-7"><Link to="/" hash="catalogo">EXPLORAR</Link></Button>
        </div>
        <img src="/nfts/emerald.png" alt="Emerald Ape #042, destaque da coleção Kurio Apes" width={450} height={450} fetchPriority="high" className="hidden aspect-square w-full rounded-2xl object-cover md:block" />
      </div>
    </section>
  )
}

export function HomePage() {
  return (
    <>
      <Hero />
      <Catalog />
    </>
  )
}

export function HomePendingSkeleton() {
  return <div className="container mt-8"><Skeleton className="h-[420px] w-full" /></div>
}
