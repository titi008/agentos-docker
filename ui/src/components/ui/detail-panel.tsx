'use client'

import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { Button } from './button'

interface DetailPanelProps {
  title: ReactNode
  /** Small line under the title (status, type…). */
  subtitle?: ReactNode
  /** Label for the back button on phones, e.g. "All approvals". */
  backLabel: string
  onClose: () => void
  /** Header actions next to the close button. */
  actions?: ReactNode
  /** Sticky footer with the primary actions. */
  footer?: ReactNode
  className?: string
  children: ReactNode
  'aria-label'?: string
}

/**
 * Detail column for a selected item. On desktop it sits beside the list
 * (put it in a flex row after the list); on phones it opens full-screen with
 * a back button. Escape closes it.
 */
export function DetailPanel({
  title,
  subtitle,
  backLabel,
  onClose,
  actions,
  footer,
  className,
  children,
  ...props
}: DetailPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    // Move focus to the panel on phones, where it covers the list.
    if (window.matchMedia('(max-width: 767px)').matches) {
      headingRef.current?.focus()
    }
  }, [])

  return (
    <aside
      aria-label={props['aria-label']}
      className={cn(
        'flex flex-col bg-surface',
        'max-md:fixed max-md:inset-0 max-md:z-40 max-md:animate-slide-in-right',
        'md:min-h-0 md:w-[440px] md:shrink-0 md:border-l md:border-line xl:w-[480px]',
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-2 py-2 md:hidden">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ChevronLeft />
          {backLabel}
        </Button>
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-base font-semibold break-words outline-none"
            >
              {title}
            </h2>
            {subtitle ? (
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-3">
                {subtitle}
              </div>
            ) : null}
          </div>
          <div className="hidden items-center gap-1 md:flex">
            {actions}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-5 px-5 pb-6">{children}</div>
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-line bg-surface px-5 py-3 max-md:pb-5">
          {footer}
        </div>
      ) : null}
    </aside>
  )
}
