'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { Button } from './button'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Footer actions, right-aligned. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Wrap the body and footer in a <form>; the footer submit button submits it. */
  onSubmit?: () => void
  children: ReactNode
  className?: string
}

const sizes = { sm: 'md:max-w-md', md: 'md:max-w-lg', lg: 'md:max-w-2xl' }

/**
 * Centred dialog on desktop, full-screen on phones. Escape, the close button
 * and the backdrop all close it; focus is trapped while open.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = 'md',
  onSubmit,
  children,
  className
}: ModalProps) {
  const body = (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        {children}
      </div>
      {footer ? (
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5 max-md:pb-5">
          {footer}
        </div>
      ) : null}
    </>
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex animate-pop-in flex-col bg-surface text-fg shadow-pop',
            'inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[88dvh] md:w-[calc(100%-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[14px] md:border md:border-line',
            sizes[size],
            className
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogPrimitive.Title className="text-[15px] font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-[13px] text-fg-3">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {typeof title === 'string' ? title : 'Dialog'}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {onSubmit ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
              }}
              noValidate
            >
              {body}
            </form>
          ) : (
            body
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: 'left' | 'right'
  /** Accessible title; visually hidden unless `showTitle`. */
  title: string
  showTitle?: boolean
  className?: string
  children: ReactNode
}

/** Slide-in panel for menus and lists on small screens. */
export function Sheet({
  open,
  onOpenChange,
  side = 'left',
  title,
  showTitle = false,
  className,
  children
}: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-[min(320px,88vw)] flex-col bg-panel text-fg shadow-pop',
            side === 'left'
              ? 'left-0 animate-slide-in-left border-r border-line'
              : 'right-0 animate-slide-in-right border-l border-line',
            className
          )}
        >
          <DialogPrimitive.Title
            className={showTitle ? 'px-4 pt-4 font-semibold' : 'sr-only'}
          >
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {title}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export const SheetClose = DialogPrimitive.Close
