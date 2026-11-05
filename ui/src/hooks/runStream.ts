import { ApiError, buildUrl, type ApiContext } from '@/api/client'
import type { RunEventPayload } from '@/types/os'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Normalises one decoded event. AgentOS sends the event name both as the SSE
 * `event:` field and inside the JSON; some proxies wrap the payload as
 * `{ event, data }`.
 */
function toRunEvent(
  payload: unknown,
  eventName: string | null
): RunEventPayload | null {
  if (!isRecord(payload)) return null
  let record = payload
  if (
    typeof record.event === 'string' &&
    'data' in record &&
    Object.keys(record).length === 2
  ) {
    let inner: unknown = record.data
    if (typeof inner === 'string') {
      try {
        inner = JSON.parse(inner)
      } catch {
        inner = {}
      }
    }
    record = { ...(isRecord(inner) ? inner : {}), event: record.event }
  }
  const event =
    typeof record.event === 'string' && record.event ? record.event : eventName
  if (!event) return null
  return { ...record, event } as RunEventPayload
}

/** Parses complete SSE blocks from `buffer`; returns the unparsed remainder. */
function drainBuffer(
  buffer: string,
  onEvent: (event: RunEventPayload) => void
): string {
  const blocks = buffer.split(/\r?\n\r?\n/)
  const rest = blocks.pop() ?? ''
  for (const block of blocks) parseBlock(block, onEvent)
  return rest
}

function parseBlock(block: string, onEvent: (event: RunEventPayload) => void) {
  const trimmed = block.trim()
  if (!trimmed) return
  let eventName: string | null = null
  const data: string[] = []
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
    else if (line.startsWith('{')) data.push(line)
  }
  if (data.length === 0) return
  try {
    const event = toRunEvent(JSON.parse(data.join('\n')), eventName)
    if (event) onEvent(event)
  } catch {
    // A malformed event is skipped; the rest of the stream still renders.
  }
}

async function readError(response: Response, url: string): Promise<ApiError> {
  const text = await response.text().catch(() => '')
  let detail: string | null = text || response.statusText || null
  try {
    const body = JSON.parse(text) as unknown
    if (isRecord(body) && typeof body.detail === 'string') detail = body.detail
    else if (isRecord(body) && body.detail !== undefined)
      detail = JSON.stringify(body.detail)
  } catch {
    // Not JSON; keep the raw text.
  }
  if (detail && detail.length > 300) detail = `${detail.slice(0, 300)}…`
  return new ApiError(response.status, detail, url)
}

export interface StreamRunOptions {
  ctx: ApiContext
  /** e.g. `/agents/{id}/runs` */
  path: string
  body: FormData
  headers?: Record<string, string>
  signal: AbortSignal
  onEvent: (event: RunEventPayload) => void
}

/**
 * POSTs a run and feeds each server-sent event to `onEvent` until the stream
 * ends. Throws ApiError for HTTP and network failures and rethrows the
 * AbortError when `signal` aborts.
 */
export async function streamRun({
  ctx,
  path,
  body,
  headers: extraHeaders,
  signal,
  onEvent
}: StreamRunOptions): Promise<void> {
  const url = buildUrl(ctx.endpoint, path)
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    ...extraHeaders
  }
  if (ctx.authToken) headers.Authorization = `Bearer ${ctx.authToken}`
  if (ctx.userId) headers['X-User-Id'] = ctx.userId

  let response: Response
  try {
    response = await fetch(url, { method: 'POST', headers, body, signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(0, 'Could not reach the AgentOS server', url)
  }
  if (!response.ok) throw await readError(response, url)
  if (!response.body) throw new ApiError(response.status, 'Empty response', url)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer = drainBuffer(
      buffer + decoder.decode(value, { stream: true }),
      onEvent
    )
  }
  parseBlock(buffer + decoder.decode(), onEvent)
}
