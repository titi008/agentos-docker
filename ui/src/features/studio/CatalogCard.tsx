'use client'

import { MessageSquare, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { chatHref } from '@/components/shell/nav'
import { cn } from '@/lib/utils'

import { componentHref } from './lib'
import type { CatalogItem } from './types'

export function SourceBadge({ item }: { item: CatalogItem }) {
  if (item.source === 'code') return <Badge>Code</Badge>
  return (
    <Badge tone="accent">
      {item.version ? `Studio · v${item.version}` : 'Studio · draft'}
    </Badge>
  )
}

/** Square icon tile used on cards and detail headers. */
export function KindIcon({
  icon: Icon,
  size = 'md'
}: {
  icon: LucideIcon
  size?: 'md' | 'lg'
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-accent-soft text-accent',
        size === 'lg'
          ? 'size-11 rounded-[10px] [&_svg]:size-5'
          : 'size-8 rounded-lg [&_svg]:size-4'
      )}
    >
      <Icon />
    </span>
  )
}

interface CatalogCardProps {
  item: CatalogItem
  icon: LucideIcon
  selected?: boolean
  /** Chips under the description (model, tools, members, steps…). */
  meta?: ReactNode
  /** Opens the detail panel of a code-defined item. */
  onOpenDetails: () => void
  chatLabel?: string
}

/**
 * Card for an agent, team or workflow. Actions are always visible buttons:
 * code-defined items open the detail panel, Studio-managed ones go to their
 * page with the version history.
 */
export function CatalogCard({
  item,
  icon,
  selected = false,
  meta,
  onOpenDetails,
  chatLabel = 'Chat'
}: CatalogCardProps) {
  const chatDisabled = item.source === 'studio' && !item.version
  return (
    <article
      aria-label={item.name}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xl border bg-surface p-4 transition-colors',
        selected
          ? 'border-accent ring-1 ring-accent'
          : 'border-line hover:border-line-strong'
      )}
    >
      <div className="flex items-start gap-2.5">
        <KindIcon icon={icon} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-[15px] font-semibold">{item.name}</h2>
          <span className="truncate font-mono text-xs text-fg-3">
            {item.id}
          </span>
        </div>
        <SourceBadge item={item} />
      </div>
      <p
        className={cn(
          'line-clamp-2 min-h-10 text-[13.5px]',
          item.description ? 'text-fg-2' : 'text-fg-3'
        )}
      >
        {item.description || 'No description.'}
      </p>
      {meta ? <div className="flex flex-wrap gap-1.5">{meta}</div> : null}
      <div className="mt-auto flex flex-wrap justify-end gap-1.5 border-t border-line pt-3">
        {item.source === 'studio' ? (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={componentHref(item.id)}
              aria-label={`Details and versions of ${item.name}`}
            >
              Details and versions
            </Link>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDetails}
            aria-label={`Details of ${item.name}`}
            aria-expanded={selected}
          >
            Details
          </Button>
        )}
        {chatDisabled ? (
          <Button size="sm" disabled title="Publish a version to chat with it">
            <MessageSquare aria-hidden />
            {chatLabel}
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link
              href={chatHref(item.kind, item.id)}
              aria-label={`${chatLabel}: ${item.name}`}
            >
              <MessageSquare aria-hidden />
              {chatLabel}
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
