'use client'

import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { useApi } from '@/api/client'
import { chatHref } from '@/components/shell/nav'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock, CopyButton, formatJson } from '@/components/ui/code'
import { Card, KeyValueList, type KeyValueItem } from '@/components/ui/data'
import { DetailPanel } from '@/components/ui/detail-panel'
import { ErrorState, LoadingRows } from '@/components/ui/states'
import { formatDateTime, formatDuration } from '@/lib/time'
import { cn } from '@/lib/utils'

import {
  COMPONENT_KIND_LABEL,
  MONITORING_KEY,
  parseDurationMs,
  resolveComponent,
  timeMs,
  type ComponentDirectory
} from './format'
import type {
  SpanType,
  TraceDetail,
  TraceNode,
  TraceStatus,
  TraceSummary
} from './types'

/* Shared bits ------------------------------------------------------------- */

export function traceStatusInfo(status: TraceStatus): {
  tone: BadgeTone
  label: string
} {
  if (status === 'OK') return { tone: 'ok', label: 'OK' }
  if (status === 'ERROR') return { tone: 'bad', label: 'Error' }
  const text = String(status || 'unknown').toLowerCase()
  return {
    tone: 'neutral',
    label: text.charAt(0).toUpperCase() + text.slice(1)
  }
}

export function TraceStatusBadge({
  status,
  children
}: {
  status: TraceStatus
  children?: string
}) {
  const info = traceStatusInfo(status)
  return (
    <Badge tone={info.tone} dot>
      {info.label}
      {children ? ` · ${children}` : null}
    </Badge>
  )
}

/** Duration in ms from start/end times, falling back to the server string. */
export function spanDurationMs(item: {
  start_time?: string
  end_time?: string
  duration: string
}): number | null {
  const start = timeMs(item.start_time)
  const end = timeMs(item.end_time)
  if (start !== null && end !== null && end >= start) return end - start
  return parseDurationMs(item.duration)
}

export function displayDuration(item: {
  start_time?: string
  end_time?: string
  duration: string
}): string {
  const ms = spanDurationMs(item)
  return ms === null ? item.duration || '—' : formatDuration(ms)
}

const SPAN_TYPES: Record<
  string,
  { label: string; badge: string; bar: string; mono: boolean }
> = {
  AGENT: {
    label: 'Agent',
    badge: 'bg-info-soft text-info',
    bar: 'bg-info',
    mono: false
  },
  TEAM: {
    label: 'Team',
    badge: 'bg-ok-soft text-ok',
    bar: 'bg-ok',
    mono: false
  },
  WORKFLOW: {
    label: 'Workflow',
    badge: 'bg-muted-soft text-fg-2',
    bar: 'bg-fg-3',
    mono: false
  },
  LLM: {
    label: 'LLM',
    badge: 'bg-accent-soft text-accent',
    bar: 'bg-accent',
    mono: true
  },
  TOOL: {
    label: 'Tool',
    badge: 'bg-warn-soft text-warn',
    bar: 'bg-warn',
    mono: true
  }
}

function spanTypeInfo(type: SpanType) {
  const known = SPAN_TYPES[String(type).toUpperCase()]
  if (known) return known
  const text = String(type || 'span').toLowerCase()
  return {
    label: text.charAt(0).toUpperCase() + text.slice(1),
    badge: 'bg-muted-soft text-fg-2',
    bar: 'bg-fg-3',
    mono: false
  }
}

function SpanTypeBadge({ type }: { type: SpanType }) {
  const info = spanTypeInfo(type)
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-[5px] px-1.5 text-xs font-semibold',
        info.badge
      )}
    >
      {info.label}
    </span>
  )
}

function formatClock(value: string | undefined, withMs = false): string {
  const ms = timeMs(value)
  if (ms === null) return '—'
  return dayjs(ms).format(withMs ? 'HH:mm:ss.SSS' : 'HH:mm:ss')
}

/* Span tree --------------------------------------------------------------- */

interface FlatSpan {
  node: TraceNode
  depth: number
  parentId: string | null
  hasChildren: boolean
  /** Position on the shared timeline, in percent. */
  left: number
  width: number
}

interface Timeline {
  start: number
  total: number
  usesTimes: boolean
}

function buildTimeline(trace: TraceDetail): Timeline {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  const visit = (nodes: TraceNode[]) => {
    for (const node of nodes) {
      const s = timeMs(node.start_time)
      const e = timeMs(node.end_time)
      if (s !== null) start = Math.min(start, s)
      if (e !== null) end = Math.max(end, e)
      if (node.spans) visit(node.spans)
    }
  }
  visit(trace.tree)
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return { start, total: end - start, usesTimes: true }
  }
  const longest = Math.max(
    0,
    spanDurationMs(trace) ?? 0,
    ...trace.tree.map((node) => spanDurationMs(node) ?? 0)
  )
  return { start: 0, total: longest, usesTimes: false }
}

function flattenTree(trace: TraceDetail, timeline: Timeline): FlatSpan[] {
  const out: FlatSpan[] = []
  const visit = (
    nodes: TraceNode[],
    depth: number,
    parentId: string | null,
    parentLeft: number
  ) => {
    for (const node of nodes) {
      const s = timeMs(node.start_time)
      const e = timeMs(node.end_time)
      let left = parentLeft
      let width = 0
      if (timeline.total > 0) {
        if (timeline.usesTimes && s !== null && e !== null && e >= s) {
          left = ((s - timeline.start) / timeline.total) * 100
          width = ((e - s) / timeline.total) * 100
        } else {
          width = ((spanDurationMs(node) ?? 0) / timeline.total) * 100
        }
      }
      left = Math.min(Math.max(left, 0), 100)
      width = Math.min(Math.max(width, 0.6), 100 - left)
      const children = node.spans ?? []
      out.push({
        node,
        depth,
        parentId,
        hasChildren: children.length > 0,
        left,
        width
      })
      if (children.length) visit(children, depth + 1, node.id, left)
    }
  }
  visit(trace.tree, 0, null, 0)
  return out
}

function SpanWaterfall({
  spans,
  timeline,
  selectedId,
  onSelect,
  defaultExpandedIds
}: {
  spans: FlatSpan[]
  timeline: Timeline
  selectedId: string | null
  onSelect: (id: string) => void
  defaultExpandedIds: Set<string>
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLDivElement>())

  const isExpanded = (span: FlatSpan) =>
    overrides[span.node.id] ??
    (span.depth < 2 || defaultExpandedIds.has(span.node.id))

  const visible: FlatSpan[] = []
  const hidden = new Set<string>()
  for (const span of spans) {
    if (span.parentId && hidden.has(span.parentId)) {
      hidden.add(span.node.id)
      continue
    }
    visible.push(span)
    if (span.hasChildren && !isExpanded(span)) hidden.add(span.node.id)
  }

  const tabStop =
    visible.find((span) => span.node.id === focusedId)?.node.id ??
    visible.find((span) => span.node.id === selectedId)?.node.id ??
    visible[0]?.node.id

  const setExpanded = (id: string, expanded: boolean) =>
    setOverrides((current) => ({ ...current, [id]: expanded }))

  const focusItem = (id: string | undefined) => {
    if (!id) return
    setFocusedId(id)
    itemRefs.current.get(id)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const span = visible[index]
    const expanded = span.hasChildren && isExpanded(span)
    let handled = true
    switch (event.key) {
      case 'ArrowDown':
        focusItem(visible[index + 1]?.node.id)
        break
      case 'ArrowUp':
        focusItem(visible[index - 1]?.node.id)
        break
      case 'Home':
        focusItem(visible[0]?.node.id)
        break
      case 'End':
        focusItem(visible[visible.length - 1]?.node.id)
        break
      case 'ArrowRight':
        if (span.hasChildren && !expanded) setExpanded(span.node.id, true)
        else if (expanded) focusItem(visible[index + 1]?.node.id)
        break
      case 'ArrowLeft':
        if (expanded) setExpanded(span.node.id, false)
        else if (span.parentId) focusItem(span.parentId)
        break
      case 'Enter':
      case ' ':
        onSelect(span.node.id)
        break
      default:
        handled = false
    }
    if (handled) event.preventDefault()
  }

  const ticks = [0, timeline.total / 2, timeline.total]

  return (
    <div className="flex flex-col gap-0.5">
      <div
        aria-hidden
        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-2 pb-1.5 text-xs text-fg-3 max-sm:hidden"
      >
        <span>Span</span>
        <span className="flex justify-between tabular-nums">
          {ticks.map((tick, index) => (
            <span key={index}>{index === 0 ? '0s' : formatDuration(tick)}</span>
          ))}
        </span>
      </div>
      <p id="span-tree-help" className="sr-only">
        Use the up and down arrow keys to move between spans, right and left to
        expand or collapse, and Enter to show a span’s details.
      </p>
      <div
        role="tree"
        aria-label="Span timeline"
        aria-describedby="span-tree-help"
        className="flex flex-col gap-0.5"
      >
        {visible.map((span, index) => {
          const { node } = span
          const info = spanTypeInfo(node.type)
          const expanded = span.hasChildren && isExpanded(span)
          const selected = node.id === selectedId
          const failed = node.status === 'ERROR'
          return (
            <div
              key={node.id}
              ref={(element) => {
                if (element) itemRefs.current.set(node.id, element)
                else itemRefs.current.delete(node.id)
              }}
              role="treeitem"
              aria-level={span.depth + 1}
              aria-expanded={span.hasChildren ? expanded : undefined}
              aria-selected={selected}
              tabIndex={node.id === tabStop ? 0 : -1}
              onClick={() => {
                setFocusedId(node.id)
                onSelect(node.id)
              }}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'grid min-h-[34px] cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-[7px] px-2 text-[13px] text-fg transition-colors outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent max-sm:grid-cols-1 max-sm:py-1.5',
                selected &&
                  'bg-accent-soft ring-1 ring-line-strong ring-inset hover:bg-accent-soft'
              )}
            >
              <span
                className="flex min-w-0 items-center gap-1.5"
                style={{ paddingLeft: Math.min(span.depth, 8) * 16 }}
              >
                {span.hasChildren ? (
                  <span
                    aria-hidden
                    onClick={(event) => {
                      event.stopPropagation()
                      setFocusedId(node.id)
                      setExpanded(node.id, !expanded)
                    }}
                    className="grid size-5 shrink-0 place-items-center rounded text-fg-3 hover:bg-hover hover:text-fg [&_svg]:size-4"
                  >
                    {expanded ? <ChevronDown /> : <ChevronRight />}
                  </span>
                ) : (
                  <span aria-hidden className="size-5 shrink-0" />
                )}
                <SpanTypeBadge type={node.type} />
                <span className={cn('truncate', info.mono && 'font-mono')}>
                  {node.name}
                </span>
                {failed ? (
                  <>
                    <CircleAlert
                      aria-hidden
                      className="size-3.5 shrink-0 text-bad"
                    />
                    <span className="sr-only">, failed</span>
                  </>
                ) : null}
                <span className="ml-auto shrink-0 pl-2 font-mono text-xs text-fg-3">
                  {displayDuration(node)}
                </span>
              </span>
              <span aria-hidden className="relative h-[18px]">
                {[25, 50, 75].map((position) => (
                  <span
                    key={position}
                    className="absolute inset-y-0 w-px bg-line"
                    style={{ left: `${position}%` }}
                  />
                ))}
                <span
                  className={cn(
                    'absolute top-1 h-2.5 min-w-1 rounded-[3px]',
                    failed ? 'bg-bad' : info.bar
                  )}
                  style={{ left: `${span.left}%`, width: `${span.width}%` }}
                />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* Span details ------------------------------------------------------------ */

function MetadataValue({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-fg-3">—</span>
  if (typeof value === 'object') {
    return (
      <code className="font-mono text-[12.5px] break-all whitespace-pre-wrap text-fg-2">
        {formatJson(value)}
      </code>
    )
  }
  if (typeof value === 'number')
    return <span className="font-mono">{value.toLocaleString()}</span>
  return <span className="break-words">{String(value)}</span>
}

function metadataItems(
  values: Record<string, unknown> | undefined
): KeyValueItem[] {
  if (!values) return []
  return Object.entries(values).map(([key, value]) => ({
    label: <span className="font-mono text-xs">{key}</span>,
    value: <MetadataValue value={value} />
  }))
}

function SpanDetail({
  node,
  isRoot,
  trace
}: {
  node: TraceNode
  isRoot: boolean
  trace: TraceDetail
}) {
  // The root span's input, output and error live on the trace itself.
  const input = isRoot ? (node.input ?? trace.input) : node.input
  const output = isRoot ? (node.output ?? trace.output) : node.output
  const error = isRoot ? (node.error ?? trace.error) : node.error
  const failed = node.status === 'ERROR'
  const info = spanTypeInfo(node.type)

  const meta = metadataItems(node.metadata)
  if (node.step_type) {
    meta.unshift({ label: 'Step type', value: node.step_type })
  }
  const extra = metadataItems(node.extra_data)

  return (
    <Card
      className="flex flex-col gap-3 bg-canvas p-3.5"
      aria-label={`Span details: ${node.name}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SpanTypeBadge type={node.type} />
        <span
          className={cn(
            'min-w-0 font-medium break-all text-fg',
            info.mono && 'font-mono'
          )}
        >
          {node.name}
        </span>
        <TraceStatusBadge status={node.status} />
        <span className="ml-auto font-mono text-xs text-fg-3">
          {formatClock(node.start_time, true)} →{' '}
          {formatClock(node.end_time, true)}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[10px] border border-bad bg-bad-soft px-3 py-2.5 text-[13px] text-bad"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words whitespace-pre-wrap">
            {error}
          </span>
        </div>
      ) : failed ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[10px] border border-bad bg-bad-soft px-3 py-2.5 text-[13px] text-bad"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>This span failed without an error message.</span>
        </div>
      ) : null}

      {input ? (
        <CodeBlock label="Input" code={formatJson(input)} maxHeight="16rem" />
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-fg-3">Input</span>
          <span className="text-[13px] text-fg-3">No input recorded.</span>
        </div>
      )}

      {output ? (
        <CodeBlock label="Output" code={formatJson(output)} maxHeight="16rem" />
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-fg-3">Output</span>
          <span className="text-[13px] text-fg-3">
            {failed
              ? 'No output. The span failed before returning a result.'
              : 'No output recorded.'}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-fg-3">Metadata</span>
        <KeyValueList
          items={[
            { label: 'Duration', value: displayDuration(node) },
            {
              label: 'Span ID',
              value: <span className="font-mono break-all">{node.id}</span>
            },
            ...meta
          ]}
        />
      </div>

      {extra.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-3">Extra data</span>
          <KeyValueList items={extra} />
        </div>
      ) : null}
    </Card>
  )
}

/* Trace body -------------------------------------------------------------- */

function findDefaultSpan(spans: FlatSpan[]): FlatSpan | undefined {
  return spans.find((span) => span.node.status === 'ERROR') ?? spans[0]
}

function ancestorIds(spans: FlatSpan[], id: string | undefined): Set<string> {
  const byId = new Map(spans.map((span) => [span.node.id, span]))
  const result = new Set<string>()
  let current = id ? byId.get(id) : undefined
  while (current?.parentId) {
    result.add(current.parentId)
    current = byId.get(current.parentId)
  }
  return result
}

function TraceBody({
  trace,
  directory
}: {
  trace: TraceDetail
  directory: ComponentDirectory
}) {
  const timeline = useMemo(() => buildTimeline(trace), [trace])
  const spans = useMemo(() => flattenTree(trace, timeline), [trace, timeline])
  const defaultSpan = findDefaultSpan(spans)
  const defaultExpandedIds = useMemo(
    () => ancestorIds(spans, defaultSpan?.node.id),
    [spans, defaultSpan?.node.id]
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    spans.find((span) => span.node.id === selectedId) ?? defaultSpan

  const component = resolveComponent(trace, directory)
  const failedSpans = spans.filter(
    (span) => span.node.status === 'ERROR'
  ).length
  const errorCount = Math.max(trace.error_count ?? 0, failedSpans)

  const details: KeyValueItem[] = [
    {
      label: 'Trace ID',
      value: (
        <span className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate font-mono" title={trace.trace_id}>
            {trace.trace_id}
          </span>
          <CopyButton
            value={trace.trace_id}
            aria-label="Copy trace ID"
            successMessage="Trace ID copied"
          />
        </span>
      )
    }
  ]
  if (trace.run_id) {
    details.push({
      label: 'Run ID',
      value: (
        <span className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate font-mono" title={trace.run_id}>
            {trace.run_id}
          </span>
          <CopyButton
            value={trace.run_id}
            aria-label="Copy run ID"
            successMessage="Run ID copied"
          />
        </span>
      )
    })
  }
  if (component) {
    details.push({
      label: 'Component',
      value: (
        <span className="flex flex-wrap items-center gap-2">
          <span className="break-words">{component.name}</span>
          <Badge>{COMPONENT_KIND_LABEL[component.kind]}</Badge>
        </span>
      )
    })
  }
  if (trace.session_id) {
    details.push({
      label: 'Session',
      value: (
        <span className="flex flex-wrap items-center gap-2">
          <span
            className="max-w-[220px] truncate font-mono"
            title={trace.session_id}
          >
            {trace.session_id}
          </span>
          {component ? (
            <Button size="sm" asChild>
              <Link
                href={chatHref(component.kind, component.id, trace.session_id)}
              >
                <MessageSquare aria-hidden />
                Open chat
              </Link>
            </Button>
          ) : null}
        </span>
      )
    })
  }
  if (trace.user_id) {
    details.push({
      label: 'User',
      value: <span className="font-mono break-all">{trace.user_id}</span>
    })
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
        {[
          {
            label: 'Duration',
            value: <span className="font-mono">{displayDuration(trace)}</span>
          },
          { label: 'Spans', value: trace.total_spans ?? spans.length },
          {
            label: 'Errors',
            value: (
              <span className={errorCount ? 'text-bad' : undefined}>
                {errorCount}
              </span>
            )
          },
          {
            label: 'Started',
            value: (
              <time
                dateTime={trace.start_time}
                title={formatDateTime(trace.start_time)}
                className="text-[13px]"
              >
                {formatClock(trace.start_time)}
              </time>
            )
          }
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex min-w-0 flex-col gap-0.5 rounded-[10px] border border-line bg-canvas px-2.5 py-2"
          >
            <span className="text-xs text-fg-3">{stat.label}</span>
            <span className="truncate text-sm font-semibold tabular-nums">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <KeyValueList
        items={details}
        className="sm:grid-cols-[96px_minmax(0,1fr)]"
      />

      <div className="h-px bg-line" />

      {spans.length ? (
        <>
          <SpanWaterfall
            spans={spans}
            timeline={timeline}
            selectedId={selected?.node.id ?? null}
            onSelect={setSelectedId}
            defaultExpandedIds={defaultExpandedIds}
          />
          {selected ? (
            <SpanDetail
              node={selected.node}
              isRoot={selected.depth === 0}
              trace={trace}
            />
          ) : null}
        </>
      ) : (
        <p className="text-[13px] text-fg-3">
          This trace has no recorded spans.
        </p>
      )}
    </>
  )
}

/* Panel ------------------------------------------------------------------- */

export function TraceDetailPanel({
  traceId,
  summary,
  directory,
  onClose
}: {
  traceId: string
  /** Row from the list, shown in the header while the detail loads. */
  summary?: TraceSummary
  directory: ComponentDirectory
  onClose: () => void
}) {
  const api = useApi()
  const detail = useQuery({
    queryKey: api.key(MONITORING_KEY, 'trace', traceId),
    queryFn: ({ signal }) =>
      api.request<TraceDetail>(`/traces/${encodeURIComponent(traceId)}`, {
        signal
      }),
    enabled: api.ready
  })

  const header = detail.data ?? summary
  const component = header ? resolveComponent(header, directory) : null
  const errorCount = header?.error_count ?? 0

  return (
    <DetailPanel
      aria-label="Trace details"
      title={header?.name ?? 'Trace'}
      backLabel="All traces"
      onClose={onClose}
      subtitle={
        header ? (
          <>
            <TraceStatusBadge status={header.status}>
              {errorCount
                ? `${errorCount} failed ${errorCount === 1 ? 'span' : 'spans'}`
                : undefined}
            </TraceStatusBadge>
            {component ? (
              <Badge>{COMPONENT_KIND_LABEL[component.kind]}</Badge>
            ) : null}
          </>
        ) : null
      }
    >
      {detail.isPending ? (
        <LoadingRows rows={6} label="Loading trace" />
      ) : detail.isError ? (
        <ErrorState
          title="Couldn't load this trace"
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      ) : (
        <TraceBody trace={detail.data} directory={directory} />
      )}
    </DetailPanel>
  )
}
