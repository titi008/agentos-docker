import dayjs from 'dayjs'

import { toDate, type TimeValue } from '@/lib/time'

/** "Nov 5, 13:58" this year, "Nov 5, 2025 13:58" otherwise. */
export function formatStamp(value: TimeValue, fallback = '—'): string {
  const date = toDate(value)
  if (!date) return fallback
  const d = dayjs(date)
  return d.format(
    d.isSame(dayjs(), 'year') ? 'MMM D, HH:mm' : 'MMM D, YYYY HH:mm'
  )
}

/** "Nov 5, 2026 14:02:11". */
export function formatPrecise(value: TimeValue, fallback = '—'): string {
  const date = toDate(value)
  return date ? dayjs(date).format('MMM D, YYYY HH:mm:ss') : fallback
}

/** Finish time of a run: clock time when it ended the day it started. */
export function formatFinished(
  started: TimeValue,
  finished: TimeValue
): string {
  const start = toDate(started)
  const end = toDate(finished)
  if (!end) return '—'
  if (start && dayjs(start).isSame(end, 'day')) {
    return dayjs(end).format('HH:mm:ss')
  }
  return formatPrecise(end)
}

/** Milliseconds between two timestamps, or null when either is missing. */
export function durationMs(start: TimeValue, end: TimeValue): number | null {
  const from = toDate(start)
  const to = toDate(end)
  if (!from || !to) return null
  return Math.max(0, to.getTime() - from.getTime())
}

/** "Fri, Nov 6 · 07:30" in the viewer's local time. */
export function formatNextRun(value: TimeValue): string {
  const date = toDate(value)
  return date ? dayjs(date).format('ddd, MMM D · HH:mm') : '—'
}

/** "today", "tomorrow", "in 4 days" or "5 minutes ago" relative to `now`. */
export function relativeDay(value: TimeValue, now: number): string {
  const date = toDate(value)
  if (!date) return ''
  const target = dayjs(date)
  const current = dayjs(now)
  if (target.isBefore(current)) return target.from(current)
  const days = target.startOf('day').diff(current.startOf('day'), 'day')
  if (days === 0) return target.from(current)
  if (days === 1) return 'tomorrow'
  return target.from(current)
}

/** Absolute time in the schedule's own timezone, for tooltips. */
export function formatInTimezone(value: TimeValue, timeZone: string): string {
  const date = toDate(value)
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
      timeZoneName: 'short'
    }).format(date)
  } catch {
    // Unknown timezone names throw a RangeError; fall back to local time.
    return dayjs(date).format('MMM D, YYYY HH:mm')
  }
}

export const shortId = (id: string, length = 8) =>
  id.length > length ? id.slice(0, length) : id

/** Explains `Schedule.disabled_reason` values set by the system. */
export function describeDisabledReason(reason: string | null | undefined) {
  if (!reason) return null
  if (reason.startsWith('target_archived:')) {
    const [, type = 'component', ...rest] = reason.split(':')
    const id = rest.join(':')
    const target = id ? `${type} ${id}` : type
    return `Paused by AgentOS because its target ${target} was archived. Restore it before enabling the schedule.`
  }
  if (reason.startsWith('endpoint_drift:')) {
    return 'Paused by AgentOS because its endpoint no longer matches its target. Point it back at the target before enabling it.'
  }
  if (reason === 'company_off') {
    return 'Paused by AgentOS because Company is turned off.'
  }
  if (reason === 'company_product_archived') {
    return 'Paused by AgentOS because its Company product was archived.'
  }
  return `Paused by AgentOS (${reason}).`
}
