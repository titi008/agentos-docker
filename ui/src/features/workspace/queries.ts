'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { unwrapList, useApi } from '@/api/client'
import type { RuntimeConfigResponse } from '@/app/api/config/route'
import { useStore } from '@/store'
import type {
  AgentDetails,
  TeamDetails,
  WorkflowSummaryResponse
} from '@/types/os'

/** Query-key roots shared across features. Invalidate a root to refresh everything under it. */
export const WORKSPACE_KEY = 'workspace'
export const APPROVALS_KEY = 'approvals'

export function useHealthQuery() {
  const api = useApi()
  return useQuery({
    queryKey: api.key(WORKSPACE_KEY, 'health'),
    queryFn: ({ signal }) =>
      api.request<unknown>('/health', { signal, withUser: false }),
    enabled: api.ready,
    retry: false,
    refetchInterval: 60_000
  })
}

function useConnected() {
  const health = useHealthQuery()
  return health.status === 'success'
}

export function useAgentsQuery() {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(WORKSPACE_KEY, 'agents'),
    queryFn: ({ signal }) =>
      api
        .request<unknown>('/agents', { signal })
        .then(unwrapList<AgentDetails>),
    enabled: api.ready && connected
  })
}

export function useTeamsQuery() {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(WORKSPACE_KEY, 'teams'),
    queryFn: ({ signal }) =>
      api.request<unknown>('/teams', { signal }).then(unwrapList<TeamDetails>),
    enabled: api.ready && connected
  })
}

export function useWorkflowsQuery() {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(WORKSPACE_KEY, 'workflows'),
    queryFn: ({ signal }) =>
      api
        .request<unknown>('/workflows', { signal })
        .then(unwrapList<WorkflowSummaryResponse>),
    enabled: api.ready && connected
  })
}

export function useApprovalsCountQuery() {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(APPROVALS_KEY, 'count'),
    queryFn: ({ signal }) =>
      api
        .request<{ count?: number }>('/approvals/count', { signal })
        .then((data) => data?.count ?? 0),
    enabled: api.ready && connected,
    refetchInterval: 30_000
  })
}

export interface OperatorIdentity {
  user_id: string
  is_authenticated: boolean
  source: 'cloudflare_zero_trust' | 'default'
}

/** Identity from this UI's own server (Cloudflare Access email or DEFAULT_USER_ID). */
export function useIdentityQuery() {
  return useQuery({
    queryKey: ['identity'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/auth/me', { signal })
      if (!response.ok)
        throw new Error(`Identity lookup failed (${response.status})`)
      return (await response.json()) as OperatorIdentity
    },
    staleTime: Infinity,
    retry: 1
  })
}

/** This deployment's settings, read by the UI server at request time. */
export function useRuntimeConfigQuery() {
  return useQuery({
    queryKey: ['runtime-config'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/config', { signal })
      if (!response.ok)
        throw new Error(`Config lookup failed (${response.status})`)
      return (await response.json()) as RuntimeConfigResponse
    },
    staleTime: Infinity,
    retry: 1
  })
}

/**
 * Resolves the AgentOS host (a saved one, else the deployment default), then
 * loads connection status, agents, teams, workflows, the approvals count and
 * the operator identity, and mirrors them into the store for the chat code.
 * Mounted once by the app shell.
 */
export function useWorkspaceBootstrap() {
  const runtimeConfig = useRuntimeConfigQuery()
  const health = useHealthQuery()
  const agents = useAgentsQuery()
  const teams = useTeamsQuery()
  const workflows = useWorkflowsQuery()
  const approvalsCount = useApprovalsCountQuery()
  const identity = useIdentityQuery()

  const hydrated = useStore((state) => state.hydrated)
  const setIsEndpointActive = useStore((state) => state.setIsEndpointActive)
  const setIsEndpointLoading = useStore((state) => state.setIsEndpointLoading)
  const setAgents = useStore((state) => state.setAgents)
  const setTeams = useStore((state) => state.setTeams)
  const setWorkflows = useStore((state) => state.setWorkflows)
  const setPendingApprovalsCount = useStore(
    (state) => state.setPendingApprovalsCount
  )
  const setUserId = useStore((state) => state.setUserId)
  const authToken = useStore((state) => state.authToken)
  const setAuthToken = useStore((state) => state.setAuthToken)
  const applyServerDefaultEndpoint = useStore(
    (state) => state.applyServerDefaultEndpoint
  )

  // Requests wait until the host is known; without a config the stored or built-in host is used.
  useEffect(() => {
    if (!hydrated) return
    if (runtimeConfig.isSuccess) {
      applyServerDefaultEndpoint(runtimeConfig.data.default_endpoint)
    } else if (runtimeConfig.isError) {
      applyServerDefaultEndpoint(null)
    }
  }, [
    hydrated,
    runtimeConfig.isSuccess,
    runtimeConfig.isError,
    runtimeConfig.data,
    applyServerDefaultEndpoint
  ])

  // A build-time token seeds the connection when none is stored yet.
  useEffect(() => {
    const envToken = process.env.NEXT_PUBLIC_OS_SECURITY_KEY
    if (hydrated && !authToken && envToken) setAuthToken(envToken)
  }, [hydrated, authToken, setAuthToken])

  useEffect(() => {
    setIsEndpointLoading(!hydrated || health.isPending)
    setIsEndpointActive(health.status === 'success')
  }, [
    hydrated,
    health.isPending,
    health.status,
    setIsEndpointActive,
    setIsEndpointLoading
  ])

  useEffect(() => setAgents(agents.data ?? []), [agents.data, setAgents])
  useEffect(() => setTeams(teams.data ?? []), [teams.data, setTeams])
  useEffect(
    () => setWorkflows(workflows.data ?? []),
    [workflows.data, setWorkflows]
  )
  useEffect(
    () => setPendingApprovalsCount(approvalsCount.data ?? 0),
    [approvalsCount.data, setPendingApprovalsCount]
  )
  useEffect(() => {
    if (hydrated && identity.data?.user_id) setUserId(identity.data.user_id)
  }, [hydrated, identity.data?.user_id, setUserId])
}
