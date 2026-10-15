import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

export function Field({
  id, label, error, required, hint, className, children,
}: {
  id: string
  label: React.ReactNode
  error?: string
  required?: boolean
  hint?: string
  className?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }) => React.ReactNode
}) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}

const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23D28A4C' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full appearance-none rounded-sm border border-input px-3 pr-9 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid=true]:border-destructive [&>option]:bg-surface',
        className,
      )}
      style={{ backgroundColor: 'transparent', backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px', ...props.style }}
      {...props}
    />
  )
}
