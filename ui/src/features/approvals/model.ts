import type { BadgeTone } from '@/components/ui/badge'

import type { Approval, SourceKind } from './types'

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Waiting', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'bad' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' }
}

function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value
}

export function statusMeta(status: string): { label: string; tone: BadgeTone } {
  return STATUS[status] ?? { label: humanize(status), tone: 'neutral' }
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

/** The agent, team or workflow whose run paused. */
export function sourceOf(approval: Approval): {
  kind: SourceKind | null
  id: string | null
} {
  if (approval.source_type === 'team' && approval.team_id) {
    return { kind: 'team', id: approval.team_id }
  }
  if (approval.source_type === 'workflow' && approval.workflow_id) {
    return { kind: 'workflow', id: approval.workflow_id }
  }
  if (approval.agent_id) return { kind: 'agent', id: approval.agent_id }
  if (approval.team_id) return { kind: 'team', id: approval.team_id }
  if (approval.workflow_id)
    return { kind: 'workflow', id: approval.workflow_id }
  return { kind: null, id: null }
}

export const SOURCE_LABEL: Record<SourceKind, string> = {
  agent: 'Agent',
  team: 'Team',
  workflow: 'Workflow'
}

export function requesterName(
  approval: Approval,
  lookup: (kind: SourceKind, id: string) => string | undefined
): string {
  const source = sourceOf(approval)
  return (
    text(approval.source_name) ??
    text(approval.context?.source_name) ??
    (source.kind && source.id ? lookup(source.kind, source.id) : undefined) ??
    source.id ??
    'An agent'
  )
}

export function typeLabel(approval: Approval): string {
  const pause = approval.pause_type ?? 'confirmation'
  const label =
    pause === 'confirmation'
      ? 'Tool confirmation'
      : pause === 'user_input'
        ? 'Needs your input'
        : pause === 'external_execution'
          ? 'External result'
          : humanize(pause)
  return approval.approval_type === 'audit' ? `${label} (audit record)` : label
}

export function sourceLabel(approval: Approval): string {
  const base =
    approval.source_type === 'agent'
      ? 'Agent run'
      : approval.source_type === 'team'
        ? 'Team run'
        : approval.source_type === 'workflow'
          ? 'Workflow run'
          : humanize(approval.source_type || 'run')
  return approval.schedule_id ? `${base} · scheduled` : base
}

export interface InputField {
  name: string
  type: string
  description?: string
  value?: unknown
}

export interface PendingAction {
  key: string
  toolName: string
  args: Record<string, unknown> | null
  /** Team member that called the tool. */
  memberName?: string
  inputFields: InputField[]
}

function inputFields(value: unknown): InputField[] {
  if (!Array.isArray(value)) return []
  return value
    .map(record)
    .filter((field): field is Record<string, unknown> => field !== null)
    .map((field) => ({
      name: text(field.name) ?? '',
      type: text(field.field_type) ?? 'str',
      description: text(field.description),
      value: field.value
    }))
    .filter((field) => field.name)
}

/**
 * The tool calls this approval covers. One approval can hold several calls
 * paused in the same turn; older records only carry `tool_name`/`tool_args`.
 */
export function pendingActions(approval: Approval): PendingAction[] {
  const actions: PendingAction[] = []
  for (const [index, item] of (approval.requirements ?? []).entries()) {
    const requirement = record(item)
    const tool = record(requirement?.tool_execution)
    const toolName = text(tool?.tool_name)
    if (!requirement || !tool || !toolName) continue
    actions.push({
      key: text(requirement.id) ?? text(tool.tool_call_id) ?? `${index}`,
      toolName,
      args: record(tool.tool_args),
      memberName: text(requirement.member_agent_name),
      inputFields: inputFields(
        requirement.user_input_schema ?? tool.user_input_schema
      )
    })
  }
  if (actions.length > 0) return actions
  return [
    {
      key: 'tool',
      toolName: approval.tool_name || 'Agent action',
      args: approval.tool_args ?? null,
      inputFields: []
    }
  ]
}

/** Turns a typed input back into the field's declared type. */
export function parseInput(field: InputField, raw: string): unknown {
  const value = raw.trim()
  if (field.type === 'int') {
    const number = Number(value)
    return Number.isInteger(number) ? number : value
  }
  if (field.type === 'float') {
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  if (field.type === 'bool') return value === 'true'
  return raw
}

export function resolutionNote(approval: Approval): string | undefined {
  return text(approval.resolution_data?.note)
}

export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}
