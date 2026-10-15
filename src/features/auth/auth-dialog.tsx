import type React from 'react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { LoginForm, RegisterForm } from './auth-forms'

type Mode = 'login' | 'register'

export function AuthDialog({ open, onOpenChange, initial = 'login', trigger }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Mode; trigger?: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(initial)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="px-6 pb-10 pt-12 sm:px-20">
        <AuthSwitcher mode={mode} onMode={setMode} />
        <DialogTitle className="sr-only">{mode === 'login' ? 'Entrar' : 'Criar conta'}</DialogTitle>
        <DialogDescription className="mb-6 mt-6 text-center text-xs text-foreground">
          {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
        </DialogDescription>
        {mode === 'login' ? <LoginForm onSuccess={() => onOpenChange(false)} /> : <RegisterForm onSuccess={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

export function AuthSwitcher({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  const tab = (m: Mode, label: string) => (
    <button type="button" onClick={() => onMode(m)} aria-pressed={mode === m} className={cn('text-lg', mode === m ? 'font-bold text-primary' : 'text-foreground hover:text-primary')}>
      {label}
    </button>
  )
  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label="Modo de autenticação">
      {tab('login', 'Entrar')}
      <span aria-hidden="true" className="h-5 w-px bg-primary" />
      {tab('register', 'Criar conta')}
    </div>
  )
}
