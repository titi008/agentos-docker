'use client'

import { useCallback, useMemo } from 'react'

import { useStore } from '@/store'

/**
 * Error raised for any failed AgentOS request. `status` is 0 when the server
 * could not be reached at all (network error, CORS, wrong host).
 */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string | null
  readonly url: string

  constructor(status: number, detail: string | null, url: string) {
    super(detail ? `${status || 'Network'} error: ${detail}` : `Request failed`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.url = url
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }

  /** The token was accepted but lacks the permission (scope) this request needs. */
  get isForbidden(): boolean {
    return this.status === 403
  }
}

/** True when the server accepted the token but refused the request (403). */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.isForbidden
}

export interface ApiContext {
  endpoint: string
  authToken: string
  userId: string
}

type QueryValue = string | number | boolean | null | undefined

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, QueryValue | QueryValue[]>
  /** JSON request body. */
  json?: unknown
  /** Multipart request body (sets no Content-Type so the browser adds the boundary). */
  formData?: FormData
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Send the operator's user id as `X-User-Id`. Defaults to true. */
  withUser?: boolean
  /** Paths to try in order when the server answers 404 (e.g. `/api/pricing` then `/pricing`). */
  fallbackPaths?: string[]
}

export const normalizeEndpoint = (endpoint: string): string =>
  endpoint.trim().replace(/\/+$/, '')

export function buildUrl(
  endpoint: string,
  path: string,
  query?: ApiRequestOptions['query']
): string {
  const url = new URL(`${normalizeEndpoint(endpoint)}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      const values = Array.isArray(value) ? value : [value]
      for (const item of values) {
        if (item === undefined || item === null || item === '') continue
        url.searchParams.append(key, String(item))
      }
    }
  }
  return url.toString()
}

async function readErrorDetail(response: Response): Promise<string | null> {
  const text = await response.text().catch(() => '')
  if (!text) return response.statusText || null
  try {
    const body = JSON.parse(text) as unknown
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        return detail
          .map((item) =>
            item && typeof item === 'object' && 'msg' in item
              ? String((item as { msg: unknown }).msg)
              : JSON.stringify(item)
          )
          .join('; ')
      }
      return JSON.stringify(detail)
    }
    if (body && typeof body === 'object' && 'message' in body) {
      return String((body as { message: unknown }).message)
    }
  } catch {
    // Not JSON; fall through to the raw text.
  }
  return text.length > 300 ? `${text.slice(0, 300)}…` : text
}

export async function apiRequest<T>(
  ctx: ApiContext,
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    query,
    json,
    formData,
    signal,
    headers: extraHeaders,
    withUser = true,
    fallbackPaths = []
  } = options

  const headers: Record<string, string> = { ...extraHeaders }
  if (ctx.authToken) headers.Authorization = `Bearer ${ctx.authToken}`
  if (withUser && ctx.userId) headers['X-User-Id'] = ctx.userId
  if (json !== undefined) headers['Content-Type'] = 'application/json'

  const paths = [path, ...fallbackPaths]
  for (let index = 0; index < paths.length; index += 1) {
    let url: string
    try {
      url = buildUrl(ctx.endpoint, paths[index], query)
    } catch {
      throw new ApiError(0, 'The AgentOS host URL is not valid', ctx.endpoint)
    }
    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        signal,
        body:
          formData ?? (json !== undefined ? JSON.stringify(json) : undefined)
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      throw new ApiError(0, 'Could not reach the AgentOS server', url)
    }

    if (response.status === 404 && index < paths.length - 1) continue

    if (!response.ok) {
      throw new ApiError(response.status, await readErrorDetail(response), url)
    }

    if (response.status === 204) return undefined as T
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      return (await response.json()) as T
    }
    return (await response.text()) as T
  }
  // Unreachable: the loop either returns or throws.
  throw new ApiError(404, 'Not found', path)
}

/** Accepts the list shapes AgentOS endpoints return: `[]`, `{data: []}`, `{items: []}` or a named key. */
export function unwrapList<T>(value: unknown, key?: string): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (key && Array.isArray(record[key])) return record[key] as T[]
    if (Array.isArray(record.data)) return record.data as T[]
    if (Array.isArray(record.items)) return record.items as T[]
  }
  return []
}

/** Human-readable message for any error thrown by the API layer. */
/** Ends server text with a full stop so it reads as a sentence after ours. */
function asSentence(text: string): string {
  const trimmed = text.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

export function getErrorMessage(error: unknown, endpoint?: string): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) {
      const host = endpoint ? normalizeEndpoint(endpoint) : 'the AgentOS server'
      return `Can't reach ${host}. Check that AgentOS is running and the host in Settings is correct.`
    }
    if (error.isForbidden) {
      const reason = error.detail ? ` ${asSentence(error.detail)}` : ''
      return `Your auth token doesn't have permission for this (403).${reason}`
    }
    if (error.isAuthError) {
      return `The server rejected the auth token (${error.status}). Check the token in Settings.`
    }
    return error.detail
      ? `The server returned ${error.status}: ${error.detail}`
      : `The server returned ${error.status}.`
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

/**
 * Request helper bound to the current connection. `key(...)` builds a
 * TanStack Query key scoped to the endpoint and user, so switching either
 * refetches everything automatically.
 */
export function useApi() {
  const hydrated = useStore((state) => state.hydrated)
  const endpointResolved = useStore((state) => state.endpointResolved)
  const endpoint = useStore((state) => state.selectedEndpoint)
  const authToken = useStore((state) => state.authToken)
  const userId = useStore((state) => state.userId)

  const ctx = useMemo<ApiContext>(
    () => ({ endpoint: normalizeEndpoint(endpoint), authToken, userId }),
    [endpoint, authToken, userId]
  )

  const request = useCallback(
    <T>(path: string, options?: ApiRequestOptions) =>
      apiRequest<T>(ctx, path, options),
    [ctx]
  )

  const key = useCallback(
    (...parts: unknown[]) => ['agentos', ctx.endpoint, ctx.userId, ...parts],
    [ctx.endpoint, ctx.userId]
  )

  return {
    ctx,
    // Wait for the host (saved, or the deployment default) so nothing is sent to a placeholder.
    ready: hydrated && endpointResolved && Boolean(ctx.endpoint),
    request,
    key
  }
}
