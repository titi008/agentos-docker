import { Bot, GitBranch, Users, type LucideIcon } from 'lucide-react'

import type { ChatMode } from '@/store'
import type {
  AgentDetails,
  TeamDetails,
  WorkflowSummaryResponse
} from '@/types/os'

/** Anything the operator can chat with, normalised for the picker and header. */
export interface ChatTarget {
  kind: ChatMode
  id: string
  name: string
  description: string
  dbId: string | null
  /** The model the target runs with by default. */
  modelId: string | null
  modelProvider: string | null
  /** Platform agents (`*-internal`) are listed last, under "Internal". */
  internal: boolean
  /** Tool names (agents) or member names (teams). Workflow steps load separately. */
  capabilities: string[]
  /** Studio version when the component was built in Studio. */
  studioVersion: number | null
}

export const KIND_LABEL: Record<ChatMode, string> = {
  agent: 'Agent',
  team: 'Team',
  workflow: 'Workflow'
}

export const KIND_ICON: Record<ChatMode, LucideIcon> = {
  agent: Bot,
  team: Users,
  workflow: GitBranch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nameOf(item: unknown): string | null {
  if (typeof item === 'string') return item
  if (!isRecord(item)) return null
  if (typeof item.name === 'string' && item.name) return item.name
  if (isRecord(item.function) && typeof item.function.name === 'string') {
    return item.function.name
  }
  return typeof item.id === 'string' && item.id ? item.id : null
}

/** `tools` is `{ tools: [...] }` on AgentOS 3.x and a plain list on older builds. */
export function toolNames(tools: unknown): string[] {
  const list = Array.isArray(tools)
    ? tools
    : isRecord(tools) && Array.isArray(tools.tools)
      ? tools.tools
      : []
  return Array.from(
    new Set(list.map(nameOf).filter((name): name is string => Boolean(name)))
  )
}

function studioVersion(entity: object): number | null {
  const record = entity as Record<string, unknown>
  return record.is_component === true &&
    typeof record.current_version === 'number'
    ? record.current_version
    : null
}

export function agentTarget(agent: AgentDetails): ChatTarget {
  return {
    kind: 'agent',
    id: agent.id,
    name: agent.name || agent.id,
    description: agent.description || agent.role || '',
    dbId: agent.db_id || null,
    modelId: agent.model?.model || null,
    modelProvider: agent.model?.provider || null,
    internal: agent.id.endsWith('-internal'),
    capabilities: toolNames(agent.tools),
    studioVersion: studioVersion(agent)
  }
}

export function teamTarget(team: TeamDetails): ChatTarget {
  return {
    kind: 'team',
    id: team.id,
    name: team.name || team.id,
    description: team.description || '',
    dbId: team.db_id || null,
    modelId: team.model?.model || null,
    modelProvider: team.model?.provider || null,
    internal: false,
    capabilities: (team.members ?? [])
      .map(nameOf)
      .filter((name): name is string => Boolean(name)),
    studioVersion: studioVersion(team)
  }
}

export function workflowTarget(workflow: WorkflowSummaryResponse): ChatTarget {
  return {
    kind: 'workflow',
    id: workflow.id,
    name: workflow.name || workflow.id,
    description: workflow.description || '',
    dbId: workflow.db_id || null,
    modelId: null,
    modelProvider: null,
    internal: false,
    capabilities: (workflow.steps ?? [])
      .map((step) => step.name)
      .filter((name): name is string => Boolean(name)),
    studioVersion: studioVersion(workflow)
  }
}

/** Badge text for the picker, e.g. "Team · 3 members". */
export function kindBadge(target: ChatTarget): string {
  if (target.kind === 'team' && target.capabilities.length) {
    const count = target.capabilities.length
    return `Team · ${count} member${count === 1 ? '' : 's'}`
  }
  return KIND_LABEL[target.kind]
}

/** Short capability summary, e.g. "4 tools" or "3 members". */
export function capabilitySummary(target: ChatTarget): string | null {
  const count = target.capabilities.length
  if (!count) return null
  if (target.kind === 'agent') return `${count} tool${count === 1 ? '' : 's'}`
  if (target.kind === 'team') return `${count} member${count === 1 ? '' : 's'}`
  return `${count} step${count === 1 ? '' : 's'}`
}

/** Default pick when the URL names no target: a user-facing agent first. */
export function defaultTarget(targets: ChatTarget[]): ChatTarget | null {
  return (
    targets.find((target) => target.kind === 'agent' && !target.internal) ??
    targets.find((target) => target.kind === 'team') ??
    targets.find((target) => target.kind === 'workflow') ??
    targets[0] ??
    null
  )
}

/** URL of a chat, preserving the database id so deep links resolve sessions. */
export function chatUrl(
  kind: ChatMode,
  id: string,
  options: { sessionId?: string | null; dbId?: string | null } = {}
): string {
  const params = new URLSearchParams({ [kind]: id })
  if (options.sessionId) params.set('session', options.sessionId)
  if (options.dbId) params.set('db_id', options.dbId)
  return `/?${params.toString()}`
}
