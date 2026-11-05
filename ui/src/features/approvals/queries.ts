'use client'

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { ApiError, getErrorMessage, unwrapList, useApi } from '@/api/client'
import { chatHref } from '@/components/shell/nav'
import {
  APPROVALS_KEY,
  useAgentsQuery,
  useTeamsQuery,
  useWorkflowsQuery
} from '@/features/workspace/queries'

import { sourceOf } from './model'
import type {
  Approval,
  ApprovalDecision,
  ResolutionData,
  SourceKind
} from './types'

export type ApprovalView = 'waiting' | 'resolved'

const PAGE_SIZE = 50

interface ApprovalPage {
  items: Approval[]
  page: number
  totalPages: number
}

function toPage(value: unknown, page: number): ApprovalPage {
  const meta =
    value && typeof value === 'object'
      ? (value as { meta?: { total_pages?: unknown } }).meta
      : undefined
  return {
    items: unwrapList<Approval>(value, 'approvals'),
    page,
    totalPages: typeof meta?.total_pages === 'number' ? meta.total_pages : page
  }
}

/**
 * Waiting uses the server's `status=pending` filter. Resolved covers four
 * statuses and the API filters on one, so it pages through all approvals
 * (newest first) and drops the pending ones.
 */
export function useApprovalList(view: ApprovalView) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: api.key(APPROVALS_KEY, 'list', view),
    queryFn: async ({ pageParam, signal }) =>
      toPage(
        await api.request<unknown>('/approvals', {
          query: {
            status: view === 'waiting' ? 'pending' : undefined,
            limit: PAGE_SIZE,
            page: pageParam
          },
          signal
        }),
        pageParam
      ),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: api.ready,
    refetchInterval: 30_000
  })
}

export function useApprovalQuery(id: string, placeholder?: Approval) {
  const api = useApi()
  return useQuery({
    queryKey: api.key(APPROVALS_KEY, 'item', id),
    queryFn: ({ signal }) =>
      api.request<Approval>(`/approvals/${encodeURIComponent(id)}`, {
        signal
      }),
    enabled: api.ready,
    placeholderData: placeholder
  })
}

/** Chat title of the session that paused; best effort, the id is the fallback. */
export function useSessionName(approval: Approval) {
  const api = useApi()
  const { kind } = sourceOf(approval)
  return useQuery({
    queryKey: api.key(APPROVALS_KEY, 'session', approval.session_id),
    queryFn: ({ signal }) =>
      api
        .request<{ session_name?: string | null }>(
          `/sessions/${encodeURIComponent(approval.session_id)}`,
          {
            query: { type: kind ?? undefined, user_id: approval.user_id },
            signal
          }
        )
        .then((session) => session?.session_name?.trim() || null),
    enabled: api.ready && Boolean(approval.session_id && kind),
    retry: false,
    staleTime: 5 * 60_000
  })
}

/** Display names for agents, teams and workflows. */
export function useComponentNames() {
  const agents = useAgentsQuery()
  const teams = useTeamsQuery()
  const workflows = useWorkflowsQuery()
  const names = useMemo(() => {
    const map = new Map<string, string>()
    for (const agent of agents.data ?? []) {
      if (agent.name) map.set(`agent:${agent.id}`, agent.name)
    }
    for (const team of teams.data ?? []) {
      if (team.name) map.set(`team:${team.id}`, team.name)
    }
    for (const workflow of workflows.data ?? []) {
      if (workflow.name) map.set(`workflow:${workflow.id}`, workflow.name)
    }
    return map
  }, [agents.data, teams.data, workflows.data])
  return useCallback(
    (kind: SourceKind, id: string) => names.get(`${kind}:${id}`),
    [names]
  )
}

export function approvalChatHref(approval: Approval): string | null {
  const { kind, id } = sourceOf(approval)
  return kind && id && approval.session_id
    ? chatHref(kind, id, approval.session_id)
    : null
}

const RESOURCE: Record<SourceKind, string> = {
  agent: 'agents',
  team: 'teams',
  workflow: 'workflows'
}

interface ResolveVariables {
  approval: Approval
  decision: ApprovalDecision
  resolution?: ResolutionData
}

/**
 * Records the decision, then resumes the paused run. Resolving only updates
 * the approval record; Agno documents continuing the run by id afterwards
 * (POST /{agents|teams|workflows}/{id}/runs/{run_id}/continue without tools),
 * which applies the stored decision. `background=true` hands the
 * continuation to the durable queue when the run has a ticket.
 */
export function useResolveApproval() {
  const api = useApi()
  const queryClient = useQueryClient()
  const router = useRouter()

  const resume = (approval: Approval) => {
    const { kind, id } = sourceOf(approval)
    // Audit records never gate a run, so there is nothing to resume.
    if (approval.approval_type === 'audit' || !kind || !id) return
    const form = new FormData()
    if (approval.session_id) form.set('session_id', approval.session_id)
    if (approval.user_id) form.set('user_id', approval.user_id)
    form.set('stream', 'false')
    form.set('background', 'true')
    api
      .request(
        `/${RESOURCE[kind]}/${encodeURIComponent(id)}/runs/${encodeURIComponent(approval.run_id)}/continue`,
        {
          method: 'POST',
          formData: form,
          // Resume as the run's owner; an authenticated server still uses the token's user.
          withUser: !approval.user_id
        }
      )
      .then(() =>
        queryClient.invalidateQueries({ queryKey: api.key(APPROVALS_KEY) })
      )
      .catch((error: unknown) => {
        // 409: the run is already continuing (another client resumed it).
        if (error instanceof ApiError && error.status === 409) return
        const href = approvalChatHref(approval)
        toast.error("Your decision was saved, but the run didn't resume", {
          description: getErrorMessage(error, api.ctx.endpoint),
          action: href
            ? { label: 'Open chat', onClick: () => router.push(href) }
            : undefined
        })
      })
  }

  return useMutation({
    mutationFn: ({ approval, decision, resolution }: ResolveVariables) =>
      api.request<Approval>(
        `/approvals/${encodeURIComponent(approval.id)}/resolve`,
        {
          method: 'POST',
          json: {
            status: decision,
            ...(resolution ? { resolution_data: resolution } : {})
          }
        }
      ),
    onSuccess: (_, { approval, decision }) => {
      toast.success(decision === 'approved' ? 'Approved' : 'Rejected', {
        description:
          approval.approval_type === 'audit'
            ? undefined
            : decision === 'approved'
              ? 'The agent is running the action now.'
              : 'The agent continues without running the action.'
      })
      resume(approval)
      return queryClient.invalidateQueries({
        queryKey: api.key(APPROVALS_KEY)
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('This request was already resolved', {
          description: error.detail ?? undefined
        })
        void queryClient.invalidateQueries({
          queryKey: api.key(APPROVALS_KEY)
        })
        return
      }
      toast.error("Couldn't save your decision", {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
    }
  })
}
