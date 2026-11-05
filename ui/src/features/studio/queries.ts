'use client'

import {
  useQueries,
  useQuery,
  useQueryClient,
  type QueryKey
} from '@tanstack/react-query'
import { useCallback } from 'react'

import { ApiError, unwrapList, useApi } from '@/api/client'
import { WORKSPACE_KEY, useHealthQuery } from '@/features/workspace/queries'

import { FALLBACK_MODELS, isRecord, parseModelList } from './lib'
import type {
  ConfigVersion,
  ModelList,
  RegistryResource,
  StudioComponent,
  StudioKind,
  WorkflowDetail
} from './types'

/** Query-key root for everything the Studio loads besides the workspace lists. */
export const STUDIO_KEY = 'studio'

/** Largest page the components and registry routes accept. */
const PAGE_LIMIT = 100
/** Safety stop so a misbehaving server cannot make us page forever. */
const MAX_PAGES = 50

type Request = ReturnType<typeof useApi>['request']

function totalPages(value: unknown): number {
  if (!isRecord(value) || !isRecord(value.meta)) return 1
  const pages = value.meta.total_pages
  return typeof pages === 'number' && pages > 0 ? pages : 1
}

/** Loads every page of a paginated (`{ data, meta }`) list route. */
async function fetchAllPages<T>(
  request: Request,
  path: string,
  query: Record<string, string>,
  signal: AbortSignal
): Promise<T[]> {
  const page = (number: number) =>
    request<unknown>(path, {
      query: { ...query, page: number, limit: PAGE_LIMIT },
      signal
    })
  const first = await page(1)
  const pages = Math.min(totalPages(first), MAX_PAGES)
  const rest =
    pages > 1
      ? await Promise.all(
          Array.from({ length: pages - 1 }, (_, index) => page(index + 2))
        )
      : []
  return [first, ...rest].flatMap((value) => unwrapList<T>(value))
}

function useConnected(): boolean {
  return useHealthQuery().status === 'success'
}

/** Every Studio component of one type, drafts included (all pages). */
export function useComponentsQuery(kind: StudioKind) {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(STUDIO_KEY, 'components', kind),
    queryFn: ({ signal }) =>
      fetchAllPages<StudioComponent>(
        api.request,
        '/components',
        { component_type: kind },
        signal
      ),
    enabled: api.ready && connected
  })
}

/** Every registry resource (all pages). */
export function useRegistryQuery() {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(STUDIO_KEY, 'registry'),
    queryFn: ({ signal }) =>
      fetchAllPages<RegistryResource>(api.request, '/registry', {}, signal),
    enabled: api.ready && connected,
    staleTime: 60_000
  })
}

/**
 * The server's model palette (`GET /api/models`, then `/models`). Falls back
 * to the default list, flagged with `fromServer: false`, when neither answers.
 */
export function useModelsQuery() {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(STUDIO_KEY, 'models'),
    queryFn: async ({ signal }): Promise<ModelList> => {
      try {
        const value = await api.request<unknown>('/api/models', {
          signal,
          fallbackPaths: ['/models']
        })
        const models = parseModelList(value)
        if (models.length) return { models, fromServer: true }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          throw error
      }
      return { models: FALLBACK_MODELS, fromServer: false }
    },
    enabled: api.ready && connected,
    staleTime: 5 * 60_000
  })
}

export function useComponentQuery(componentId: string) {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(STUDIO_KEY, 'component', componentId),
    queryFn: ({ signal }) =>
      api.request<StudioComponent>(
        `/components/${encodeURIComponent(componentId)}`,
        { signal }
      ),
    enabled: api.ready && connected && Boolean(componentId)
  })
}

export function useComponentConfigsQuery(componentId: string) {
  const api = useApi()
  const connected = useConnected()
  return useQuery({
    queryKey: api.key(STUDIO_KEY, 'component', componentId, 'configs'),
    queryFn: ({ signal }) =>
      api
        .request<unknown>(
          `/components/${encodeURIComponent(componentId)}/configs`,
          { signal }
        )
        .then((value) =>
          unwrapList<ConfigVersion>(value).sort((a, b) => b.version - a.version)
        ),
    enabled: api.ready && connected && Boolean(componentId)
  })
}

function workflowDetailOptions(
  api: ReturnType<typeof useApi>,
  enabled: boolean,
  workflowId: string
) {
  return {
    queryKey: api.key(STUDIO_KEY, 'workflow', workflowId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.request<WorkflowDetail>(
        `/workflows/${encodeURIComponent(workflowId)}`,
        { signal }
      ),
    enabled,
    staleTime: 60_000
  }
}

/** Step details for several workflows; cards use them for step counts. */
export function useWorkflowDetailQueries(workflowIds: string[]) {
  const api = useApi()
  const connected = useConnected()
  return useQueries({
    queries: workflowIds.map((id) =>
      workflowDetailOptions(api, api.ready && connected, id)
    )
  })
}

export function useWorkflowDetailQuery(workflowId: string | null) {
  const api = useApi()
  const connected = useConnected()
  return useQuery(
    workflowDetailOptions(
      api,
      api.ready && connected && Boolean(workflowId),
      workflowId ?? ''
    )
  )
}

/** Refreshes everything a Studio create, publish or delete can change. */
export function useInvalidateStudio() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useCallback(
    (componentId?: string) => {
      const keys: QueryKey[] = [
        api.key(STUDIO_KEY, 'components'),
        api.key(STUDIO_KEY, 'workflow'),
        api.key(WORKSPACE_KEY)
      ]
      if (componentId) keys.push(api.key(STUDIO_KEY, 'component', componentId))
      return Promise.all(
        keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
    },
    [api, queryClient]
  )
}

/** True for a 404 from the API (missing or archived component). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
