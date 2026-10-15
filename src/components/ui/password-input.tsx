import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './input'

export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
  const [show, setShow] = React.useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className="pr-10" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-primary"
      >
        {show ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'
