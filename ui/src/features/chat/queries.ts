'use client'

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey
} from '@tanstack/react-query'

import { ApiError, unwrapList, useApi } from '@/api/client'
import { useStore, type ChatMode } from '@/store'
import type { AvailableModel, SessionEntry } from '@/types/os'

/** Root of every chat query key; invalidate it to refresh chats. */
export const CHAT_KEY = 'chat'

const SESSIONS_PAGE_SIZE = 50

export interface ChatTargetRef {
  kind: ChatMode
  id: string
  dbId: string | null
}

export interface SessionPage {
  items: SessionEntry[]
  page: number
  totalPages: number
  totalCount: number
}

export type SessionsData = InfiniteData<SessionPage, number>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toSessionPage(value: unknown, page: number): SessionPage {
  const items = unwrapList<SessionEntry>(value).filter(
    (item) => typeof item?.session_id === 'string'
  )
  const meta = isRecord(value) && isRecord(value.meta) ? value.meta : {}
  const totalPages =
    typeof meta.total_pages === 'number' ? meta.total_pages : page
  const totalCount =
    typeof meta.total_count === 'number' ? meta.total_count : items.length
  return { items, page, totalPages, totalCount }
}

export function useChatQueryKeys() {
  const api = useApi()
  return {
    sessions: (target: ChatTargetRef): QueryKey =>
      api.key(CHAT_KEY, 'sessions', target.kind, target.id, target.dbId ?? ''),
    sessionRuns: (target: ChatTargetRef, sessionId: string): QueryKey =>
      api.key(
        CHAT_KEY,
        'session-runs',
        target.kind,
        target.id,
        target.dbId ?? '',
        sessionId
      )
  }
}

/** Chats of one agent, team or workflow, newest first, 50 per page. */
export function useChatSessions(target: ChatTargetRef | null) {
  const api = useApi()
  const keys = useChatQueryKeys()
  const connected = useStore((state) => state.isEndpointActive)
  return useInfiniteQuery<SessionPage, Error, SessionsData, QueryKey, number>({
    queryKey: target
      ? keys.sessions(target)
      : api.key(CHAT_KEY, 'sessions', 'none'),
    queryFn: async ({ pageParam, signal }) => {
      if (!target) return toSessionPage([], 1)
      try {
        const value = await api.request<unknown>('/sessions', {
          signal,
          query: {
            type: target.kind,
            component_id: target.id,
            db_id: target.dbId,
            user_id: api.ctx.userId,
            limit: SESSIONS_PAGE_SIZE,
            page: pageParam,
            sort_by: 'created_at',
            sort_order: 'desc'
          }
        })
        return toSessionPage(value, pageParam)
      } catch (error) {
        // AgentOS answers 404 when the component has no session storage.
        if (error instanceof ApiError && error.status === 404) {
          return toSessionPage([], pageParam)
        }
        throw error
      }
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: api.ready && connected && target !== null
  })
}

/* Cache helpers used by the run stream and the list's menu actions. */

export function addSessionToCache(
  qc: QueryClient,
  key: QueryKey,
  entry: SessionEntry
) {
  qc.setQueryData<SessionsData>(key, (data) => {
    if (!data) {
      return {
        pages: [{ items: [entry], page: 1, totalPages: 1, totalCount: 1 }],
        pageParams: [1]
      }
    }
    const exists = data.pages.some((page) =>
      page.items.some((item) => item.session_id === entry.session_id)
    )
    if (exists) return data
    const [first, ...rest] = data.pages
    return {
      ...data,
      pages: [
        {
          ...first,
          items: [entry, ...first.items],
          totalCount: first.totalCount + 1
        },
        ...rest
      ]
    }
  })
}

export function removeSessionFromCache(
  qc: QueryClient,
  key: QueryKey,
  sessionId: string
) {
  qc.setQueryData<SessionsData>(key, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.session_id !== sessionId)
          }))
        }
      : data
  )
}

function renameSessionInCache(
  qc: QueryClient,
  key: QueryKey,
  sessionId: string,
  name: string
) {
  qc.setQueryData<SessionsData>(key, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.session_id === sessionId
                ? { ...item, session_name: name }
                : item
            )
          }))
        }
      : data
  )
}

/** POST /sessions/{id}/rename with `{ session_name }` (agno session router). */
export function useRenameSession(target: ChatTargetRef | null) {
  const api = useApi()
  const qc = useQueryClient()
  const keys = useChatQueryKeys()
  return useMutation({
    mutationFn: ({ sessionId, name }: { sessionId: string; name: string }) => {
      if (!target) throw new Error('Choose who you are talking to first.')
      return api.request<unknown>(
        `/sessions/${encodeURIComponent(sessionId)}/rename`,
        {
          method: 'POST',
          query: {
            type: target.kind,
            db_id: target.dbId,
            user_id: api.ctx.userId
          },
          json: { session_name: name }
        }
      )
    },
    onSuccess: (_, { sessionId, name }) => {
      if (!target) return
      renameSessionInCache(qc, keys.sessions(target), sessionId, name)
      return qc.invalidateQueries({ queryKey: keys.sessions(target) })
    }
  })
}

/** DELETE /sessions/{id}; removes the session and all its runs. */
export function useDeleteSession(target: ChatTargetRef | null) {
  const api = useApi()
  const qc = useQueryClient()
  const keys = useChatQueryKeys()
  return useMutation({
    mutationFn: (sessionId: string) => {
      if (!target) throw new Error('Choose who you are talking to first.')
      return api.request<unknown>(
        `/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'DELETE',
          query: { db_id: target.dbId, user_id: api.ctx.userId }
        }
      )
    },
    onSuccess: (_, sessionId) => {
      if (!target) return
      removeSessionFromCache(qc, keys.sessions(target), sessionId)
      return qc.invalidateQueries({ queryKey: keys.sessions(target) })
    }
  })
}

/** Used when the server has no model list (older AgentOS builds). */
export const FALLBACK_MODELS: AvailableModel[] = [
  { id: 'claude-sonnet-5-5', provider: 'Anthropic' },
  { id: 'claude-opus-5-5', provider: 'Anthropic' },
  { id: 'claude-haiku-5-5', provider: 'Anthropic' },
  { id: 'gemini-4-argon', provider: 'Google' },
  { id: 'gemini-3.8-flash', provider: 'Google' },
  { id: 'gpt-6.1-sol', provider: 'OpenAI' }
]

/** Model palette from the application's GET /api/models (or /models). */
export function useModelsQuery() {
  const api = useApi()
  const connected = useStore((state) => state.isEndpointActive)
  return useQuery({
    queryKey: api.key(CHAT_KEY, 'models'),
    queryFn: ({ signal }) =>
      api
        .request<unknown>('/api/models', { signal, fallbackPaths: ['/models'] })
        .then((value) =>
          unwrapList<AvailableModel>(value).filter(
            (model) => typeof model?.id === 'string' && model.id
          )
        ),
    enabled: api.ready && connected,
    staleTime: 5 * 60_000,
    retry: false
  })
}

/** Step names of a workflow, for the new-chat summary (GET /workflows/{id}). */
export function useWorkflowSteps(workflowId: string | null) {
  const api = useApi()
  const connected = useStore((state) => state.isEndpointActive)
  return useQuery({
    queryKey: api.key(CHAT_KEY, 'workflow-steps', workflowId),
    queryFn: async ({ signal }) => {
      const value = await api.request<unknown>(
        `/workflows/${encodeURIComponent(workflowId ?? '')}`,
        { signal }
      )
      const steps = isRecord(value) ? value.steps : null
      if (!Array.isArray(steps)) return []
      return steps
        .map((step) =>
          isRecord(step) && typeof step.name === 'string' ? step.name : null
        )
        .filter((name): name is string => Boolean(name))
    },
    enabled: api.ready && connected && Boolean(workflowId),
    staleTime: 5 * 60_000
  })
}

export interface SessionOwner {
  kind: ChatMode
  id: string
}

/**
 * Finds which agent, team or workflow a session belongs to, for links that
 * carry only `?session=` (GET /sessions/{id} auto-detects the type).
 */
export function useSessionOwner(sessionId: string | null, dbId: string | null) {
  const api = useApi()
  const connected = useStore((state) => state.isEndpointActive)
  return useQuery({
    queryKey: api.key(CHAT_KEY, 'session-owner', sessionId, dbId ?? ''),
    queryFn: async ({ signal }): Promise<SessionOwner | null> => {
      const value = await api.request<unknown>(
        `/sessions/${encodeURIComponent(sessionId ?? '')}`,
        { signal, query: { db_id: dbId, user_id: api.ctx.userId } }
      )
      if (!isRecord(value)) return null
      for (const kind of ['agent', 'team', 'workflow'] as const) {
        const id = value[`${kind}_id`]
        if (typeof id === 'string' && id) return { kind, id }
      }
      return null
    },
    enabled: api.ready && connected && Boolean(sessionId),
    staleTime: Infinity
  })
}
