'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Top bar of a section: title and one-line purpose on the left, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  className
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-3 md:px-6',
        className
      )}
    >
      {/* A 16rem basis makes the actions wrap below the title on phones. */}
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">{title}</h1>
        {description ? (
          <p className="text-[13.5px] text-fg-3">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

export interface RouteTab {
  href: string
  label: ReactNode
  count?: number
}

/** Section tabs backed by routes; the active tab follows the URL. */
export function RouteTabs({
  tabs,
  'aria-label': ariaLabel,
  className
}: {
  tabs: RouteTab[]
  'aria-label': string
  className?: string
}) {
  const pathname = usePathname()
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-line px-2 md:px-4',
        className
      )}
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-2.5 py-3 font-medium whitespace-nowrap transition-colors',
              active
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-3 hover:text-fg'
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="text-xs text-fg-3 tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

/** Padded, width-limited content area of a page. */
export function PageBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex w-full max-w-[1240px] flex-col gap-5 p-4 md:px-8 md:pt-6 md:pb-10',
        className
      )}
      {...props}
    />
  )
}

/**
 * Scrolling content region below the page header and tabs. The app shell's
 * <main> does not scroll; each page scrolls inside PageScroll or SplitMain.
 */
export function PageScroll({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      {...props}
    />
  )
}

/**
 * Row holding a scrolling list (SplitMain) plus an optional DetailPanel.
 * Both columns fill the remaining height and scroll independently.
 */
export function SplitLayout({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex min-h-0 flex-1', className)} {...props} />
}

export function SplitMain({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto', className)}
      {...props}
    />
  )
}

export function SectionTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('text-[15px] font-semibold', className)} {...props} />
  )
}
