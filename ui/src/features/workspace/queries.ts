'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { ApiError, unwrapList, useApi } from '@/api/client'
import type { OperatorIdentityResponse } from '@/app/api/auth/me/route'
import type { SessionTokenResponse } from '@/app/api/auth/token/route'
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

export type OperatorIdentity = OperatorIdentityResponse

/** Identity from this UI's own server (Cloudflare Access sign-in, its email header, or DEFAULT_USER_ID). */
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

export const SESSION_TOKEN_KEY = ['session-token'] as const

/** Renew the token this long before it expires. */
const TOKEN_RENEW_MARGIN_MS = 2 * 60_000

/** Cloudflare Access wants the person to log in again; only a page load can do that. */
export class SignInRequiredError extends Error {
  constructor(message = 'Your sign-in has ended. Sign in again to continue.') {
    super(message)
    this.name = 'SignInRequiredError'
  }
}

const msUntilRenewal = (token: SessionTokenResponse | undefined) =>
  token ? token.expires_at * 1000 - Date.now() - TOKEN_RENEW_MARGIN_MS : 0

/**
 * The short-lived AgentOS token this UI's server issues to the signed-in
 * person, renewed before it expires (and when the tab comes back after one ran out).
 */
export function useSessionTokenQuery(enabled: boolean) {
  return useQuery({
    queryKey: SESSION_TOKEN_KEY,
    queryFn: async ({ signal }) => {
      // Cloudflare answers an ended session with a redirect to its login page.
      const response = await fetch('/api/auth/token', {
        signal,
        cache: 'no-store',
        redirect: 'manual'
      })
      const isJson = response.headers
        .get('content-type')
        ?.includes('application/json')
      if (
        response.type === 'opaqueredirect' ||
        response.status === 401 ||
        (response.ok && !isJson)
      ) {
        throw new SignInRequiredError()
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          detail?: string
        } | null
        throw new Error(
          body?.detail ?? `Sign-in failed (${response.status}). Try again.`
        )
      }
      return (await response.json()) as SessionTokenResponse
    },
    enabled,
    staleTime: (query) => Math.max(msUntilRenewal(query.state.data), 0),
    refetchInterval: (query) =>
      query.state.data
        ? Math.max(msUntilRenewal(query.state.data), 10_000)
        : false,
    refetchIntervalInBackground: true,
    retry: (failureCount, error) =>
      !(error instanceof SignInRequiredError) && failureCount < 2
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
  const queryClient = useQueryClient()

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
  const signIn = useStore((state) => state.signIn)
  const signInResolved = useStore((state) => state.signInResolved)
  const setSignIn = useStore((state) => state.setSignIn)
  const setSessionToken = useStore((state) => state.setSessionToken)
  const sessionToken = useSessionTokenQuery(signIn === 'cloudflare_access')

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

  // The config says whether this UI signs people in; without it, the Settings token is used.
  useEffect(() => {
    if (runtimeConfig.isSuccess) setSignIn(runtimeConfig.data.sign_in)
    else if (runtimeConfig.isError) setSignIn(null)
  }, [
    runtimeConfig.isSuccess,
    runtimeConfig.isError,
    runtimeConfig.data,
    setSignIn
  ])

  const issued = sessionToken.data
  useEffect(() => {
    if (!issued) return
    setSessionToken(issued.token)
    setUserId(issued.user_id)
  }, [issued, setSessionToken, setUserId])

  // Requests that failed on an expired token run again with the new one.
  useEffect(() => {
    if (!issued) return
    void queryClient.invalidateQueries({
      predicate: (query) =>
        query.state.status === 'error' &&
        query.state.error instanceof ApiError &&
        query.state.error.status === 401
    })
  }, [issued, queryClient])

  // With sign-in, a token saved in Settings (often the server's master key) is never used: drop it.
  useEffect(() => {
    if (signIn && authToken) setAuthToken('')
  }, [signIn, authToken, setAuthToken])

  // A build-time token seeds the connection when none is stored yet.
  useEffect(() => {
    const envToken = process.env.NEXT_PUBLIC_OS_SECURITY_KEY
    if (hydrated && signInResolved && !signIn && !authToken && envToken) {
      setAuthToken(envToken)
    }
  }, [hydrated, signInResolved, signIn, authToken, setAuthToken])

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
  // Signed-in people get their id with the token; otherwise it comes from /api/auth/me.
  useEffect(() => {
    if (hydrated && signInResolved && !signIn && identity.data?.user_id) {
      setUserId(identity.data.user_id)
    }
  }, [hydrated, signInResolved, signIn, identity.data?.user_id, setUserId])
}
