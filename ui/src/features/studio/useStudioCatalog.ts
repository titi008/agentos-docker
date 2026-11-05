'use client'

import { useMemo } from 'react'

import { useStore } from '@/store'
import {
  useAgentsQuery,
  useHealthQuery,
  useTeamsQuery,
  useWorkflowsQuery
} from '@/features/workspace/queries'

import { buildCatalog } from './lib'
import { useComponentsQuery, useRegistryQuery } from './queries'
import type {
  AgentInfo,
  CatalogItem,
  StudioKind,
  TeamInfo,
  WorkflowInfo
} from './types'

export type ListStatus =
  | { state: 'loading' }
  | { state: 'error'; error: unknown; retry: () => void; retrying: boolean }
  | { state: 'ready' }

interface Section {
  items: CatalogItem[]
  status: ListStatus
  /** Set when only the Studio-managed half failed; code items still show. */
  componentsError: unknown
  retryComponents: () => void
  retryingComponents: boolean
}

/**
 * Agents, teams, workflows and the registry with consistent totals for the
 * Studio tabs. The list routes give code-defined (and published Studio)
 * entries; the components route adds drafts and versions.
 */
export function useStudioCatalog() {
  const hydrated = useStore((state) => state.hydrated)
  const health = useHealthQuery()
  const agents = useAgentsQuery()
  const teams = useTeamsQuery()
  const workflows = useWorkflowsQuery()
  const agentComponents = useComponentsQuery('agent')
  const teamComponents = useComponentsQuery('team')
  const workflowComponents = useComponentsQuery('workflow')
  const registry = useRegistryQuery()

  const agentItems = useMemo(
    () =>
      buildCatalog(
        'agent',
        agents.data as AgentInfo[] | undefined,
        agentComponents.data
      ),
    [agents.data, agentComponents.data]
  )
  const teamItems = useMemo(
    () =>
      buildCatalog(
        'team',
        teams.data as TeamInfo[] | undefined,
        teamComponents.data
      ),
    [teams.data, teamComponents.data]
  )
  const workflowItems = useMemo(
    () =>
      buildCatalog(
        'workflow',
        workflows.data as WorkflowInfo[] | undefined,
        workflowComponents.data
      ),
    [workflows.data, workflowComponents.data]
  )

  const statusOf = (query: {
    isError: boolean
    isSuccess: boolean
    error: unknown
    isFetching: boolean
    refetch: () => unknown
  }): ListStatus => {
    if (health.isError) {
      return {
        state: 'error',
        error: health.error,
        retry: () => void health.refetch(),
        retrying: health.isFetching
      }
    }
    if (query.isError) {
      return {
        state: 'error',
        error: query.error,
        retry: () => void query.refetch(),
        retrying: query.isFetching
      }
    }
    if (!hydrated || !query.isSuccess) return { state: 'loading' }
    return { state: 'ready' }
  }

  const section = (
    items: CatalogItem[],
    list: Parameters<typeof statusOf>[0],
    components: typeof agentComponents
  ): Section => ({
    items,
    status: statusOf(list),
    componentsError: components.isError ? components.error : null,
    retryComponents: () => void components.refetch(),
    retryingComponents: components.isFetching
  })

  const sections: Record<StudioKind, Section> = {
    agent: section(agentItems, agents, agentComponents),
    team: section(teamItems, teams, teamComponents),
    workflow: section(workflowItems, workflows, workflowComponents)
  }

  const countOf = (kind: StudioKind) =>
    sections[kind].status.state === 'ready'
      ? sections[kind].items.length
      : undefined

  const counts: Record<string, number | undefined> = {
    '/studio/agents': countOf('agent'),
    '/studio/teams': countOf('team'),
    '/studio/workflows': countOf('workflow'),
    '/studio/registry': registry.isSuccess ? registry.data.length : undefined
  }

  const lists = [
    agents,
    teams,
    workflows,
    agentComponents,
    teamComponents,
    workflowComponents,
    registry
  ]

  return {
    sections,
    registry,
    registryStatus: statusOf(registry),
    counts,
    isFetching: lists.some((query) => query.isFetching),
    refetchAll: async () => {
      const status = await health.refetch()
      if (status.isSuccess)
        await Promise.all(lists.map((query) => query.refetch()))
    }
  }
}
