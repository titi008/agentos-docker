'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { unwrapList, useApi, type ApiRequestOptions } from '@/api/client'

import type { Product, Project, Task, WikiPage, WikiPageMeta } from './types'

/** Query-key root for products, projects, tasks and the wiki. */
export const COMPANY_KEY = 'company'

const PAGE_SIZE = 500
/** Safety stop so a misbehaving server can never page forever. */
const MAX_PAGES = 40

type RequestFn = <T>(path: string, options?: ApiRequestOptions) => Promise<T>

function totalCount(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const meta = (value as { meta?: { total_count?: unknown } }).meta
  return typeof meta?.total_count === 'number' ? meta.total_count : null
}

/** Reads every page of a paginated Company list endpoint. */
async function fetchAllPages<T>(
  request: RequestFn,
  path: string,
  query: ApiRequestOptions['query'],
  signal: AbortSignal
): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await request<unknown>(path, {
      query: { ...query, limit: PAGE_SIZE, page },
      signal
    })
    const rows = unwrapList<T>(response)
    items.push(...rows)
    const total = totalCount(response)
    if (rows.length < PAGE_SIZE || (total !== null && items.length >= total)) {
      break
    }
  }
  return items
}

/** Encodes each segment of a wiki path, keeping the slashes. */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/** Wiki base path for a scope: the company wiki, or one product's wiki. */
export function wikiBase(productId: string | null): string {
  return productId
    ? `/company/products/${encodeURIComponent(productId)}/wiki`
    : '/company/wiki'
}

export function useCompanyKeys() {
  const { key } = useApi()
  return useMemo(
    () => ({
      work: () => key(COMPANY_KEY, 'work'),
      products: () => key(COMPANY_KEY, 'work', 'products'),
      projects: () => key(COMPANY_KEY, 'work', 'projects'),
      tasks: (productId: string | null) =>
        key(COMPANY_KEY, 'work', 'tasks', productId ?? 'all'),
      task: (taskId: string) => key(COMPANY_KEY, 'work', 'task', taskId),
      wikiPages: (productId: string | null) =>
        key(COMPANY_KEY, 'wiki', productId ?? 'company', 'pages'),
      wikiPage: (productId: string | null, path: string) =>
        key(COMPANY_KEY, 'wiki', productId ?? 'company', 'page', path)
    }),
    [key]
  )
}

/** Products, oldest first so declared products lead the list. */
export function useProductsQuery() {
  const api = useApi()
  const keys = useCompanyKeys()
  return useQuery({
    queryKey: keys.products(),
    queryFn: ({ signal }) =>
      fetchAllPages<Product>(
        api.request,
        '/company/products',
        { sort_by: 'created_at', sort_order: 'asc' },
        signal
      ),
    enabled: api.ready
  })
}

export function useProjectsQuery() {
  const api = useApi()
  const keys = useCompanyKeys()
  return useQuery({
    queryKey: keys.projects(),
    queryFn: ({ signal }) =>
      fetchAllPages<Project>(
        api.request,
        '/company/projects',
        { sort_by: 'created_at', sort_order: 'asc' },
        signal
      ),
    enabled: api.ready
  })
}

/** Tasks of one product (server-side filter), or of every product. */
export function useTasksQuery(
  productId: string | null,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const api = useApi()
  const keys = useCompanyKeys()
  return useQuery({
    queryKey: keys.tasks(productId),
    queryFn: ({ signal }) =>
      fetchAllPages<Task>(
        api.request,
        '/company/tasks',
        {
          product_id: productId ?? undefined,
          sort_by: 'created_at',
          sort_order: 'desc'
        },
        signal
      ),
    enabled: api.ready && enabled,
    // Company Manager and runs move tasks in the background.
    refetchInterval: 30_000
  })
}

export function useTaskQuery(taskId: string | null, placeholder?: Task) {
  const api = useApi()
  const keys = useCompanyKeys()
  return useQuery({
    queryKey: keys.task(taskId ?? ''),
    queryFn: ({ signal }) =>
      api.request<Task>(`/company/tasks/${encodeURIComponent(taskId ?? '')}`, {
        signal
      }),
    enabled: api.ready && Boolean(taskId),
    placeholderData: placeholder,
    refetchInterval: 30_000
  })
}

export function useWikiPagesQuery(productId: string | null) {
  const api = useApi()
  const keys = useCompanyKeys()
  return useQuery({
    queryKey: keys.wikiPages(productId),
    queryFn: ({ signal }) =>
      fetchAllPages<WikiPageMeta>(
        api.request,
        wikiBase(productId),
        undefined,
        signal
      ),
    enabled: api.ready
  })
}

export function fetchWikiPage(
  request: RequestFn,
  productId: string | null,
  path: string,
  signal?: AbortSignal
): Promise<WikiPage> {
  return request<WikiPage>(`${wikiBase(productId)}/${encodePath(path)}`, {
    signal
  })
}

export function useWikiPageQuery(
  productId: string | null,
  path: string | null
) {
  const api = useApi()
  const keys = useCompanyKeys()
  return useQuery({
    queryKey: keys.wikiPage(productId, path ?? ''),
    queryFn: ({ signal }) =>
      fetchWikiPage(api.request, productId, path ?? '', signal),
    enabled: api.ready && Boolean(path)
  })
}

/** Refreshes products, projects and tasks (counts change with every task write). */
export function useInvalidateWork() {
  const queryClient = useQueryClient()
  const keys = useCompanyKeys()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: keys.work() }),
    [queryClient, keys]
  )
}
