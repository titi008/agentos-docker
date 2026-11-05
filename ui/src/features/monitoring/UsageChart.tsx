'use client'

import { useState, type KeyboardEvent } from 'react'

import { Card } from '@/components/ui/data'
import { SegmentedControl } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/utils'

import { formatCompact, formatInteger, formatUsd } from './format'
import { niceTicks, type ChartBucket } from './usage'

export type ChartMetric = 'spend' | 'tokens'

function tickLabel(value: number, metric: ChartMetric): string {
  if (metric === 'tokens') return formatCompact(value)
  if (value === 0) return '$0'
  return value >= 1
    ? `$${Number.isInteger(value) ? value : value.toFixed(1)}`
    : `$${Number(value.toPrecision(2))}`
}

function valueOf(bucket: ChartBucket, metric: ChartMetric): number {
  return metric === 'spend' ? (bucket.spend ?? 0) : bucket.tokens
}

function formatValue(value: number, metric: ChartMetric): string {
  return metric === 'spend'
    ? formatUsd(value)
    : `${formatCompact(value)} tokens`
}

interface UsageChartProps {
  buckets: ChartBucket[]
  weekly: boolean
  metric: ChartMetric
  onMetricChange: (metric: ChartMetric) => void
  loading: boolean
  /** Spend is known (the costs endpoint returned priced runs). */
  spendAvailable: boolean
  className?: string
}

/**
 * Bars of spend or tokens per day (or per week for long ranges). Hover or
 * focus the plot and use the arrow keys to read exact values; the Daily
 * history table below carries the same numbers.
 */
export function UsageChart({
  buckets,
  weekly,
  metric,
  onMetricChange,
  loading,
  spendAvailable,
  className
}: UsageChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)

  const unit = weekly ? 'week' : 'day'
  const title =
    metric === 'spend'
      ? weekly
        ? 'Weekly spend'
        : 'Daily spend'
      : weekly
        ? 'Weekly tokens'
        : 'Daily tokens'
  const values = buckets.map((bucket) => valueOf(bucket, metric))
  const total = values.reduce((sum, value) => sum + value, 0)
  const peakIndex = values.reduce(
    (best, value, index) => (value > values[best] ? index : best),
    0
  )
  const peak = values[peakIndex] ?? 0
  const ticks = niceTicks(peak)
  const top = ticks[ticks.length - 1] || 1

  const noData =
    metric === 'spend' ? !spendAvailable || total === 0 : total === 0
  const summary = noData
    ? null
    : `Total ${formatValue(total, metric)} · Peak ${formatValue(peak, metric)} ${weekly ? 'in the week of' : 'on'} ${buckets[peakIndex]?.label}`

  const first = buckets[0]
  const last = buckets[buckets.length - 1]
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6))
  const hasPartial = buckets.some((bucket) => bucket.partial)
  const activeBucket = active !== null ? buckets[active] : undefined

  const describe = (bucket: ChartBucket) => {
    const parts = [
      `${bucket.fullLabel}${bucket.partial ? ' (so far)' : ''}`,
      metric === 'spend'
        ? formatUsd(bucket.spend ?? 0)
        : `${formatInteger(bucket.tokens)} tokens`
    ]
    if (metric === 'spend') parts.push(`${formatInteger(bucket.tokens)} tokens`)
    else if (bucket.spend !== null && spendAvailable)
      parts.push(`${formatUsd(bucket.spend)} estimated`)
    return parts.join(', ')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = buckets.length - 1
    const current = active ?? lastIndex
    const next =
      event.key === 'ArrowLeft'
        ? Math.max(0, current - 1)
        : event.key === 'ArrowRight'
          ? Math.min(lastIndex, current + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? lastIndex
              : null
    if (next === null) return
    event.preventDefault()
    setActive(next)
  }

  const tooltipPosition = (index: number) => {
    const center = ((index + 0.5) / buckets.length) * 100
    const transform =
      center < 18
        ? 'translateX(-12px)'
        : center > 82
          ? 'translateX(calc(-100% + 12px))'
          : 'translateX(-50%)'
    return { left: `${center}%`, transform }
  }

  return (
    <Card
      className={cn('flex min-w-0 flex-col gap-3.5 p-4', className)}
      role="region"
      aria-labelledby="usage-chart-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="usage-chart-title" className="text-[15px] font-semibold">
            {title}
          </h2>
          <p className="text-[12.5px] text-fg-3">
            {loading
              ? 'Loading…'
              : (summary ??
                (metric === 'spend' && !spendAvailable
                  ? 'No cost data yet'
                  : 'No usage in this range'))}
          </p>
        </div>
        <SegmentedControl
          aria-label="Chart metric"
          value={metric}
          onChange={onMetricChange}
          options={[
            { value: 'spend', label: 'Spend' },
            { value: 'tokens', label: 'Tokens' }
          ]}
        />
      </div>

      {loading ? (
        <Skeleton className="h-[230px] w-full rounded-lg" />
      ) : noData ? (
        <div className="grid h-[230px] place-items-center rounded-lg border border-dashed border-line-strong px-6 text-center text-[13px] text-fg-3">
          {metric === 'spend' && !spendAvailable
            ? 'Spend appears once runs are priced. Check the model rates below, then recalculate.'
            : `No ${metric === 'spend' ? 'spend' : 'token usage'} recorded in this range.`}
        </div>
      ) : (
        <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-2">
          <div aria-hidden className="relative h-[200px]">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 translate-y-1/2 text-xs text-fg-3 tabular-nums"
                style={{ bottom: `${(tick / top) * 100}%` }}
              >
                {tickLabel(tick, metric)}
              </span>
            ))}
          </div>
          <div className="min-w-0">
            <div
              role="group"
              tabIndex={0}
              aria-label={`${title}, ${first?.fullLabel} to ${last?.fullLabel}. ${summary}. Use the left and right arrow keys to read each ${unit}; the Daily history table has every value.`}
              onKeyDown={onKeyDown}
              onFocus={() => {
                setFocused(true)
                setActive((current) => current ?? buckets.length - 1)
              }}
              onBlur={() => {
                setFocused(false)
                setActive(null)
              }}
              onPointerLeave={() => {
                if (!focused) setActive(null)
              }}
              className="relative h-[200px] rounded-sm border-b border-line-strong outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {ticks.slice(1).map((tick) => (
                <div
                  key={tick}
                  aria-hidden
                  className="absolute inset-x-0 h-px bg-line"
                  style={{ bottom: `${(tick / top) * 100}%` }}
                />
              ))}
              <div
                aria-hidden
                className="absolute inset-0 flex items-end gap-0.5 px-0.5"
              >
                {buckets.map((bucket, index) => {
                  const value = values[index]
                  return (
                    <div
                      key={bucket.key}
                      onPointerEnter={() => setActive(index)}
                      className="flex h-full min-w-0 flex-1 items-end justify-center"
                    >
                      <div
                        className={cn(
                          'w-full max-w-6 rounded-t-[4px] bg-accent transition-[filter]',
                          bucket.partial && 'opacity-45',
                          active === index && 'brightness-125'
                        )}
                        style={{
                          height: `${(value / top) * 100}%`,
                          minHeight: value > 0 ? 2 : 0
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              {activeBucket ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-1 z-10 flex min-w-32 flex-col gap-0.5 rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs whitespace-nowrap shadow-pop"
                  style={tooltipPosition(active ?? 0)}
                >
                  <span className="text-[13px] font-semibold text-fg tabular-nums">
                    {metric === 'spend'
                      ? formatUsd(activeBucket.spend ?? 0)
                      : `${formatInteger(activeBucket.tokens)} tokens`}
                  </span>
                  <span className="text-fg-2">
                    {activeBucket.fullLabel}
                    {activeBucket.partial ? ' (so far)' : ''}
                  </span>
                  {metric === 'spend' ? (
                    <span className="text-fg-3 tabular-nums">
                      {formatInteger(activeBucket.tokens)} tokens
                    </span>
                  ) : activeBucket.spend !== null && spendAvailable ? (
                    <span className="text-fg-3 tabular-nums">
                      {formatUsd(activeBucket.spend)} estimated
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div aria-hidden className="flex h-6 gap-0.5 px-0.5 pt-1.5">
              {buckets.map((bucket, index) => (
                <span key={bucket.key} className="relative min-w-0 flex-1">
                  {index % labelEvery === 0 ? (
                    <span className="absolute left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-fg-3">
                      {bucket.label}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            <p className="sr-only" aria-live="polite">
              {focused && activeBucket ? describe(activeBucket) : ''}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3.5 text-[12.5px] text-fg-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px] bg-accent" />
          {metric === 'spend'
            ? `Estimated spend per ${unit} (USD)`
            : `Tokens per ${unit} (input + output)`}
        </span>
        {hasPartial ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-[2px] bg-accent opacity-45"
            />
            {weekly ? 'This week, so far' : 'Today, so far'}
          </span>
        ) : null}
      </div>
    </Card>
  )
}
