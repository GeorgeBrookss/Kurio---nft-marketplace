import { LoginInput, RegisterInput } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { useLogin, useRegister } from '@/features/session/use-auth-actions'
import { useZodForm } from '@/lib/use-form'
import { toast } from 'sonner'

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return <p role="alert" className="rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>
}

function SocialButtons() {
  const note = (p: string) => toast.info(`Login com ${p} não está disponível nesta demonstração.`)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs"><span className="h-px flex-1 bg-border" />Ou continue com<span className="h-px flex-1 bg-border" /></div>
      <Button type="button" variant="ghost" className="w-full border border-border font-normal" onClick={() => note('Google')}>Continuar com Google</Button>
      <Button type="button" variant="ghost" className="w-full border border-border font-normal" onClick={() => note('Facebook')}>Continuar com Facebook</Button>
    </div>
  )
}

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useLogin()
  const f = useZodForm(LoginInput, { email: '', password: '' }, 'login')
  return (
    <form noValidate onSubmit={f.submit(async (data) => { await login.mutateAsync(data); toast.success('Você entrou na sua conta.'); onSuccess() })} className="space-y-4">
      <FormError message={f.formError} />
      <Field id="login-email" label={<span className="sr-only">E-mail</span>} error={f.errors.email}>
        {(a) => <Input {...a} {...f.bind('email')} type="email" autoComplete="email" placeholder="contato@email.com" />}
      </Field>
      <Field id="login-password" label={<span className="sr-only">Senha</span>} error={f.errors.password}>
        {(a) => <PasswordInput {...a} {...f.bind('password')} autoComplete="current-password" placeholder="Senha" />}
      </Field>
      <div className="text-right">
        <button type="button" className="text-sm text-primary hover:underline" onClick={() => toast.info('Recuperação de senha não faz parte desta demonstração.')}>Esqueceu a senha?</button>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={login.isPending} aria-busy={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
      <SocialButtons />
    </form>
  )
}

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const register = useRegister()
  const f = useZodForm(RegisterInput, { username: '', email: '', password: '', confirmPassword: '' }, 'register')
  return (
    <form noValidate onSubmit={f.submit(async (data) => { await register.mutateAsync(data); toast.success('Perfil de colecionador criado.'); onSuccess() })} className="space-y-4">
      <FormError message={f.formError} />
      <Field id="register-username" label={<span className="sr-only">Nome de usuário</span>} error={f.errors.username}>
        {(a) => <Input {...a} {...f.bind('username')} autoComplete="username" placeholder="Nome de usuário" />}
      </Field>
      <Field id="register-email" label={<span className="sr-only">E-mail</span>} error={f.errors.email}>
        {(a) => <Input {...a} {...f.bind('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" />}
      </Field>
      <Field id="register-password" label={<span className="sr-only">Senha</span>} error={f.errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
        {(a) => <PasswordInput {...a} {...f.bind('password')} autoComplete="new-password" placeholder="Senha" />}
      </Field>
      <Field id="register-confirmPassword" label={<span className="sr-only">Confirmar senha</span>} error={f.errors.confirmPassword}>
        {(a) => <PasswordInput {...a} {...f.bind('confirmPassword')} autoComplete="new-password" placeholder="Confirmar senha" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={register.isPending} aria-busy={register.isPending}>
        {register.isPending ? 'Criando…' : 'Criar conta'}
      </Button>
      <SocialButtons />
    </form>
  )
}
