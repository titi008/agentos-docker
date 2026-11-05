'use client'

import { CircleAlert, LoaderCircle, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

import { ApiError, getErrorMessage } from '@/api/client'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'

import { Button } from './button'

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden
      className={cn('size-4 animate-spin text-fg-3', className)}
    />
  )
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-hover', className)}
      {...props}
    />
  )
}

/** Placeholder rows while a list or table loads. */
export function LoadingRows({
  rows = 4,
  className,
  label = 'Loading'
}: {
  rows?: number
  className?: string
  label?: string
}) {
  return (
    <div role="status" className={cn('flex flex-col gap-2', className)}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-12 text-center',
        className
      )}
    >
      {icon ? <div className="text-fg-3 [&_svg]:size-6">{icon}</div> : null}
      <p className="font-medium text-fg">{title}</p>
      {description ? (
        <div className="max-w-md text-[13px] text-fg-3">{description}</div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

interface ErrorStateProps {
  /** What failed, e.g. "Couldn't load approvals". */
  title: string
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  className?: string
  compact?: boolean
}

/** Error with retry; visually distinct from an empty state. */
export function ErrorState({
  title,
  error,
  onRetry,
  retrying,
  className,
  compact = false
}: ErrorStateProps) {
  const endpoint = useStore((state) => state.selectedEndpoint)
  const showSettings =
    error instanceof ApiError && (error.isNetworkError || error.isAuthError)

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-xl border border-bad/40 bg-bad-soft text-left',
        compact ? 'items-center p-3' : 'items-start p-4',
        className
      )}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-bad" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium text-fg">{title}</p>
        <p className="text-[13px] break-words text-fg-2">
          {getErrorMessage(error, endpoint)}
        </p>
        {onRetry || showSettings ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {onRetry ? (
              <Button size="sm" onClick={onRetry} loading={retrying}>
                {retrying ? null : <RotateCcw />}
                Try again
              </Button>
            ) : null}
            {showSettings ? (
              <Button size="sm" variant="ghost" asChild>
                <Link href="/settings">Connection settings</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
