'use client'

import { useCallback, useEffect, useState } from 'react'

import { useStore } from '@/store'

import { describeCron } from './cron'
import type { Schedule } from './types'

/** Runtime-owned Company tick (`agno.db.schemas.scheduler.COMPANY_AUTOMATION_SCHEDULE_ID`). */
export const COMPANY_AUTOMATION_ID = 'agno-company-automation'
/** Routine declared in `app/company.py`. */
export const MAINTENANCE_ROUTINE = 'agentos-maintenance'

const RUN_ENDPOINT = /^\/(agents|teams|workflows)\/([^/]+)\/runs\/?$/

export type ComponentKind = 'agent' | 'team' | 'workflow'

export function toComponentKind(
  value: string | null | undefined
): ComponentKind | null {
  switch (value) {
    case 'agent':
    case 'agents':
      return 'agent'
    case 'team':
    case 'teams':
      return 'team'
    case 'workflow':
    case 'workflows':
      return 'workflow'
    default:
      return null
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * How the UI may change a schedule. Company Routines are refused by the
 * `/schedules` write routes (409) and change through `/company/routines`;
 * the Company automation tick and archived Routines are read-only.
 */
export type ScheduleControl = 'schedule' | 'routine' | 'readonly'

export interface ScheduleModel {
  schedule: Schedule
  /** Routine names drop their `<product_id>.` prefix. */
  displayName: string
  description: string | null
  control: ScheduleControl
  /** Why a read-only schedule can't be changed here. */
  readonlyReason: string | null
  /** Short provenance label, e.g. "Company routine". */
  origin: string | null
  productId: string | null
  onDemand: boolean
  cronText: string | null
  target: { kind: ComponentKind; id: string } | null
  isMaintenance: boolean
}

const ROUTINE_PREFIX = /^Operate only on Product [^\n]*\n\n/

function decodeSegment(segment: string | undefined): string | null {
  if (!segment) return null
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function toScheduleModel(schedule: Schedule): ScheduleModel {
  const payload = readRecord(schedule.payload)
  const metadata = readRecord(payload?.metadata)
  const productId =
    schedule.managed_by === 'company' &&
    typeof metadata?.product_id === 'string'
      ? metadata.product_id
      : null
  const archived =
    metadata?.deleted_at !== undefined && metadata.deleted_at !== null

  let control: ScheduleControl = 'schedule'
  let readonlyReason: string | null = null
  let origin: string | null =
    schedule.managed_by === 'studio' ? 'Created in Studio' : null
  if (schedule.id === COMPANY_AUTOMATION_ID) {
    control = 'readonly'
    origin = 'Managed by AgentOS'
    readonlyReason =
      'AgentOS runs this schedule for Company. It cannot be paused or run from here.'
  } else if (schedule.managed_by === 'company') {
    if (!productId) {
      control = 'readonly'
      origin = 'Company'
      readonlyReason =
        'This Company schedule is missing its product, so it cannot be changed here.'
    } else if (archived) {
      control = 'readonly'
      origin = 'Archived routine'
      readonlyReason =
        'Archived Company routine. Restore it from Company routines to use it again.'
    } else {
      control = 'routine'
      origin = 'Company routine'
    }
  }

  const displayName =
    productId && schedule.name.startsWith(`${productId}.`)
      ? schedule.name.slice(productId.length + 1)
      : schedule.name

  const message = typeof payload?.message === 'string' ? payload.message : null
  const instructions =
    productId && message ? message.replace(ROUTINE_PREFIX, '').trim() : null

  const endpointTarget = RUN_ENDPOINT.exec(schedule.endpoint ?? '')
  const kind =
    toComponentKind(schedule.target_type) ??
    toComponentKind(endpointTarget?.[1])
  const targetId =
    schedule.target_id ?? decodeSegment(endpointTarget?.[2]) ?? null

  return {
    schedule,
    displayName,
    description: schedule.description?.trim() || instructions || null,
    control,
    readonlyReason,
    origin,
    productId,
    onDemand: !schedule.cron_expr,
    cronText: describeCron(schedule.cron_expr),
    target: kind && targetId ? { kind, id: targetId } : null,
    isMaintenance: displayName === MAINTENANCE_ROUTINE
  }
}

/** Path that pauses or resumes a schedule, or null when it can't be toggled. */
export function togglePath(
  model: ScheduleModel,
  enable: boolean
): string | null {
  const id = encodeURIComponent(model.schedule.id)
  if (model.control === 'routine') {
    // On-demand Routines can't be paused (409); resuming a disabled one is allowed.
    if (model.onDemand && !enable) return null
    return `/company/routines/${id}/${enable ? 'resume' : 'pause'}`
  }
  if (model.control === 'schedule') {
    return `/schedules/${id}/${enable ? 'enable' : 'disable'}`
  }
  return null
}

/** Path that runs a schedule now, or null when it can't be triggered. */
export function triggerPath(model: ScheduleModel): string | null {
  const id = encodeURIComponent(model.schedule.id)
  if (model.control === 'routine') return `/company/routines/${id}/trigger`
  if (model.control === 'schedule') return `/schedules/${id}/trigger`
  return null
}

/** Display names of the framework-owned managers, which `/agents` and `/teams` may omit. */
const FRAMEWORK_NAMES: Record<string, string> = {
  'os-manager-internal': 'OS Manager',
  'company-manager-internal': 'Company Manager',
  'platform-builder-internal': 'Platform Builder',
  'platform-manager-internal': 'Platform Manager'
}

const KIND_LABELS: Record<ComponentKind, string> = {
  agent: 'Agent',
  team: 'Team',
  workflow: 'Workflow'
}

export interface ResolvedComponent {
  kind: ComponentKind | null
  id: string
  name: string
  /** True when the component is registered here, so chat links resolve. */
  known: boolean
  kindLabel: string | null
}

/** Resolves component ids to names using the agents, teams and workflows the shell loaded. */
export function useComponentDirectory() {
  const agents = useStore((state) => state.agents)
  const teams = useStore((state) => state.teams)
  const workflows = useStore((state) => state.workflows)

  return useCallback(
    (type: string | null | undefined, id: string): ResolvedComponent => {
      const kind = toComponentKind(type)
      const list =
        kind === 'agent'
          ? agents
          : kind === 'team'
            ? teams
            : kind === 'workflow'
              ? workflows
              : []
      const match = list.find((item) => item.id === id)
      return {
        kind,
        id,
        name: match?.name || FRAMEWORK_NAMES[id] || id,
        known: Boolean(match),
        kindLabel: kind ? KIND_LABELS[kind] : type || null
      }
    },
    [agents, teams, workflows]
  )
}

/** Current time that refreshes every `intervalMs`, for live relative labels. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}
