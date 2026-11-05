'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo } from 'react'

import { unwrapList, useApi } from '@/api/client'
import { useStore } from '@/store'

import type {
  KnowledgeInstance,
  OsConfigSlice,
  PageResult,
  PaginationMeta
} from './types'

/** Query-key root for everything in the Knowledge area. */
export const KNOWLEDGE_KEY = 'knowledge'

/** Normalises the `{data|entries, meta}` pages AgentOS list endpoints return. */
export function readPage<T>(value: unknown, key?: string): PageResult<T> {
  const items = unwrapList<T>(value, key)
  const meta =
    value && typeof value === 'object' && 'meta' in value
      ? ((value as { meta?: Partial<PaginationMeta> | null }).meta ?? null)
      : null
  return {
    items,
    totalCount: meta?.total_count ?? items.length,
    totalPages: Math.max(1, meta?.total_pages ?? 1)
  }
}

/** `GET /config`: knowledge bases and filesystem namespaces. */
export function useOsConfigQuery() {
  const api = useApi()
  return useQuery({
    queryKey: api.key(KNOWLEDGE_KEY, 'os-config'),
    queryFn: ({ signal }) => api.request<OsConfigSlice>('/config', { signal }),
    enabled: api.ready,
    staleTime: 5 * 60_000
  })
}

export interface KnowledgeBaseSelection {
  bases: KnowledgeInstance[]
  /** `knowledge_id` to send; undefined when the server has a single base. */
  id: string | undefined
  setId: (id: string) => void
  /** False until we know whether a knowledge_id is required. */
  ready: boolean
}

/**
 * The knowledge routes need `knowledge_id` only when AgentOS serves several
 * knowledge bases. The choice lives in the `kb` URL param.
 */
export function useKnowledgeBase(): KnowledgeBaseSelection {
  const config = useOsConfigQuery()
  const [kbParam, setKbParam] = useQueryState('kb')
  const bases = useMemo(
    () => config.data?.knowledge?.knowledge_instances ?? [],
    [config.data]
  )
  const selected =
    bases.length > 1
      ? (bases.find((base) => base.id === kbParam) ?? bases[0])
      : undefined
  return {
    bases,
    id: selected?.id,
    setId: (id) => void setKbParam(id),
    ready: !config.isPending
  }
}

export interface ComponentNames {
  agent: (id: string) => string
  team: (id: string) => string
  /** "Agent name", "Team name (team)" or null when neither id is set. */
  source: (agentId?: string | null, teamId?: string | null) => string | null
}

/** Resolves agent and team ids to the names the shell already loaded. */
export function useComponentNames(): ComponentNames {
  const agents = useStore((state) => state.agents)
  const teams = useStore((state) => state.teams)
  return useMemo(() => {
    const agentNames = new Map(agents.map((a) => [a.id, a.name || a.id]))
    const teamNames = new Map(teams.map((t) => [t.id, t.name || t.id]))
    const agent = (id: string) => agentNames.get(id) ?? id
    const team = (id: string) => teamNames.get(id) ?? id
    return {
      agent,
      team,
      source: (agentId, teamId) =>
        agentId ? agent(agentId) : teamId ? `${team(teamId)} (team)` : null
    }
  }, [agents, teams])
}

/** Asks the browser to confirm leaving the page while `active`. */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])
}
