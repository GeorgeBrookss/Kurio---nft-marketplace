import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { Activity, Download, Heart, ImageIcon, LogOut, MapPin, Tag, TriangleAlert, User } from 'lucide-react'
import { toast } from 'sonner'
import {
  NETWORKS, NETWORK_LABEL, PasswordChangeInput, ProfileInput, WALLET_PROVIDERS, WALLET_PROVIDER_LABEL, WalletInput,
  type Wallet, type WalletSlot,
} from '@/api/contracts'
import { apiClient } from '@/api/endpoints'
import { qk, useFavorites, useProfile, useSaveWallet, useUpdateProfile, useWallets } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Field, NativeSelect } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Skeleton } from '@/components/ui/skeleton'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { useLogout } from '@/features/session/use-auth-actions'
import { cn } from '@/lib/utils'
import { useZodForm } from '@/lib/use-form'

export function ProfileLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const off = (label: string) => () => toast.info(`${label} não faz parte desta demonstração.`)
  const item = (active: boolean) => cn('flex w-full items-center gap-3 border-l-4 px-3 py-3 text-sm text-primary hover:bg-muted', active ? 'border-primary bg-muted/40' : 'border-transparent')
  return (
    <div className="container mt-8 grid gap-8 lg:grid-cols-[310px_1fr]">
      <nav aria-label="Meu perfil" className="h-fit bg-surface py-4">
        <h1 className="px-3 pb-2 text-lg font-bold">Meu perfil</h1>
        <ul>
          <li><Link to="/perfil" className={item(pathname === '/perfil')} aria-current={pathname === '/perfil' ? 'page' : undefined}><User className="size-4" aria-hidden="true" />Dados do perfil</Link></li>
          <li><Link to="/perfil/carteiras" className={item(pathname === '/perfil/carteiras')} aria-current={pathname === '/perfil/carteiras' ? 'page' : undefined}><MapPin className="size-4" aria-hidden="true" />Carteiras</Link></li>
          <li><button type="button" onClick={off('Atividade')} className={item(false)}><Activity className="size-4" aria-hidden="true" />Atividade</button></li>
          <li><Link to="/perfil/interesse" className={item(pathname === '/perfil/interesse')} aria-current={pathname === '/perfil/interesse' ? 'page' : undefined}><Heart className="size-4" aria-hidden="true" />Lista de interesse</Link></li>
          <li><button type="button" onClick={off('Ofertas')} className={item(false)}><Tag className="size-4" aria-hidden="true" />Ofertas</button></li>
          <li><button type="button" onClick={off('Arquivos baixados')} className={item(false)}><Download className="size-4" aria-hidden="true" />Arquivos baixados</button></li>
          <li><button type="button" onClick={off('Suporte')} className={item(false)}><TriangleAlert className="size-4" aria-hidden="true" />Suporte</button></li>
          <li className="mt-2 border-t border-border pt-2">
            <button type="button" className={item(false)} onClick={() => logout.mutate(undefined, { onSuccess: () => toast.success('Você saiu da conta.') })} disabled={logout.isPending}>
              <LogOut className="size-4" aria-hidden="true" /><strong>Sair</strong>
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0"><Outlet /></div>
    </div>
  )
}

function FormSkeleton() {
  return <div className="grid gap-6 md:grid-cols-2" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div>)}</div>
}

async function resizeImage(file: File, size = 160): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Imagem maior que 5 MB.')
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const s = Math.min(bmp.width, bmp.height)
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  return canvas.toDataURL('image/webp', 0.85)
}

export function ProfileDataPage() {
  const { data, isPending, isError, refetch } = useProfile()
  const update = useUpdateProfile()
  const f = useZodForm(ProfileInput, { displayName: '', username: '', email: '', ensName: '', walletNickname: '' }, 'profile')
  const loaded = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (data && loaded.current !== data.version) {
      loaded.current = data.version
      f.setValues({ displayName: data.displayName, username: data.username, email: data.email, ensName: data.ensName, walletNickname: data.walletNickname })
    }
  }, [data, f])

  const changeAvatar = async (avatarUrl: string | null) => {
    if (!data) return
    try {
      await update.mutateAsync({ ...f.values, avatarUrl })
      toast.success(avatarUrl ? 'Avatar atualizado.' : 'Avatar removido.')
    } catch (e) {
      toast.error('Não foi possível atualizar o avatar.', { description: (e as Error).message })
    }
  }

  if (isError) return <div role="alert"><p>Não foi possível carregar o perfil.</p><Button className="mt-3" onClick={() => refetch()}>Tentar novamente</Button></div>
  return (
    <div className="space-y-10">
      <section aria-labelledby="profile-title">
        <h2 id="profile-title" className="mb-6 font-bold">Perfil do colecionador</h2>
        {isPending ? <FormSkeleton /> : (
          <form noValidate onSubmit={f.submit(async (v) => { await update.mutateAsync(v); toast.success('Perfil salvo.') })} className="space-y-6">
            {f.formError && <p role="alert" className="text-sm text-destructive">{f.formError}</p>}
            <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
              <Field id="profile-displayName" label="Nome de exibição" required error={f.errors.displayName}>{(a) => <Input {...a} {...f.bind('displayName')} />}</Field>
              <Field id="profile-username" label="Nome de usuário" required error={f.errors.username}>{(a) => <Input {...a} {...f.bind('username')} autoComplete="username" />}</Field>
              <Field id="profile-email" label="E-mail" required error={f.errors.email}>{(a) => <Input {...a} {...f.bind('email')} type="email" autoComplete="email" />}</Field>
              <Field id="profile-ensName" label="Nome ENS" required error={f.errors.ensName}>
                {(a) => <div className="flex gap-2"><span className="grid h-10 place-items-center rounded-sm border border-input px-3 text-sm" aria-hidden="true">.eth</span><Input {...a} {...f.bind('ensName')} /></div>}
              </Field>
              <Field id="profile-walletNickname" label="Apelido da carteira" required error={f.errors.walletNickname}>{(a) => <Input {...a} {...f.bind('walletNickname')} />}</Field>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium" id="avatar-label">Avatar</span>
                <div className="flex items-center gap-4" role="group" aria-labelledby="avatar-label">
                  {data.avatarUrl
                    ? <img src={data.avatarUrl} alt="Seu avatar" width={50} height={50} className="size-[50px] rounded-full object-cover" />
                    : <span className="grid size-[50px] place-items-center rounded-full bg-surface text-primary"><ImageIcon className="size-5" aria-hidden="true" /><span className="sr-only">Sem avatar</span></span>}
                  <input ref={fileRef} type="file" accept="image/*" className="sr-only" id="avatar-file" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    try { await changeAvatar(await resizeImage(file)) } catch (err) { toast.error((err as Error).message) }
                  }} />
                  <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={update.isPending}>Alterar</Button>
                  {data.avatarUrl && <Button type="button" size="sm" variant="ghost" onClick={() => changeAvatar(null)} disabled={update.isPending}>Remover</Button>}
                </div>
                {f.errors.avatar && <p className="text-xs text-destructive" role="alert">{f.errors.avatar}</p>}
              </div>
            </div>
            <Button type="submit" disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar'}</Button>
          </form>
        )}
      </section>
      <PasswordForm />
    </div>
  )
}

function PasswordForm() {
  const [pending, setPending] = useState(false)
  const f = useZodForm(PasswordChangeInput, { currentPassword: '', newPassword: '', confirmPassword: '' }, 'password')
  return (
    <section aria-labelledby="password-title" className="max-w-[417px]">
      <h2 id="password-title" className="mb-6 font-bold">Alterar senha</h2>
      <form noValidate className="space-y-5" onSubmit={f.submit(async (v) => {
        setPending(true)
        try {
          await apiClient.profile.changePassword(v)
          f.setValues({ currentPassword: '', newPassword: '', confirmPassword: '' })
          toast.success('Senha alterada.')
        } finally { setPending(false) }
      })}>
        {f.formError && <p role="alert" className="text-sm text-destructive">{f.formError}</p>}
        <Field id="password-currentPassword" label="Senha atual" error={f.errors.currentPassword}>{(a) => <PasswordInput {...a} {...f.bind('currentPassword')} autoComplete="current-password" />}</Field>
        <Field id="password-newPassword" label="Nova senha" error={f.errors.newPassword} hint="Mínimo de 8 caracteres, com letras e números.">{(a) => <PasswordInput {...a} {...f.bind('newPassword')} autoComplete="new-password" />}</Field>
        <Field id="password-confirmPassword" label="Confirmar nova senha" error={f.errors.confirmPassword}>{(a) => <PasswordInput {...a} {...f.bind('confirmPassword')} autoComplete="new-password" />}</Field>
        <Button type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</Button>
      </form>
    </section>
  )
}

type WalletForm = Record<keyof Omit<Wallet, 'id' | 'slot' | 'version'>, string>
const emptyWallet: WalletForm = { displayName: '', nickname: '', network: '', profileName: '', address: '', ensOrSecondary: '', provider: '', referralCode: '', email: '', ensName: '' }
const toForm = (w: Wallet | null): WalletForm => (w ? { displayName: w.displayName, nickname: w.nickname, network: w.network, profileName: w.profileName, address: w.address, ensOrSecondary: w.ensOrSecondary ?? '', provider: w.provider, referralCode: w.referralCode, email: w.email, ensName: w.ensName } : emptyWallet)

function WalletEditor({ slot, wallet, copyFrom, onDone }: { slot: WalletSlot; wallet: Wallet | null; copyFrom?: Wallet | null; onDone: () => void }) {
  const save = useSaveWallet()
  const f = useZodForm(WalletInput, toForm(wallet), `wallet-${slot}`)
  const [same, setSame] = useState(false)
  const field = (k: keyof WalletForm, label: string, opts: { required?: boolean; placeholder?: string } = { required: true }) => (
    <Field id={`wallet-${slot}-${k}`} label={label} required={opts.required} error={f.errors[k]}>{(a) => <Input {...a} {...f.bind(k)} placeholder={opts.placeholder} />}</Field>
  )
  return (
    <form noValidate onSubmit={f.submit(async (v) => { await save.mutateAsync({ slot, input: v }); toast.success(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.'); onDone() })} className="space-y-6">
      {f.formError && <p role="alert" className="text-sm text-destructive">{f.formError}</p>}
      {copyFrom && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={same} onChange={(e) => { setSame(e.target.checked); if (e.target.checked) f.setValues({ ...toForm(copyFrom), address: '', nickname: 'Reserva' }) }} className="accent-[hsl(var(--primary))]" />
          Igual à carteira principal <span className="text-xs text-muted-foreground">(copia os dados; informe outro endereço)</span>
        </label>
      )}
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        {field('displayName', 'Nome de exibição')}
        {field('nickname', 'Apelido da carteira')}
        <Field id={`wallet-${slot}-network`} label="Rede" required error={f.errors.network}>
          {(a) => <NativeSelect {...a} {...f.bind('network')}><option value="">Selecione uma rede</option>{NETWORKS.map((n) => <option key={n} value={n}>{NETWORK_LABEL[n]}</option>)}</NativeSelect>}
        </Field>
        {field('profileName', 'Nome do perfil')}
        {field('address', 'Endereço da carteira', { required: true, placeholder: 'Endereço 0x da carteira' })}
        {field('ensOrSecondary', 'ENS ou carteira secundária (opcional)', { required: false })}
        <Field id={`wallet-${slot}-provider`} label="Tipo de carteira" required error={f.errors.provider}>
          {(a) => <NativeSelect {...a} {...f.bind('provider')}><option value="">Selecione uma carteira</option>{WALLET_PROVIDERS.map((p) => <option key={p} value={p}>{WALLET_PROVIDER_LABEL[p]}</option>)}</NativeSelect>}
        </Field>
        {field('referralCode', 'Código de indicação')}
        {field('email', 'E-mail')}
        {field('ensName', 'Nome ENS')}
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar carteira'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  )
}

function WalletSummary({ wallet }: { wallet: Wallet }) {
  return (
    <dl className="grid gap-2 rounded-md bg-surface p-4 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">Apelido</dt><dd>{wallet.nickname}</dd></div>
      <div><dt className="text-muted-foreground">Rede</dt><dd>{NETWORK_LABEL[wallet.network]}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Endereço</dt><dd className="break-all">{wallet.address}</dd></div>
      <div><dt className="text-muted-foreground">Tipo</dt><dd>{WALLET_PROVIDER_LABEL[wallet.provider]}</dd></div>
      <div><dt className="text-muted-foreground">ENS</dt><dd>{wallet.ensName}.eth</dd></div>
    </dl>
  )
}

export function WalletsPage() {
  const { data, isPending, isError, refetch } = useWallets()
  const [editing, setEditing] = useState<WalletSlot | null>(null)
  if (isError) return <div role="alert"><p>Não foi possível carregar as carteiras.</p><Button className="mt-3" onClick={() => refetch()}>Tentar novamente</Button></div>
  const section = (slot: WalletSlot, title: string, description: string) => {
    const wallet = data?.[slot] ?? null
    const isEditing = editing === slot || (slot === 'primary' && !isPending && !data?.primary)
    return (
      <section aria-labelledby={`${slot}-title`} className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={`${slot}-title`} className="font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {!isEditing && !isPending && (slot === 'primary' || data?.primary) && (
            <Button variant="link" onClick={() => setEditing(slot)}>{wallet ? 'Editar' : 'Adicionar'}</Button>
          )}
        </div>
        {isPending ? <FormSkeleton /> : isEditing ? (
          <WalletEditor key={`${slot}-${wallet?.version ?? 0}`} slot={slot} wallet={wallet} copyFrom={slot === 'secondary' ? data?.primary : undefined} onDone={() => setEditing(null)} />
        ) : wallet ? <WalletSummary wallet={wallet} /> : <p className="text-sm text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>}
      </section>
    )
  }
  return (
    <div className="space-y-12">
      {section('primary', 'Carteira principal', 'Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.')}
      {section('secondary', 'Carteira secundária', 'Use uma segunda carteira como reserva no pagamento.')}
    </div>
  )
}

export function FavoritesPage() {
  const { data, isPending } = useFavorites()
  const ids = data?.nftIds ?? []
  const nfts = useQueries({ queries: ids.map((id) => ({ queryKey: qk.nft(id), queryFn: ({ signal }: { signal: AbortSignal }) => apiClient.nfts.get(id, { signal }) })) })
  return (
    <section aria-labelledby="fav-title">
      <h2 id="fav-title" className="mb-6 font-bold">Lista de interesse</h2>
      {isPending ? <div className="grid grid-cols-2 gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <NftCardSkeleton key={i} />)}</div>
        : ids.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum favorito ainda. <Link to="/" hash="catalogo" className="text-primary underline">Explorar NFTs</Link></p>
        : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {nfts.map((q, i) => q.data
              ? <NftCard key={ids[i]} nft={{ ...q.data, soldOut: q.data.editions.every((e) => e.available === 0) }} />
              : <NftCardSkeleton key={ids[i]} />)}
          </div>
        )}
    </section>
  )
}
