'use client'

import { MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useId, useState, type ReactNode } from 'react'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock, formatJson } from '@/components/ui/code'
import { KeyValueList } from '@/components/ui/data'
import { chatHref } from '@/components/shell/nav'
import { formatDate, formatDateTime } from '@/lib/time'

import { humanize } from './shared'
import type { Learning } from './types'

/** Record fields already shown in the card header and meta line. */
const IDENTITY_KEYS = new Set([
  'user_id',
  'agent_id',
  'team_id',
  'session_id',
  'namespace',
  'entity_id',
  'entity_type',
  'created_at',
  'updated_at',
  'archived_at'
])
const TITLE_KEYS = ['title', 'name', 'decision'] as const
const MAX_DEPTH = 3
const MAX_ITEMS = 20

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (isRecord(value) && Object.keys(value).length === 0)

export function learningTypeLabel(type: string): string {
  return humanize(type || 'learning')
}

export function learningTypeTone(type: string): BadgeTone {
  if (type.startsWith('user')) return 'accent'
  if (type.startsWith('entity')) return 'info'
  return 'neutral'
}

/** A short heading from the record, or null when it has none. */
function titleOf(
  learning: Learning
): { text: string; key: string | null } | null {
  const content = learning.content ?? {}
  for (const key of TITLE_KEYS) {
    const value = content[key]
    if (typeof value === 'string' && value.trim() && value.length <= 120) {
      return { text: value.trim(), key }
    }
  }
  if (learning.entity_id) return { text: learning.entity_id, key: null }
  return null
}

function FieldValue({
  value,
  depth
}: {
  value: unknown
  depth: number
}): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-fg-3">—</span>
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') {
    return <span className="break-words whitespace-pre-wrap">{value}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-fg-3">None</span>
    const shown = value.slice(0, MAX_ITEMS)
    const more = value.length - shown.length
    const simple = shown.every(
      (item) => !isRecord(item) && !Array.isArray(item)
    )
    return (
      <div className="flex flex-col gap-1.5">
        {simple ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {shown.map((item, index) => (
              <li key={index}>
                <FieldValue value={item} depth={depth + 1} />
              </li>
            ))}
          </ul>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {shown.map((item, index) => (
              <li
                key={index}
                className="rounded-lg border border-line bg-canvas px-2.5 py-2"
              >
                <FieldValue value={item} depth={depth + 1} />
              </li>
            ))}
          </ol>
        )}
        {more > 0 ? (
          <span className="text-xs text-fg-3">
            and {more.toLocaleString()} more in the JSON
          </span>
        ) : null}
      </div>
    )
  }
  if (isRecord(value)) {
    if (depth >= MAX_DEPTH) {
      return (
        <code className="font-mono text-xs break-all text-fg-2">
          {JSON.stringify(value)}
        </code>
      )
    }
    return <FieldList record={value} depth={depth + 1} />
  }
  return String(value)
}

function FieldList({
  record,
  depth,
  skip
}: {
  record: Record<string, unknown>
  depth: number
  skip?: Set<string>
}) {
  const entries = Object.entries(record).filter(
    ([key, value]) => !skip?.has(key) && !(depth === 0 && isEmpty(value))
  )
  if (entries.length === 0) {
    return <p className="text-[13px] text-fg-3">No details recorded.</p>
  }
  return (
    <KeyValueList
      className="gap-y-1.5 sm:grid-cols-[110px_minmax(0,1fr)]"
      items={entries.map(([key, value]) => ({
        label: humanize(key),
        value: <FieldValue value={value} depth={depth} />
      }))}
    />
  )
}

interface LearningCardProps {
  learning: Learning
  source: string | null
  deleting: boolean
  /** Called with the card heading, for the confirmation text. */
  onDelete: (heading: string) => void
}

/** One learned profile, entity or fact with its readable fields and raw JSON. */
export function LearningCard({
  learning,
  source,
  deleting,
  onDelete
}: LearningCardProps) {
  const headingId = useId()
  const [jsonOpen, setJsonOpen] = useState(false)
  const typeLabel = learningTypeLabel(learning.learning_type)
  const title = titleOf(learning)
  const skip = new Set(IDENTITY_KEYS)
  if (title?.key) skip.add(title.key)
  const content = learning.content ?? {}
  const entity =
    learning.entity_type || learning.entity_id
      ? [learning.entity_type, learning.entity_id].filter(Boolean).join('/')
      : null
  const chatKind = learning.agent_id
    ? 'agent'
    : learning.team_id
      ? 'team'
      : null
  const chatId = learning.agent_id ?? learning.team_id
  const heading = title?.text ?? typeLabel

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={learningTypeTone(learning.learning_type)}>
          {typeLabel}
        </Badge>
        <h2
          id={headingId}
          className={
            title
              ? 'min-w-0 flex-1 text-sm font-semibold break-words'
              : 'sr-only'
          }
        >
          {heading}
        </h2>
      </div>
      {entity ? (
        <p className="-mt-1 font-mono text-xs break-all text-fg-3">{entity}</p>
      ) : null}

      <FieldList record={content} depth={0} skip={skip} />

      {jsonOpen ? (
        <CodeBlock
          code={formatJson(content)}
          label="Raw content"
          maxHeight="20rem"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-3">
        {source ? (
          <>
            <span>{source}</span>
            <span aria-hidden>·</span>
          </>
        ) : null}
        {learning.namespace ? (
          <>
            <span>
              Namespace <span className="font-mono">{learning.namespace}</span>
            </span>
            <span aria-hidden>·</span>
          </>
        ) : null}
        <span
          title={
            learning.updated_at
              ? `Updated ${formatDateTime(learning.updated_at)}`
              : undefined
          }
        >
          Captured {formatDate(learning.created_at ?? learning.updated_at)}
        </span>
      </div>

      <div className="-mx-1.5 -mb-1.5 flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={jsonOpen}
          onClick={() => setJsonOpen((open) => !open)}
        >
          {jsonOpen ? 'Hide JSON' : 'View JSON'}
        </Button>
        {chatKind && chatId && learning.session_id ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={chatHref(chatKind, chatId, learning.session_id)}>
              <MessageSquare />
              Open chat
            </Link>
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="text-bad hover:bg-bad-soft hover:text-bad"
          aria-label={`Delete learned profile: ${heading}`}
          loading={deleting}
          onClick={() => onDelete(heading)}
        >
          Delete
        </Button>
      </div>
    </article>
  )
}
