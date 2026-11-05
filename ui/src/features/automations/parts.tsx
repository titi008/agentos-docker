'use client'

import { CircleAlert, Info, RotateCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/time'
import { cn } from '@/lib/utils'

type StatusTone = BadgeTone | 'muted'

const STATUSES: Record<string, { label: string; tone: StatusTone }> = {
  success: { label: 'Success', tone: 'ok' },
  completed: { label: 'Completed', tone: 'ok' },
  failed: { label: 'Failed', tone: 'bad' },
  running: { label: 'Running', tone: 'info' },
  paused: { label: 'Paused', tone: 'warn' },
  queued: { label: 'Queued', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'muted' }
}

/** Run and job status with a distinct label and tone for every state. */
export function StatusBadge({ status }: { status: string }) {
  const known = STATUSES[status.toLowerCase()]
  const label =
    known?.label ??
    (status
      ? status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ')
      : 'Unknown')
  const tone = known?.tone ?? 'neutral'
  if (tone === 'muted') {
    return (
      <Badge className="bg-transparent text-fg-3 ring-1 ring-line-strong ring-inset">
        <span
          aria-hidden
          className="size-1.5 rounded-full ring-[1.5px] ring-current ring-inset"
        />
        {label}
      </Badge>
    )
  }
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  )
}

/** "Showing 1–25 of 132" with Previous/Next. Renders nothing for an empty list. */
export function Pager({
  page,
  pageSize,
  total,
  onPageChange,
  label,
  className
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  label: string
  className?: string
}) {
  if (total <= 0) return null
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = Math.min(total, (page - 1) * pageSize + 1)
  const last = Math.min(total, page * pageSize)
  return (
    <nav
      aria-label={label}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 text-[13px] text-fg-3',
        className
      )}
    >
      <span aria-live="polite" className="tabular-nums">
        Showing {formatNumber(first)}–{formatNumber(last)} of{' '}
        {formatNumber(total)}
      </span>
      {pages > 1 ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </nav>
  )
}

/** Header Refresh action; spins only for refreshes the user asked for, not background polling. */
export function RefreshButton({
  onRefresh
}: {
  onRefresh: () => Promise<unknown>
}) {
  const [refreshing, setRefreshing] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={refreshing}
      onClick={async () => {
        setRefreshing(true)
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
        }
      }}
    >
      {refreshing ? null : <RotateCw />}
      Refresh
    </Button>
  )
}

const LONG_ERROR_CHARS = 280
const LONG_ERROR_LINES = 3

/** Monospace error message, collapsed to three lines when long. */
export function ErrorText({
  text,
  variant = 'box',
  className
}: {
  text: string
  /** `box` sits on a tinted background; `inline` is a table's second line. */
  variant?: 'box' | 'inline'
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const long =
    text.length > LONG_ERROR_CHARS || text.split('\n').length > LONG_ERROR_LINES
  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-2 font-mono text-xs leading-relaxed text-bad',
        variant === 'box' && 'rounded-lg bg-bad-soft px-2.5 py-2',
        className
      )}
    >
      {variant === 'inline' ? (
        <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      ) : null}
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p
          className={cn(
            'break-words whitespace-pre-wrap',
            long && !expanded && 'line-clamp-3'
          )}
        >
          <span className="sr-only">Error: </span>
          {text}
        </p>
        {long ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="font-sans font-medium underline-offset-2 hover:underline"
          >
            {expanded ? 'Show less' : 'Show full error'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Small callout under a card: `warn` for cost or system notices, `info` for context. */
export function Note({
  tone = 'info',
  children
}: {
  tone?: 'warn' | 'info'
  children: ReactNode
}) {
  const Icon = tone === 'warn' ? CircleAlert : Info
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg px-2.5 py-2 text-[12.5px]',
        tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-muted-soft text-fg-2'
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
