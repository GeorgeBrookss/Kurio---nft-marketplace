import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close
const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0', className)} {...props} />
))
DialogOverlay.displayName = 'DialogOverlay'

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'center' | 'left' }
>(({ className, children, side = 'center', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-surface text-foreground shadow-2xl focus-visible:outline-none',
        side === 'center' && 'left-1/2 top-1/2 max-h-[100dvh] w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-b-[6px] border-primary data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 max-sm:h-[100dvh] max-sm:max-w-none max-sm:border-b-0',
        side === 'left' && 'inset-y-0 left-0 h-full w-[85vw] max-w-sm overflow-y-auto p-5 data-[state=open]:animate-in data-[state=open]:slide-in-from-left',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1 text-primary hover:bg-muted" aria-label="Fechar">
        <X className="size-5" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = 'DialogContent'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn('text-lg font-bold', className)} {...props} />)
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />)
DialogDescription.displayName = 'DialogDescription'

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription }
