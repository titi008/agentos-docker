'use client'

import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { PageHeader, RouteTabs } from '@/components/ui/page'
import { SECTIONS } from '@/components/shell/nav'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'

/** Knowledge page header and section tabs, shared by every tab. */
export function KnowledgeHeader({ actions }: { actions?: ReactNode }) {
  return (
    <>
      <PageHeader
        title={SECTIONS.knowledge.title}
        description={SECTIONS.knowledge.description}
        actions={actions}
      />
      <RouteTabs
        tabs={SECTIONS.knowledge.tabs}
        aria-label="Knowledge sections"
      />
    </>
  )
}

/** Header Refresh button; shows progress only for refreshes it started. */
export function RefreshButton({
  onRefresh
}: {
  onRefresh: () => Promise<unknown>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await onRefresh()
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? null : <RotateCw />}
      {busy ? 'Refreshing…' : 'Refresh'}
    </Button>
  )
}

/** States whose user the list shows; the user id is set in Settings. */
export function UserScopeBar({ noun, help }: { noun: string; help: string }) {
  const userId = useStore((state) => state.userId)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface py-2.5 pr-3 pl-3.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-hover text-[13px] font-semibold text-fg uppercase"
      >
        {userId.charAt(0) || '?'}
      </span>
      <div className="flex min-w-[200px] flex-1 flex-col">
        <p className="text-[13.5px] text-fg">
          Showing {noun} for user{' '}
          <strong className="font-semibold break-all">{userId}</strong>
        </p>
        <p className="text-xs text-fg-3">{help}</p>
      </div>
      <Button size="sm" asChild>
        <Link href="/settings">Change user</Link>
      </Button>
    </div>
  )
}

/** Previous / next pager for server-paginated lists. Hidden for one page. */
export function Pager({
  page,
  totalPages,
  onPageChange,
  disabled,
  className
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
  className?: string
}) {
  if (totalPages <= 1) return null
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className
      )}
    >
      <span className="text-[13px] text-fg-3 tabular-nums">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}

/** Toggle chip for single-choice filters such as memory topics. */
export function FilterChip({
  pressed,
  onClick,
  children
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors max-md:min-h-9',
        pressed
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-line-strong text-fg-2 hover:bg-hover hover:text-fg'
      )}
    >
      {children}
    </button>
  )
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Marks case-insensitive occurrences of `query` in `text`. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim()
  if (!needle) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'))
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded-[3px] bg-accent-soft px-0.5 text-accent"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

/** `user_profile` → `User profile`. */
export function humanize(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : value
}

export const pluralize = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`

/** Shortens `text` to `limit` characters on one line, ending in an ellipsis. */
export function clip(text: string, limit: number): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > limit ? `${line.slice(0, limit - 1).trimEnd()}…` : line
}
