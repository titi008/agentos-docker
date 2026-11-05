import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export type TimeValue = string | number | Date | null | undefined

/**
 * Parses AgentOS timestamps. Numbers below 1e12 are unix seconds (most
 * AgentOS records), larger numbers are milliseconds; strings are ISO dates.
 */
export function toDate(value: TimeValue): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    return new Date(value < 1e12 ? value * 1000 : value)
  }
  const numeric = Number(value)
  if (!Number.isNaN(numeric) && value.trim() !== '') return toDate(numeric)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatRelative(value: TimeValue, fallback = '—'): string {
  const date = toDate(value)
  return date ? dayjs(date).fromNow() : fallback
}

export function formatDateTime(value: TimeValue, fallback = '—'): string {
  const date = toDate(value)
  return date ? dayjs(date).format('MMM D, YYYY HH:mm') : fallback
}

export function formatDate(value: TimeValue, fallback = '—'): string {
  const date = toDate(value)
  return date ? dayjs(date).format('MMM D, YYYY') : fallback
}

/** Chat-list style label: time today, weekday this week, else date. */
export function formatShortTime(value: TimeValue, fallback = ''): string {
  const date = toDate(value)
  if (!date) return fallback
  const d = dayjs(date)
  const now = dayjs()
  if (d.isSame(now, 'day')) return d.format('h:mm A')
  if (now.diff(d, 'day') < 7) return d.format('ddd')
  return d.format('MMM D')
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString()
}
