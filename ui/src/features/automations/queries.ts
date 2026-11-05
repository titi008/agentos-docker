'use client'

import {
  keepPreviousData,
  useIsMutating,
  useQuery,
  type QueryClient
} from '@tanstack/react-query'

import { unwrapList, useApi } from '@/api/client'

import type {
  JobStatus,
  QueueJob,
  QueueStats,
  Schedule,
  ScheduleRun
} from './types'

/** Key root for everything in this area; invalidate it to refresh all of it. */
export const AUTOMATIONS_KEY = 'automations'

export const SCHEDULES_PAGE_SIZE = 50
export const RUNS_PAGE_SIZE = 20
export const JOBS_PAGE_SIZE = 25
/** Most recent jobs fetched for a search; the API has no text search. */
export const JOBS_SEARCH_LIMIT = 500

export interface PageResult<T> {
  items: T[]
  total: number
}

/** Reads `{ data, meta: { total_count } }` (or a bare list) into items and a total. */
export function readPage<T>(value: unknown): PageResult<T> {
  const items = unwrapList<T>(value)
  let total = items.length
  if (value && typeof value === 'object' && 'meta' in value) {
    const meta = (value as { meta?: { total_count?: unknown } }).meta
    if (typeof meta?.total_count === 'number') total = meta.total_count
  }
  return { items, total }
}

export function useScheduleKeys() {
  const api = useApi()
  return {
    all: api.key(AUTOMATIONS_KEY, 'schedules'),
    lists: api.key(AUTOMATIONS_KEY, 'schedules', 'list'),
    list: (page: number) =>
      api.key(AUTOMATIONS_KEY, 'schedules', 'list', { page }),
    detail: (id: string) => api.key(AUTOMATIONS_KEY, 'schedules', 'detail', id),
    runs: (id: string) => api.key(AUTOMATIONS_KEY, 'schedules', 'runs', id),
    runsPage: (id: string, page: number) =>
      api.key(AUTOMATIONS_KEY, 'schedules', 'runs', id, { page }),
    trigger: (id: string) => api.key(AUTOMATIONS_KEY, 'trigger', id)
  }
}

export function useSchedulesQuery(page: number) {
  const api = useApi()
  const keys = useScheduleKeys()
  return useQuery({
    queryKey: keys.list(page),
    queryFn: ({ signal }): Promise<PageResult<Schedule>> =>
      api
        .request<unknown>('/schedules', {
          signal,
          query: { page, limit: SCHEDULES_PAGE_SIZE }
        })
        .then(readPage<Schedule>),
    enabled: api.ready,
    placeholderData: keepPreviousData,
    // Next-run times move after every tick.
    refetchInterval: 60_000
  })
}

/** Loads one schedule, for deep links to a schedule outside the current list page. */
export function useScheduleQuery(id: string, enabled: boolean) {
  const api = useApi()
  const keys = useScheduleKeys()
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: ({ signal }) =>
      api.request<Schedule>(`/schedules/${encodeURIComponent(id)}`, { signal }),
    enabled: api.ready && enabled
  })
}

/** True while a "Run now" request for this schedule is in flight. */
export function useIsTriggering(id: string): boolean {
  const keys = useScheduleKeys()
  return useIsMutating({ mutationKey: keys.trigger(id) }) > 0
}

export function useScheduleRunsQuery(id: string, page: number) {
  const api = useApi()
  const keys = useScheduleKeys()
  const triggering = useIsTriggering(id)
  const scope = JSON.stringify(keys.runs(id))
  return useQuery({
    queryKey: keys.runsPage(id, page),
    queryFn: ({ signal }): Promise<PageResult<ScheduleRun>> =>
      api
        .request<unknown>(`/schedules/${encodeURIComponent(id)}/runs`, {
          signal,
          query: { page, limit: RUNS_PAGE_SIZE }
        })
        .then(readPage<ScheduleRun>),
    enabled: api.ready,
    // Keep the previous page while paging, but never show another schedule's runs.
    placeholderData: (previous, previousQuery) =>
      previousQuery &&
      JSON.stringify(previousQuery.queryKey.slice(0, -1)) === scope
        ? previous
        : undefined,
    // A manual run records its row immediately and finishes later; poll while anything is live.
    refetchInterval: (query) =>
      triggering ||
      query.state.data?.items.some((run) => run.status === 'running')
        ? 3_000
        : false
  })
}

/** Replaces fields of one schedule in every cached list and detail entry. */
export function patchScheduleCache(
  qc: QueryClient,
  keys: ReturnType<typeof useScheduleKeys>,
  id: string,
  patch: Partial<Schedule>
) {
  qc.setQueriesData<PageResult<Schedule>>({ queryKey: keys.lists }, (data) =>
    data
      ? {
          ...data,
          items: data.items.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          )
        }
      : data
  )
  qc.setQueryData<Schedule>(keys.detail(id), (data) =>
    data ? { ...data, ...patch } : data
  )
}

export function useQueueKeys() {
  const api = useApi()
  return {
    all: api.key(AUTOMATIONS_KEY, 'queue'),
    stats: api.key(AUTOMATIONS_KEY, 'queue', 'stats'),
    jobs: (params: {
      status: JobStatus | null
      page: number
      search: boolean
    }) => api.key(AUTOMATIONS_KEY, 'queue', 'jobs', params)
  }
}

const QUEUE_POLL_MS = 10_000

export function useQueueStatsQuery() {
  const api = useApi()
  const keys = useQueueKeys()
  return useQuery({
    queryKey: keys.stats,
    queryFn: ({ signal }) =>
      api.request<QueueStats>('/queue/stats', { signal }),
    enabled: api.ready,
    refetchInterval: QUEUE_POLL_MS
  })
}

/**
 * Lists jobs with the API's status filter and paging. A search loads the
 * most recent `JOBS_SEARCH_LIMIT` jobs instead and is filtered and paged by
 * the caller, because the API has no text search.
 */
export function useQueueJobsQuery(params: {
  status: JobStatus | null
  page: number
  search: boolean
}) {
  const api = useApi()
  const keys = useQueueKeys()
  const { status, search } = params
  const page = search ? 1 : params.page
  return useQuery({
    queryKey: keys.jobs({ status, page, search }),
    queryFn: ({ signal }): Promise<PageResult<QueueJob>> =>
      api
        .request<unknown>('/queue/jobs', {
          signal,
          query: {
            status,
            page,
            limit: search ? JOBS_SEARCH_LIMIT : JOBS_PAGE_SIZE,
            sort_by: 'created_at',
            sort_order: 'desc'
          }
        })
        .then(readPage<QueueJob>),
    enabled: api.ready,
    placeholderData: keepPreviousData,
    refetchInterval: search ? false : QUEUE_POLL_MS
  })
}
