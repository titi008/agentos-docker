'use client'

import { useEffect, useState } from 'react'

import {
  formatDateTime,
  formatRelative,
  toDate,
  type TimeValue
} from '@/lib/time'

/**
 * Relative time ("5 minutes ago") with the absolute time in the tooltip and
 * `dateTime` attribute. Re-renders every minute.
 */
export function RelativeTime({
  value,
  fallback = '—',
  className
}: {
  value: TimeValue
  fallback?: string
  className?: string
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const date = toDate(value)
  if (!date) return <span className={className}>{fallback}</span>
  return (
    <time
      dateTime={date.toISOString()}
      title={formatDateTime(date)}
      className={className}
      suppressHydrationWarning
    >
      {formatRelative(date)}
    </time>
  )
}
