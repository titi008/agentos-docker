'use client'

import {
  keepPreviousData,
  useIsFetching,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight, Layers, X } from 'lucide-react'
import Link from 'next/link'
import {
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates
} from 'nuqs'
import { useEffect, useRef, useState } from 'react'

import { useApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/badge'
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/data'
import { SearchInput, Select } from '@/components/ui/input'
import { PageBody, SplitLayout, SplitMain } from '@/components/ui/page'
import { SegmentedControl } from '@/components/ui/segmented'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'

import {
  COMPONENT_KIND_LABEL,
  MONITORING_KEY,
  decodeComponent,
  encodeComponent,
  resolveComponent,
  toPaginated,
  type ComponentDirectory,
  type ComponentKind
} from './format'
import { MonitoringHeader } from './MonitoringHeader'
import {
  TraceDetailPanel,
  TraceStatusBadge,
  displayDuration
} from './TraceDetailPanel'
import type { Paginated, TraceSummary } from './types'

const PAGE_SIZE = 20

const STATUS_FILTERS = ['all', 'ok', 'error'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const TIME_RANGES = ['any', '1h', '24h', '7d', '30d'] as const
type TimeRange = (typeof TIME_RANGES)[number]

const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  any: 'Any time',
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days'
}

const TIME_RANGE_MS: Record<Exclude<TimeRange, 'any'>, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000
}

const traceParams = {
  q: parseAsString.withDefault(''),
  status: parseAsStringLiteral(STATUS_FILTERS).withDefault('all'),
  component: parseAsString.withDefault(''),
  range: parseAsStringLiteral(TIME_RANGES).withDefault('any'),
  page: parseAsInteger.withDefault(1),
  run_id: parseAsString,
  trace: parseAsString
}

type TraceParamValues = inferParserType<typeof traceParams>
type ParamUpdate = Partial<{
  [K in keyof TraceParamValues]: TraceParamValues[K] | null
}>

interface TraceFilters {
  q: string
  status: StatusFilter
  component: { kind: ComponentKind; id: string } | null
  range: TimeRange
  page: number
  runId: string | null
}

type FilterExpr =
  | { op: 'EQ' | 'CONTAINS' | 'STARTSWITH' | 'GTE'; key: string; value: string }
  | { op: 'AND' | 'OR'; conditions: FilterExpr[] }

type Request = ReturnType<typeof useApi>['request']

/**
 * Lists traces with server-side filters and pagination. A search term goes
 * through POST /traces/search (name contains the term, or an ID starts with
 * it); the plain list uses GET /traces query parameters.
 */
async function fetchTraces(
  request: Request,
  filters: TraceFilters,
  signal: AbortSignal
): Promise<Paginated<TraceSummary>> {
  const startTime =
    filters.range === 'any'
      ? null
      : new Date(Date.now() - TIME_RANGE_MS[filters.range]).toISOString()
  const status = filters.status === 'all' ? null : filters.status.toUpperCase()
  const componentKey = filters.component ? `${filters.component.kind}_id` : null
  const search = filters.q.trim()

  if (!search) {
    const query: Record<string, string | number | null> = {
      page: filters.page,
      limit: PAGE_SIZE,
      status,
      run_id: filters.runId,
      start_time: startTime
    }
    if (componentKey && filters.component)
      query[componentKey] = filters.component.id
    return toPaginated<TraceSummary>(
      await request<unknown>('/traces', { signal, query })
    )
  }

  const conditions: FilterExpr[] = [
    {
      op: 'OR',
      conditions: [
        { op: 'CONTAINS', key: 'name', value: search },
        { op: 'STARTSWITH', key: 'trace_id', value: search },
        { op: 'STARTSWITH', key: 'run_id', value: search },
        { op: 'STARTSWITH', key: 'session_id', value: search }
      ]
    }
  ]
  if (status) conditions.push({ op: 'EQ', key: 'status', value: status })
  if (componentKey && filters.component)
    conditions.push({
      op: 'EQ',
      key: componentKey,
      value: filters.component.id
    })
  if (filters.runId)
    conditions.push({ op: 'EQ', key: 'run_id', value: filters.runId })
  if (startTime)
    conditions.push({ op: 'GTE', key: 'start_time', value: startTime })

  return toPaginated<TraceSummary>(
    await request<unknown>('/traces/search', {
      method: 'POST',
      signal,
      json: {
        filter:
          conditions.length === 1 ? conditions[0] : { op: 'AND', conditions },
        group_by: 'run',
        page: filters.page,
        limit: PAGE_SIZE
      }
    })
  )
}

/** Search box that updates the URL 300 ms after typing stops. */
function TraceSearch({
  value,
  onCommit
}: {
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [committed, setCommitted] = useState(value)
  const timer = useRef<number | undefined>(undefined)

  // The URL changed from elsewhere (back button, cleared filters).
  if (value !== committed) {
    setCommitted(value)
    setDraft(value)
  }

  useEffect(() => {
    const pending = timer
    return () => window.clearTimeout(pending.current)
  }, [])

  const commit = (next: string) => {
    window.clearTimeout(timer.current)
    setCommitted(next)
    onCommit(next)
  }

  return (
    <div className="min-w-[180px] flex-[1_1_220px]">
      <label htmlFor="trace-search" className="sr-only">
        Search traces by name or ID
      </label>
      <SearchInput
        id="trace-search"
        placeholder="Search by name or ID"
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => commit(next), 300)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(draft)
        }}
      />
    </div>
  )
}

function formatStartClock(value: string): string {
  const date = dayjs(value)
  if (!date.isValid()) return ''
  return date.isSame(dayjs(), 'day')
    ? date.format('HH:mm:ss')
    : date.format('MMM D, HH:mm')
}

function TraceRow({
  trace,
  directory,
  selected,
  onOpen
}: {
  trace: TraceSummary
  directory: ComponentDirectory
  selected: boolean
  onOpen: (traceId: string) => void
}) {
  const component = resolveComponent(trace, directory)
  const errors = trace.error_count ?? 0
  return (
    <Tr
      selected={selected}
      onClick={() => onOpen(trace.trace_id)}
      className="cursor-pointer"
    >
      <Td>
        <TraceStatusBadge status={trace.status} />
      </Td>
      <Td className="max-w-[340px]">
        <div className="flex min-w-0 flex-col gap-px">
          <button
            type="button"
            aria-label={`Open trace: ${trace.name}`}
            aria-current={selected ? 'true' : undefined}
            onClick={(event) => {
              event.stopPropagation()
              onOpen(trace.trace_id)
            }}
            className="w-fit max-w-full truncate rounded text-left font-medium text-fg hover:underline"
          >
            {trace.name}
          </button>
          <span className="truncate text-[12.5px] text-fg-3">
            {trace.input || 'No input recorded'}
          </span>
        </div>
      </Td>
      <Td className="max-w-[200px]">
        {component ? (
          <div className="flex min-w-0 flex-col gap-px">
            <span className="truncate">{component.name}</span>
            <span className="text-xs text-fg-3">
              {COMPONENT_KIND_LABEL[component.kind]}
            </span>
          </div>
        ) : (
          <span className="text-fg-3">—</span>
        )}
      </Td>
      <Td className="font-mono whitespace-nowrap">{displayDuration(trace)}</Td>
      <Td>
        <div className="flex flex-col gap-px whitespace-nowrap">
          <span className="tabular-nums">{trace.total_spans ?? 0}</span>
          <span className={cn('text-xs', errors ? 'text-bad' : 'text-fg-3')}>
            {errors
              ? `${errors} ${errors === 1 ? 'error' : 'errors'}`
              : 'No errors'}
          </span>
        </div>
      </Td>
      <Td>
        <div className="flex flex-col gap-px whitespace-nowrap">
          <RelativeTime value={trace.start_time || trace.created_at} />
          <span className="font-mono text-xs text-fg-3">
            {formatStartClock(trace.start_time || trace.created_at)}
          </span>
        </div>
      </Td>
    </Tr>
  )
}

export function TracesView() {
  const api = useApi()
  const qc = useQueryClient()
  const agents = useStore((state) => state.agents)
  const teams = useStore((state) => state.teams)
  const workflows = useStore((state) => state.workflows)
  const directory: ComponentDirectory = { agents, teams, workflows }

  const [params, setParams] = useQueryStates(traceParams, {
    history: 'replace'
  })
  // A run deep link (?run_id=) opens its trace once; closing it keeps the list.
  const [dismissedRun, setDismissedRun] = useState<string | null>(null)

  const filters: TraceFilters = {
    q: params.q,
    status: params.status,
    component: decodeComponent(params.component),
    range: params.range,
    page: Math.max(1, params.page),
    runId: params.run_id
  }

  const list = useQuery({
    queryKey: api.key(MONITORING_KEY, 'traces', filters),
    queryFn: ({ signal }) => fetchTraces(api.request, filters, signal),
    enabled: api.ready,
    placeholderData: keepPreviousData
  })
  const detailFetching =
    useIsFetching({ queryKey: api.key(MONITORING_KEY, 'trace') }) > 0

  const rows = list.data?.data ?? []
  const meta = list.data?.meta
  const autoTraceId =
    params.run_id &&
    params.run_id !== dismissedRun &&
    !list.isPlaceholderData &&
    rows.length === 1
      ? rows[0].trace_id
      : null
  const selectedId = params.trace ?? autoTraceId
  const selectedSummary = rows.find((row) => row.trace_id === selectedId)

  const filtered =
    Boolean(filters.q.trim()) ||
    filters.status !== 'all' ||
    Boolean(filters.component) ||
    filters.range !== 'any' ||
    Boolean(filters.runId)

  const setFilter = (next: ParamUpdate) =>
    void setParams({ ...next, page: null })

  const clearFilters = () =>
    void setParams({
      q: null,
      status: null,
      component: null,
      range: null,
      page: null,
      run_id: null
    })

  const openTrace = (traceId: string) =>
    void setParams({ trace: traceId }, { history: 'push' })

  const closeTrace = () => {
    if (params.run_id) setDismissedRun(params.run_id)
    void setParams({ trace: null })
  }

  const refresh = () => {
    void list.refetch()
    if (selectedId) {
      void qc.invalidateQueries({
        queryKey: api.key(MONITORING_KEY, 'trace', selectedId)
      })
    }
  }

  const selectedComponent = params.component
  const knownIds: Record<ComponentKind, string[]> = {
    agent: agents.map((agent) => agent.id),
    team: teams.map((team) => team.id),
    workflow: workflows.map((workflow) => workflow.id)
  }
  const componentKnown =
    !filters.component ||
    knownIds[filters.component.kind].includes(filters.component.id)

  const page = filters.page
  const totalCount = meta?.total_count ?? rows.length
  const totalPages = meta?.total_pages ?? 1
  const firstIndex = rows.length
    ? (page - 1) * (meta?.limit ?? PAGE_SIZE) + 1
    : 0
  const lastIndex = rows.length ? firstIndex + rows.length - 1 : 0

  return (
    <>
      <MonitoringHeader
        onRefresh={refresh}
        refreshing={list.isFetching || detailFetching}
      />
      <SplitLayout>
        <SplitMain>
          <PageBody className="gap-4">
            <div
              role="search"
              aria-label="Filter traces"
              className="flex flex-wrap items-center gap-2"
            >
              <TraceSearch
                value={params.q}
                onCommit={(q) => setFilter({ q: q || null })}
              />
              <SegmentedControl
                aria-label="Status"
                value={params.status}
                onChange={(status) => setFilter({ status })}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'ok', label: 'OK' },
                  { value: 'error', label: 'Error' }
                ]}
              />
              <label htmlFor="trace-component" className="sr-only">
                Component
              </label>
              <Select
                id="trace-component"
                className="w-[200px] max-sm:w-full"
                value={selectedComponent}
                onChange={(event) =>
                  setFilter({ component: event.target.value || null })
                }
              >
                <option value="">All components</option>
                {!componentKnown && filters.component ? (
                  <option value={selectedComponent}>
                    {COMPONENT_KIND_LABEL[filters.component.kind]}:{' '}
                    {filters.component.id}
                  </option>
                ) : null}
                {agents.length ? (
                  <optgroup label="Agents">
                    {agents.map((agent) => (
                      <option
                        key={agent.id}
                        value={encodeComponent('agent', agent.id)}
                      >
                        {agent.name || agent.id}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {teams.length ? (
                  <optgroup label="Teams">
                    {teams.map((team) => (
                      <option
                        key={team.id}
                        value={encodeComponent('team', team.id)}
                      >
                        {team.name || team.id}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {workflows.length ? (
                  <optgroup label="Workflows">
                    {workflows.map((workflow) => (
                      <option
                        key={workflow.id}
                        value={encodeComponent('workflow', workflow.id)}
                      >
                        {workflow.name || workflow.id}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
              <label htmlFor="trace-range" className="sr-only">
                Time range
              </label>
              <Select
                id="trace-range"
                className="w-[160px] max-sm:w-full"
                value={params.range}
                onChange={(event) =>
                  setFilter({
                    range:
                      TIME_RANGES.find(
                        (range) => range === event.target.value
                      ) ?? null
                  })
                }
              >
                {TIME_RANGES.map((range) => (
                  <option key={range} value={range}>
                    {TIME_RANGE_LABEL[range]}
                  </option>
                ))}
              </Select>
            </div>

            {params.run_id ? (
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
                <span>Showing traces for run</span>
                <Chip className="max-w-[280px]">
                  <span className="truncate font-mono" title={params.run_id}>
                    {params.run_id}
                  </span>
                </Chip>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter({ run_id: null })}
                >
                  <X aria-hidden />
                  Show all runs
                </Button>
              </div>
            ) : null}

            {list.isPending ? (
              <LoadingRows rows={8} label="Loading traces" />
            ) : list.isError && !list.data ? (
              <ErrorState
                title="Couldn't load traces"
                error={list.error}
                onRetry={() => void list.refetch()}
                retrying={list.isFetching}
              />
            ) : rows.length === 0 ? (
              filtered || page > 1 ? (
                <EmptyState
                  icon={<Layers />}
                  title="No traces match these filters"
                  description={
                    filters.range !== 'any'
                      ? `Nothing recorded ${TIME_RANGE_LABEL[filters.range].toLowerCase()} matches. Try a longer time range or clear the filters.`
                      : 'Try a different search or clear the filters.'
                  }
                  action={
                    <Button size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Layers />}
                  title="No traces yet"
                  description="Every agent, team and workflow run records a trace with its model calls, tool calls and errors. Start a chat to record the first one."
                  action={
                    <Button size="sm" variant="primary" asChild>
                      <Link href="/">Start a chat</Link>
                    </Button>
                  }
                />
              )
            ) : (
              <>
                {list.isError ? (
                  <ErrorState
                    compact
                    title="Couldn't refresh traces"
                    error={list.error}
                    onRetry={() => void list.refetch()}
                    retrying={list.isFetching}
                  />
                ) : null}
                <TableWrap
                  className={cn(
                    'transition-opacity',
                    list.isPlaceholderData && 'opacity-60'
                  )}
                  aria-busy={list.isFetching || undefined}
                >
                  <Table>
                    <caption className="sr-only">
                      Traces, newest first. Select a trace to see its spans.
                    </caption>
                    <thead>
                      <tr>
                        <Th>Status</Th>
                        <Th>Trace</Th>
                        <Th>Component</Th>
                        <Th>Duration</Th>
                        <Th>Spans</Th>
                        <Th>Started</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((trace) => (
                        <TraceRow
                          key={trace.trace_id}
                          trace={trace}
                          directory={directory}
                          selected={trace.trace_id === selectedId}
                          onOpen={openTrace}
                        />
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
                <nav
                  aria-label="Trace pages"
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <span className="text-[13px] text-fg-3" aria-live="polite">
                    Showing {firstIndex.toLocaleString()}–
                    {lastIndex.toLocaleString()} of{' '}
                    {totalCount.toLocaleString()}{' '}
                    {totalCount === 1 ? 'trace' : 'traces'}
                  </span>
                  {totalPages > 1 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={page <= 1 || list.isFetching}
                        onClick={() => void setParams({ page: page - 1 })}
                      >
                        <ChevronLeft aria-hidden />
                        Previous
                      </Button>
                      <span className="text-[13px] whitespace-nowrap text-fg-3">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        size="sm"
                        disabled={page >= totalPages || list.isFetching}
                        onClick={() => void setParams({ page: page + 1 })}
                      >
                        Next
                        <ChevronRight aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </nav>
              </>
            )}
          </PageBody>
        </SplitMain>
        {selectedId ? (
          <TraceDetailPanel
            key={selectedId}
            traceId={selectedId}
            summary={selectedSummary}
            directory={directory}
            onClose={closeTrace}
          />
        ) : null}
      </SplitLayout>
    </>
  )
}
