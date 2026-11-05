'use client'

import { Bot, UserRound, Users, Workflow } from 'lucide-react'
import { useMemo } from 'react'

import {
  useAgentsQuery,
  useTeamsQuery,
  useWorkflowsQuery
} from '@/features/workspace/queries'
import { cn } from '@/lib/utils'

import type { ExecutorType } from './types'

export interface ExecutorInfo {
  type: ExecutorType
  id: string
  name: string
  /** e.g. "3 members: Content Strategist, Market Researcher, …" */
  caption?: string
}

const KIND_LABEL: Record<ExecutorType, string> = {
  agent: 'Agent',
  team: 'Team',
  workflow: 'Workflow'
}

export function executorKindLabel(type: string | null | undefined): string {
  return type && type in KIND_LABEL
    ? KIND_LABEL[type as ExecutorType]
    : 'Executor'
}

export function isExecutorType(value: unknown): value is ExecutorType {
  return value === 'agent' || value === 'team' || value === 'workflow'
}

/** Select value for an executor, e.g. `team:solo-chief`. Ids may contain ':'. */
export function encodeExecutor(type: ExecutorType, id: string): string {
  return `${type}:${id}`
}

export function decodeExecutor(
  value: string
): { type: ExecutorType; id: string } | null {
  const index = value.indexOf(':')
  if (index <= 0) return null
  const type = value.slice(0, index)
  const id = value.slice(index + 1)
  return isExecutorType(type) && id ? { type, id } : null
}

function memberNames(members: unknown): string[] {
  if (!Array.isArray(members)) return []
  return members
    .map((member) => {
      if (!member || typeof member !== 'object') return null
      const record = member as Record<string, unknown>
      const name = record.name ?? record.id ?? record.agent_id ?? record.team_id
      return typeof name === 'string' && name ? name : null
    })
    .filter((name): name is string => name !== null)
}

function membersCaption(members: unknown): string | undefined {
  const names = memberNames(members)
  if (names.length === 0) return undefined
  const shown = names.slice(0, 4).join(', ')
  const rest = names.length > 4 ? `, +${names.length - 4} more` : ''
  return `${names.length} ${names.length === 1 ? 'member' : 'members'}: ${shown}${rest}`
}

const isInternal = (id: string) => id.endsWith('-internal')

/**
 * Agents and teams that can be assigned to tasks (internal manager members
 * excluded), plus a lookup that names any executor, including internal ones.
 */
export function useExecutors() {
  const agents = useAgentsQuery()
  const teams = useTeamsQuery()
  const workflows = useWorkflowsQuery()

  return useMemo(() => {
    const all = new Map<string, ExecutorInfo>()
    const teamOptions: ExecutorInfo[] = []
    const agentOptions: ExecutorInfo[] = []
    for (const team of teams.data ?? []) {
      const info: ExecutorInfo = {
        type: 'team',
        id: team.id,
        name: team.name || team.id,
        caption: membersCaption(team.members)
      }
      all.set(encodeExecutor('team', team.id), info)
      if (!isInternal(team.id)) teamOptions.push(info)
    }
    for (const agent of agents.data ?? []) {
      const info: ExecutorInfo = {
        type: 'agent',
        id: agent.id,
        name: agent.name || agent.id
      }
      all.set(encodeExecutor('agent', agent.id), info)
      if (!isInternal(agent.id)) agentOptions.push(info)
    }
    for (const workflow of workflows.data ?? []) {
      all.set(encodeExecutor('workflow', workflow.id), {
        type: 'workflow',
        id: workflow.id,
        name: workflow.name || workflow.id
      })
    }
    const byName = (a: ExecutorInfo, b: ExecutorInfo) =>
      a.name.localeCompare(b.name)

    return {
      teams: teamOptions.sort(byName),
      agents: agentOptions.sort(byName),
      isLoading: agents.isPending || teams.isPending,
      /** Name and caption for a task's executor; falls back to the raw id. */
      lookup(
        type: string | null | undefined,
        id: string | null | undefined
      ): ExecutorInfo | null {
        if (!type || !id || !isExecutorType(type)) return null
        return all.get(encodeExecutor(type, id)) ?? { type, id, name: id }
      }
    }
  }, [
    agents.data,
    agents.isPending,
    teams.data,
    teams.isPending,
    workflows.data
  ])
}

export type Executors = ReturnType<typeof useExecutors>

/** Icon for an executor kind; a person outline when unassigned. */
export function ExecutorIcon({
  type,
  className
}: {
  type: string | null | undefined
  className?: string
}) {
  const classes = cn('size-3.5 shrink-0', className)
  if (type === 'team') return <Users aria-hidden className={classes} />
  if (type === 'agent') return <Bot aria-hidden className={classes} />
  if (type === 'workflow') return <Workflow aria-hidden className={classes} />
  return <UserRound aria-hidden className={classes} />
}

/**
 * Options for a native select of executors, grouped into Teams and Agents.
 * `current` keeps an executor selectable that is not offered (a workflow or
 * an internal component), so a saved assignment never silently disappears.
 */
export function ExecutorOptions({
  executors,
  current
}: {
  executors: Executors
  current?: ExecutorInfo | null
}) {
  const offered =
    current &&
    (current.type === 'team' ? executors.teams : executors.agents).some(
      (option) => option.type === current.type && option.id === current.id
    )
  return (
    <>
      <option value="">Unassigned</option>
      {current && !offered ? (
        <option value={encodeExecutor(current.type, current.id)}>
          {current.name} ({executorKindLabel(current.type).toLowerCase()})
        </option>
      ) : null}
      {executors.teams.length > 0 ? (
        <optgroup label="Teams">
          {executors.teams.map((team) => (
            <option key={team.id} value={encodeExecutor('team', team.id)}>
              {team.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {executors.agents.length > 0 ? (
        <optgroup label="Agents">
          {executors.agents.map((agent) => (
            <option key={agent.id} value={encodeExecutor('agent', agent.id)}>
              {agent.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  )
}
