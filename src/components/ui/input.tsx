import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'
export { Input }
