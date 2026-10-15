import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { LoginForm, RegisterForm } from './auth-forms'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const search = useSearch({ strict: false }) as { redirect?: string; expired?: boolean }
  const navigate = useNavigate()
  const done = () => {
    const target = search.redirect && search.redirect.startsWith('/') && !search.redirect.startsWith('//') ? search.redirect : '/'
    void navigate({ to: target, replace: true })
  }
  return (
    <section className="container flex min-h-[70vh] items-center justify-center py-10" aria-labelledby="auth-title">
      <div className="w-full max-w-[400px]">
        <p className="mb-14 text-center text-3xl font-bold tracking-wider" aria-hidden="true">KURIO</p>
        <h1 id="auth-title" className="mb-8 text-center text-lg font-bold">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</h1>
        {search.expired && <p role="alert" className="mb-4 rounded-sm border border-primary/60 p-3 text-sm">Sua sessão expirou. Entre novamente para continuar de onde parou.</p>}
        {mode === 'login' ? <LoginForm onSuccess={done} /> : <RegisterForm onSuccess={done} />}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {mode === 'login'
            ? <>Novo na Kurio? <Link to="/cadastro" search={{ redirect: search.redirect }} className="text-primary underline">Crie uma conta</Link></>
            : <>Já tem uma conta? <Link to="/entrar" search={{ redirect: search.redirect }} className="text-primary underline">Entre</Link></>}
        </p>
      </div>
    </section>
  )
}
