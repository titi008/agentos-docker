import { unwrapList } from '@/api/client'
import type {
  AgentDetails,
  TeamDetails,
  WorkflowSummaryResponse
} from '@/types/os'

import type { Paginated, PaginationMeta } from './types'

/** Query-key root for everything on the monitoring pages. */
export const MONITORING_KEY = 'monitoring'

/** Normalises Agno's `{ data, meta }` list responses. */
export function toPaginated<T>(value: unknown): Paginated<T> {
  const meta =
    value && typeof value === 'object' && 'meta' in value
      ? ((value as { meta?: PaginationMeta }).meta ?? undefined)
      : undefined
  return { data: unwrapList<T>(value), meta }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
const usd3 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3
})
const usdSmall = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumSignificantDigits: 1,
  maximumSignificantDigits: 2
})
const usdRate = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4
})
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
})
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Estimated cost: two decimals from $1, more precision for small amounts. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  const abs = Math.abs(value)
  if (abs === 0 || abs >= 1) return usd2.format(value)
  if (abs >= 0.01) return usd3.format(value)
  return usdSmall.format(value)
}

/** Price per 1M tokens, e.g. "$2.00" or "$0.075". */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  return usdRate.format(value)
}

/** Token counts and other large numbers, e.g. "21.4M". */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  return compact.format(value)
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  return integer.format(value)
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${value.toFixed(fractionDigits)}%`
}

/** Parses Agno's duration strings ("150ms", "1.50s", "2m 3s") into milliseconds. */
export function parseDurationMs(
  value: string | null | undefined
): number | null {
  if (!value) return null
  let total = 0
  let matched = false
  const pattern = /(\d+(?:\.\d+)?)\s*(ms|s|m|h)\b/g
  for (const match of value.matchAll(pattern)) {
    matched = true
    const amount = Number(match[1])
    const unit = match[2]
    total +=
      unit === 'ms'
        ? amount
        : unit === 's'
          ? amount * 1000
          : unit === 'm'
            ? amount * 60_000
            : amount * 3_600_000
  }
  return matched ? total : null
}

export function timeMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/* Components -------------------------------------------------------------- */

export type ComponentKind = 'agent' | 'team' | 'workflow'

export const COMPONENT_KIND_LABEL: Record<ComponentKind, string> = {
  agent: 'Agent',
  team: 'Team',
  workflow: 'Workflow'
}

export interface ComponentRef {
  kind: ComponentKind
  id: string
  name: string
}

export interface ComponentDirectory {
  agents: AgentDetails[]
  teams: TeamDetails[]
  workflows: WorkflowSummaryResponse[]
}

/** Resolves the component behind a trace or eval run; workflow > team > agent. */
export function resolveComponent(
  ids: {
    agent_id?: string | null
    team_id?: string | null
    workflow_id?: string | null
  },
  directory: ComponentDirectory,
  fallbackName?: string | null
): ComponentRef | null {
  if (ids.workflow_id) {
    const match = directory.workflows.find((w) => w.id === ids.workflow_id)
    return {
      kind: 'workflow',
      id: ids.workflow_id,
      name: match?.name || fallbackName || ids.workflow_id
    }
  }
  if (ids.team_id) {
    const match = directory.teams.find((t) => t.id === ids.team_id)
    return {
      kind: 'team',
      id: ids.team_id,
      name: match?.name || fallbackName || ids.team_id
    }
  }
  if (ids.agent_id) {
    const match = directory.agents.find((a) => a.id === ids.agent_id)
    return {
      kind: 'agent',
      id: ids.agent_id,
      name: match?.name || fallbackName || ids.agent_id
    }
  }
  return null
}

/** `component` URL value on the traces page: `<kind>:<id>`. */
export function encodeComponent(kind: ComponentKind, id: string): string {
  return `${kind}:${id}`
}

export function decodeComponent(
  value: string | null | undefined
): { kind: ComponentKind; id: string } | null {
  if (!value) return null
  const index = value.indexOf(':')
  if (index <= 0) return null
  const kind = value.slice(0, index)
  const id = value.slice(index + 1)
  if (!id || (kind !== 'agent' && kind !== 'team' && kind !== 'workflow'))
    return null
  return { kind, id }
}

/* UTC days ---------------------------------------------------------------- */

const DAY_MS = 86_400_000

/** YYYY-MM-DD of a timestamp in UTC (the day AgentOS aggregates metrics by). */
export function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function dayKeyToMs(key: string): number {
  return Date.parse(`${key}T00:00:00Z`)
}

export function addDays(key: string, days: number): string {
  return utcDayKey(dayKeyToMs(key) + days * DAY_MS)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayKeyToMs(to) - dayKeyToMs(from)) / DAY_MS)
}

const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
})
const dayLabelYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
})

/** "Nov 5" for a UTC day key. */
export function formatDayKey(key: string, withYear = false): string {
  const ms = dayKeyToMs(key)
  if (Number.isNaN(ms)) return key
  return (withYear ? dayLabelYear : dayLabel).format(ms)
}
