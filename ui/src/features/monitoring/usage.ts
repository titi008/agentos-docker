import {
  addDays,
  dayKeyToMs,
  daysBetween,
  formatDayKey,
  utcDayKey
} from './format'
import type { DailyCost, DayMetrics } from './types'

export const USAGE_RANGES = ['7d', '30d', '90d', 'all'] as const
export type UsageRange = (typeof USAGE_RANGES)[number]

export const USAGE_RANGE_LABEL: Record<UsageRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time'
}

const USAGE_RANGE_DAYS: Record<Exclude<UsageRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90
}

/** First UTC day of the range (inclusive), or null for all time. */
export function rangeStart(range: UsageRange, today: string): string | null {
  return range === 'all' ? null : addDays(today, -(USAGE_RANGE_DAYS[range] - 1))
}

export function inRange(key: string, start: string | null, today: string) {
  return (!start || key >= start) && key <= today
}

/** One UTC day of aggregated metrics (rows for the same day are merged). */
export interface DayTotals {
  key: string
  agentRuns: number
  teamRuns: number
  workflowRuns: number
  agentSessions: number
  teamSessions: number
  workflowSessions: number
  users: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/** Daily totals inside the range, newest first. */
export function aggregateMetrics(
  metrics: DayMetrics[],
  start: string | null,
  today: string
): DayTotals[] {
  const byDay = new Map<string, DayTotals>()
  for (const metric of metrics) {
    const ms = Date.parse(metric.date)
    if (Number.isNaN(ms)) continue
    const key = utcDayKey(ms)
    if (!inRange(key, start, today)) continue
    const day = byDay.get(key) ?? {
      key,
      agentRuns: 0,
      teamRuns: 0,
      workflowRuns: 0,
      agentSessions: 0,
      teamSessions: 0,
      workflowSessions: 0,
      users: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    }
    const tokens = metric.token_metrics ?? {}
    const input = num(tokens.input_tokens)
    const output = num(tokens.output_tokens)
    day.agentRuns += num(metric.agent_runs_count)
    day.teamRuns += num(metric.team_runs_count)
    day.workflowRuns += num(metric.workflow_runs_count)
    day.agentSessions += num(metric.agent_sessions_count)
    day.teamSessions += num(metric.team_sessions_count)
    day.workflowSessions += num(metric.workflow_sessions_count)
    day.users += num(metric.users_count)
    day.inputTokens += input
    day.outputTokens += output
    day.totalTokens += num(tokens.total_tokens) || input + output
    byDay.set(key, day)
  }
  return [...byDay.values()].sort((a, b) => (a.key < b.key ? 1 : -1))
}

export interface UsageTotals {
  days: number
  agentRuns: number
  teamRuns: number
  workflowRuns: number
  runs: number
  agentSessions: number
  teamSessions: number
  workflowSessions: number
  sessions: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  /** Most unique users on a single day; daily counts can't be summed. */
  peakUsers: number
}

export function sumTotals(days: DayTotals[]): UsageTotals {
  const totals: UsageTotals = {
    days: days.length,
    agentRuns: 0,
    teamRuns: 0,
    workflowRuns: 0,
    runs: 0,
    agentSessions: 0,
    teamSessions: 0,
    workflowSessions: 0,
    sessions: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    peakUsers: 0
  }
  for (const day of days) {
    totals.agentRuns += day.agentRuns
    totals.teamRuns += day.teamRuns
    totals.workflowRuns += day.workflowRuns
    totals.agentSessions += day.agentSessions
    totals.teamSessions += day.teamSessions
    totals.workflowSessions += day.workflowSessions
    totals.inputTokens += day.inputTokens
    totals.outputTokens += day.outputTokens
    totals.totalTokens += day.totalTokens
    totals.peakUsers = Math.max(totals.peakUsers, day.users)
  }
  totals.runs = totals.agentRuns + totals.teamRuns + totals.workflowRuns
  totals.sessions =
    totals.agentSessions + totals.teamSessions + totals.workflowSessions
  return totals
}

/* Chart buckets ----------------------------------------------------------- */

export interface ChartBucket {
  key: string
  /** Axis label, e.g. "Nov 5". */
  label: string
  /** Tooltip / screen reader label, e.g. "Nov 5, 2026" or "Week of Nov 3, 2026". */
  fullLabel: string
  tokens: number
  /** Null when no cost data is available. */
  spend: number | null
  /** The bucket contains today and is still filling. */
  partial: boolean
}

/** Longer ranges are grouped by week so bars stay readable. */
const MAX_DAILY_BUCKETS = 92

function weekStart(key: string): string {
  const day = new Date(dayKeyToMs(key)).getUTCDay()
  return addDays(key, -((day + 6) % 7))
}

export function buildBuckets(
  range: UsageRange,
  today: string,
  days: DayTotals[],
  costs: DailyCost[] | null
): { buckets: ChartBucket[]; weekly: boolean } {
  let start = rangeStart(range, today)
  if (!start) {
    const keys = [
      ...days.map((day) => day.key),
      ...(costs ?? []).map((cost) => cost.date)
    ].filter((key) => key <= today)
    start = keys.length
      ? keys.reduce((min, key) => (key < min ? key : min))
      : addDays(today, -29)
  }

  const weekly = daysBetween(start, today) + 1 > MAX_DAILY_BUCKETS
  const bucketKey = (key: string) => (weekly ? weekStart(key) : key)

  const buckets = new Map<string, ChartBucket>()
  for (let key = bucketKey(start); key <= today;) {
    buckets.set(key, {
      key,
      label: formatDayKey(key),
      fullLabel: weekly
        ? `Week of ${formatDayKey(key, true)}`
        : formatDayKey(key, true),
      tokens: 0,
      spend: costs ? 0 : null,
      partial: false
    })
    key = addDays(key, weekly ? 7 : 1)
  }

  for (const day of days) {
    if (day.key < start) continue
    const bucket = buckets.get(bucketKey(day.key))
    if (bucket) bucket.tokens += day.totalTokens
  }
  for (const cost of costs ?? []) {
    if (cost.date < start || cost.date > today) continue
    const bucket = buckets.get(bucketKey(cost.date))
    if (bucket && bucket.spend !== null) bucket.spend += cost.total_cost || 0
  }
  const current = buckets.get(bucketKey(today))
  if (current) current.partial = true

  return { buckets: [...buckets.values()], weekly }
}

/** Axis maximum and evenly spaced ticks with round values. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return Array.from({ length: count + 1 }, (_, i) => i)
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const step =
    (normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10) * magnitude
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}
