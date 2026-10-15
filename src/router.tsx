import { lazy, Suspense } from 'react'
import { Outlet, createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, redirect, ScrollRestoration } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { z } from 'zod'
import { SORTS, TABS } from '@/api/contracts'
import { Footer, Header, MobileTabBar, MobileTopBar } from '@/components/layout/site-chrome'
import { NotFoundView } from '@/components/layout/not-found'
import { HomePage } from '@/features/catalog/home-page'
import { NftDetailPage } from '@/features/nft/nft-detail-page'
import { SessionWatcher } from '@/features/session/session-watcher'
import { sessionStore } from '@/features/session/session-store'
import { useRealtime } from '@/realtime/use-realtime'

const CartPage = lazyRouteComponent(() => import('@/features/cart/cart-page'), 'CartPage')
const CheckoutPage = lazyRouteComponent(() => import('@/features/checkout/checkout-page'), 'CheckoutPage')
const OrderPage = lazyRouteComponent(() => import('@/features/order/order-page'), 'OrderPage')
const AuthPage = lazyRouteComponent(() => import('@/features/auth/auth-page'), 'AuthPage')
const ProfileLayout = lazyRouteComponent(() => import('@/features/profile/profile-pages'), 'ProfileLayout')
const ProfileDataPage = lazyRouteComponent(() => import('@/features/profile/profile-pages'), 'ProfileDataPage')
const WalletsPage = lazyRouteComponent(() => import('@/features/profile/profile-pages'), 'WalletsPage')
const FavoritesPage = lazyRouteComponent(() => import('@/features/profile/profile-pages'), 'FavoritesPage')
const ScenarioPanel = lazy(() => import('@/features/dev/scenario-panel').then((m) => ({ default: m.ScenarioPanel })))

function RootLayout() {
  useRealtime()
  return (
    <>
      <SessionWatcher />
      <ScrollRestoration />
      <a href="#conteudo" className="sr-only-focusable fixed left-2 top-2 z-50 rounded bg-primary px-3 py-2 text-primary-foreground">Pular para o conteúdo</a>
      <Header />
      <MobileTopBar />
      <main id="conteudo" tabIndex={-1} className="pb-8 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
      {import.meta.env.VITE_ENABLE_MOCKS === 'true' && <div className="container pb-28 text-center md:pb-6"><Suspense fallback={null}><ScenarioPanel /></Suspense></div>}
      <Toaster theme="dark" position="top-right" richColors closeButton toastOptions={{ className: 'font-mono' }} />
    </>
  )
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: () => <NotFoundView />,
})

const requireAuth = ({ location }: { location: { href: string } }) => {
  if (!sessionStore.get()) throw redirect({ to: '/entrar', search: { redirect: location.href } })
}

const homeSearch = z.object({
  q: z.coerce.string().trim().max(80).optional().catch(undefined),
  category: z.coerce.string().optional().catch(undefined),
  network: z.coerce.string().optional().catch(undefined),
  minPrice: z.coerce.number().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  tab: z.enum(TABS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', validateSearch: homeSearch, component: HomePage })
const nftRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nft/$nftId', component: NftDetailPage })
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/carrinho', component: CartPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', beforeLoad: requireAuth, component: CheckoutPage })
const orderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pedido/$orderId', beforeLoad: requireAuth, component: OrderPage })

const authSearch = z.object({ redirect: z.string().optional().catch(undefined), expired: z.boolean().optional().catch(undefined) })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/entrar', validateSearch: authSearch, component: () => <AuthPage mode="login" /> })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cadastro', validateSearch: authSearch, component: () => <AuthPage mode="register" /> })

const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/perfil', beforeLoad: requireAuth, component: ProfileLayout })
const profileIndexRoute = createRoute({ getParentRoute: () => profileRoute, path: '/', component: ProfileDataPage })
const walletsRoute = createRoute({ getParentRoute: () => profileRoute, path: '/carteiras', component: WalletsPage })
const favoritesRoute = createRoute({ getParentRoute: () => profileRoute, path: '/interesse', component: FavoritesPage })

const routeTree = rootRoute.addChildren([
  indexRoute, nftRoute, cartRoute, checkoutRoute, orderRoute, loginRoute, registerRoute,
  profileRoute.addChildren([profileIndexRoute, walletsRoute, favoritesRoute]),
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' })
}

declare module '@tanstack/react-router' {
  interface Register { router: ReturnType<typeof createAppRouter> }
}
