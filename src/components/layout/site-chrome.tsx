import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Heart, Home, LogIn, Search, ShoppingCart, User, ScanLine, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/api/queries'
import { useSession } from '@/features/session/session-store'
import { AuthDialog } from '@/features/auth/auth-dialog'
import { useRealtimeStatus } from '@/realtime/use-realtime'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const unavailable = (what: string) => toast.info(`${what} não faz parte desta demonstração.`)

function CartButton() {
  const { data } = useCart()
  const count = data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0
  return (
    <Link to="/carrinho" className="relative rounded-md p-2 hover:bg-muted" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
      <ShoppingCart className="size-6" aria-hidden="true" />
      {count > 0 && (
        <span aria-hidden="true" className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  )
}

function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  return (
    <form
      role="search"
      className="flex items-center"
      onSubmit={(e) => {
        e.preventDefault()
        void navigate({ to: '/', search: { q: q.trim() || undefined }, hash: 'catalogo' })
        setOpen(false)
      }}
    >
      {open && (
        <input
          autoFocus
          aria-label="Buscar NFTs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder="Buscar NFTs…"
          className="h-9 w-44 rounded-sm border border-input bg-transparent px-2 text-sm"
        />
      )}
      <button type={open ? 'submit' : 'button'} onClick={() => !open && setOpen(true)} className="rounded-md p-2 hover:bg-muted" aria-label={open ? 'Buscar' : 'Abrir busca'}>
        <Search className="size-6" aria-hidden="true" />
      </button>
    </form>
  )
}

export function Header() {
  const session = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [authOpen, setAuthOpen] = useState(false)
  const market = pathname.startsWith('/nft') || pathname.startsWith('/carrinho') || pathname.startsWith('/checkout')
  const navCls = (active: boolean) => cn('border-b-2 pb-4 pt-1 text-sm transition-colors', active ? 'border-primary font-bold text-primary' : 'border-transparent hover:text-primary')
  return (
    <header className="container hidden md:block">
      <div className="flex h-[68px] items-center justify-between border-b border-border">
        <Link to="/" className="text-sm font-bold tracking-wide" aria-label="Kurio, página inicial">KURIO</Link>
        <nav aria-label="Principal" className="hidden h-full items-end gap-10 md:flex">
          <Link to="/" className={navCls(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>Início</Link>
          <Link to="/" hash="catalogo" className={navCls(market)}>Mercado</Link>
          <button type="button" className={navCls(false)} aria-disabled="true" onClick={() => unavailable('Criadores')}>Criadores</button>
          <button type="button" className={navCls(false)} aria-disabled="true" onClick={() => unavailable('Aprenda')}>Aprenda</button>
        </nav>
        <div className="flex items-center gap-1 sm:gap-3">
          <div className="hidden sm:block"><HeaderSearch /></div>
          <CartButton />
          {session ? (
            <Button asChild size="sm" variant="outline" className="ml-1">
              <Link to="/perfil"><User aria-hidden="true" /> <span className="max-w-[10ch] truncate">{session.user.username}</span></Link>
            </Button>
          ) : (
            <AuthDialog open={authOpen} onOpenChange={setAuthOpen} trigger={<Button size="sm" className="ml-1"><LogIn aria-hidden="true" /> Entrar</Button>} />
          )}
        </div>
      </div>
    </header>
  )
}

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const item = (active: boolean) => cn('grid size-11 place-items-center rounded-md', active ? 'text-primary' : 'text-muted-foreground')
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="relative mx-auto flex max-w-md items-center justify-around px-4 py-2">
        <Link to="/" className={item(pathname === '/')} aria-label="Início"><Home aria-hidden="true" /></Link>
        <Link to="/perfil/interesse" className={item(pathname === '/perfil/interesse')} aria-label="Lista de interesse"><Heart aria-hidden="true" /></Link>
        <Link to="/" hash="catalogo" className="-mt-8 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg" aria-label="Explorar coleções"><ScanLine aria-hidden="true" /></Link>
        <Link to="/carrinho" className={item(pathname === '/carrinho')} aria-label="Carrinho"><ShoppingCart aria-hidden="true" /></Link>
        <Link to="/perfil" className={item(pathname.startsWith('/perfil') && pathname !== '/perfil/interesse')} aria-label="Perfil"><User aria-hidden="true" /></Link>
      </div>
    </nav>
  )
}

export function Footer() {
  const status = useRealtimeStatus()
  const out = (label: string) => (
    <li key={label}><button type="button" className="text-left text-sm hover:text-primary" onClick={() => unavailable(label)}>{label}</button></li>
  )
  return (
    <footer className="container mt-24 pb-4">
      <div className="grid gap-8 bg-surface p-8 md:grid-cols-4">
        {[
          ['W', 'Segurança da carteira', 'Proteja sua carteira e colecione arte digital verificada com confiança.'],
          ['C', 'Criadores em destaque', 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.'],
          ['D', 'Alertas de lançamentos', 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.'],
        ].map(([l, t, d]) => (
          <div key={t} className="md:border-r md:border-primary md:pr-6">
            <span aria-hidden="true" className="grid size-[74px] place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">{l}</span>
            <h2 className="mt-4 font-bold">{t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
          </div>
        ))}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => { e.preventDefault(); unavailable('A inscrição em alertas') }}
          aria-labelledby="newsletter-title"
        >
          <h2 id="newsletter-title" className="font-bold">Antecipe-se ao próximo lançamento</h2>
          <div className="flex">
            <label htmlFor="newsletter-email" className="sr-only">E-mail</label>
            <input id="newsletter-email" type="email" required placeholder="digite seu e-mail..." className="h-10 min-w-0 flex-1 rounded-l-sm bg-band px-3 text-sm placeholder:text-muted-foreground" />
            <Button type="submit" className="rounded-l-none">Enviar</Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
        </form>
      </div>
      <div className="grid gap-2 bg-band px-8 py-6 text-sm sm:grid-cols-4 sm:items-center">
        <span className="font-bold">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <a href="mailto:contato@email.com" className="hover:text-primary">contato@email.com</a>
        <a href="tel:+551140028922" className="hover:text-primary">+55 11 4002 8922</a>
      </div>
      <div className="grid gap-8 bg-surface px-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="mb-3 text-lg font-bold">Meu perfil</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to="/perfil" className="hover:text-primary">Meu perfil</Link></li>
            <li><Link to="/perfil/interesse" className="hover:text-primary">Lista de interesse</Link></li>
            <li><Link to="/perfil/carteiras" className="hover:text-primary">Carteiras</Link></li>
            {out('Atividade')}
            {out('Estúdio do criador')}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold">Central de ajuda</h2>
          <ul className="space-y-2">{['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map(out)}</ul>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold">Coleções</h2>
          <ul className="space-y-2 text-sm">
            {[['arte-digital', 'Arte digital'], ['fotografia', 'Fotografia'], ['musica', 'Música'], ['arte-3d', 'Arte 3D'], ['utilidade', 'Utilidade']].map(([k, l]) => (
              <li key={k}><Link to="/" search={{ category: k }} hash="catalogo" className="hover:text-primary">{l}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold">Redes sociais</h2>
          <ul className="flex gap-2">
            {[[Facebook, 'Facebook'], [Instagram, 'Instagram'], [Twitter, 'X (Twitter)'], [Linkedin, 'LinkedIn'], [Youtube, 'YouTube']].map(([Icon, label]) => {
              const I = Icon as typeof Facebook
              return (
                <li key={label as string}>
                  <button type="button" onClick={() => unavailable(`O perfil no ${label as string}`)} aria-label={label as string} className="grid size-8 place-items-center rounded-sm border border-primary text-primary hover:bg-primary/10">
                    <I className="size-4" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
          <h2 className="mb-2 mt-6 text-lg font-bold">Carteiras compatíveis</h2>
          <p className="inline-block rounded-sm border border-primary/60 bg-band px-2 py-1 text-[10px] font-bold text-primary">METAMASK • WALLETCONNECT • COINBASE</p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs">
        © 2026 Kurio. Propriedade digital para todos.{' '}
        <span className="sr-only" aria-live="polite">Tempo real: {status === 'online' ? 'conectado' : status === 'connecting' ? 'conectando' : 'desconectado'}</span>
        <span aria-hidden="true" title={`Tempo real: ${status}`} className={cn('ml-2 inline-block size-2 rounded-full align-middle', status === 'online' ? 'bg-success' : status === 'connecting' ? 'bg-primary' : 'bg-destructive')} />
      </p>
    </footer>
  )
}

const MOBILE_TITLES: Array<[RegExp, string]> = [
  [/^\/carrinho/, 'Carrinho de NFTs'], [/^\/checkout/, 'Pagamento com carteira'], [/^\/perfil/, 'Meu perfil'],
  [/^\/pedido/, 'Pedido'], [/^\/nft\//, ''], [/^\/(entrar|cadastro)/, ''],
]

export function MobileTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const match = MOBILE_TITLES.find(([re]) => re.test(pathname))
  if (pathname === '/' || !match) return null
  return (
    <div className="container flex h-14 items-center gap-3 md:hidden">
      <button type="button" onClick={() => history.back()} aria-label="Voltar" className="grid size-9 place-items-center rounded-full bg-surface text-primary">
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      {match[1] && <p className="flex-1 text-center text-lg font-bold" aria-hidden="true">{match[1]}</p>}
      {match[1] && <span className="size-9" aria-hidden="true" />}
    </div>
  )
}
