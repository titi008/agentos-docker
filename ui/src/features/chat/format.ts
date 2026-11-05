import dayjs from 'dayjs'

import { toDate, type TimeValue } from '@/lib/time'
import type { SessionEntry } from '@/types/os'

export type ChatGroup = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older'

const GROUP_ORDER: ChatGroup[] = [
  'Today',
  'Yesterday',
  'Previous 7 days',
  'Older'
]

function groupOf(value: TimeValue, now: dayjs.Dayjs): ChatGroup {
  const date = toDate(value)
  if (!date) return 'Older'
  const day = dayjs(date).startOf('day')
  const today = now.startOf('day')
  const days = today.diff(day, 'day')
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Previous 7 days'
  return 'Older'
}

/** Chats grouped by creation day, keeping the server's newest-first order. */
export function groupChats(
  sessions: SessionEntry[],
  now = dayjs()
): { label: ChatGroup; items: SessionEntry[] }[] {
  const groups = new Map<ChatGroup, SessionEntry[]>()
  for (const session of sessions) {
    const label = groupOf(session.created_at, now)
    const items = groups.get(label) ?? []
    items.push(session)
    groups.set(label, items)
  }
  return GROUP_ORDER.filter((label) => groups.has(label)).map((label) => ({
    label,
    items: groups.get(label) ?? []
  }))
}

/** Time label of a chat in its group: a time, a weekday or a date. */
export function chatTimeLabel(value: TimeValue, group: ChatGroup): string {
  const date = toDate(value)
  if (!date) return ''
  const d = dayjs(date)
  if (group === 'Today' || group === 'Yesterday') return d.format('h:mm A')
  if (group === 'Previous 7 days') return d.format('ddd')
  return d.isSame(dayjs(), 'year') ? d.format('MMM D') : d.format('MMM D, YYYY')
}

/** Message timestamp: the time today, otherwise the date and time. */
export function messageTimeLabel(value: TimeValue): string {
  const date = toDate(value)
  if (!date) return ''
  const d = dayjs(date)
  if (d.isSame(dayjs(), 'day')) return d.format('h:mm A')
  return d.isSame(dayjs(), 'year')
    ? d.format('MMM D, h:mm A')
    : d.format('MMM D, YYYY, h:mm A')
}

export function chatTitle(session: Pick<SessionEntry, 'session_name'>): string {
  return session.session_name?.trim() || 'Untitled chat'
}

function summarizeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    const text = value.replace(/\s+/g, ' ').trim()
    return /[\s,]/.test(text) ? `“${text}”` : text
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.length
      ? `${value.length} item${value.length === 1 ? '' : 's'}`
      : null
  }
  return '{…}'
}

/** One-line hint of a tool call's arguments, e.g. `“Client Portal positioning”`. */
export function argumentSummary(
  args: Record<string, unknown> | null
): string | null {
  if (!args) return null
  for (const value of Object.values(args)) {
    const summary = summarizeValue(value)
    if (summary)
      return summary.length > 90 ? `${summary.slice(0, 89)}…` : summary
  }
  return null
}

export function formatTokens(count: number): string {
  return `${count.toLocaleString()} token${count === 1 ? '' : 's'}`
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
