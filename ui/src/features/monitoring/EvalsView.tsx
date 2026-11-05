'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Check,
  ChevronRight,
  FlaskConical,
  Layers,
  MessageSquare,
  Terminal,
  X
} from 'lucide-react'
import Link from 'next/link'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Fragment, useState, type ReactNode } from 'react'

import { useApi } from '@/api/client'
import { chatHref } from '@/components/shell/nav'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/code'
import {
  Card,
  KeyValueList,
  Stat,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  type KeyValueItem
} from '@/components/ui/data'
import { SearchInput, Select } from '@/components/ui/input'
import { PageBody, PageScroll } from '@/components/ui/page'
import { SegmentedControl } from '@/components/ui/segmented'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/states'
import { formatDateTime, formatDuration, toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'

import {
  COMPONENT_KIND_LABEL,
  MONITORING_KEY,
  encodeComponent,
  formatPercent,
  isRecord,
  resolveComponent,
  toPaginated,
  type ComponentDirectory
} from './format'
import { MonitoringHeader } from './MonitoringHeader'
import type { EvalRun, EvalType } from './types'

const PAGE_SIZE = 50
const EVAL_COMMAND = 'python -m evals --tag smoke'

/* Result interpretation --------------------------------------------------- */

type Outcome = 'passed' | 'failed' | 'unscored' | 'none'

const OUTCOMES = ['all', 'passed', 'failed', 'unscored', 'none'] as const

const OUTCOME_INFO: Record<Outcome, { label: string; tone: BadgeTone }> = {
  passed: { label: 'Passed', tone: 'ok' },
  failed: { label: 'Failed', tone: 'bad' },
  unscored: { label: 'No verdict', tone: 'neutral' },
  none: { label: 'No result', tone: 'neutral' }
}

const TYPE_ORDER = ['accuracy', 'agent_as_judge', 'reliability', 'performance']

const TYPE_LABEL: Record<string, string> = {
  accuracy: 'Accuracy',
  agent_as_judge: 'Agent as judge',
  reliability: 'Reliability',
  performance: 'Performance'
}

function typeLabel(type: EvalType): string {
  if (TYPE_LABEL[type]) return TYPE_LABEL[type]
  const text = String(type || 'Other').replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null

const strList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

function results(run: EvalRun): Record<string, unknown>[] {
  const value = run.eval_data?.results
  return Array.isArray(value) ? value.filter(isRecord) : []
}

/** Formatted score, run time or pass rate; null when the run has none. */
function evalScore(run: EvalRun): string | null {
  const data = run.eval_data ?? {}
  const tenPoint =
    run.eval_type === 'accuracy' || run.eval_type === 'agent_as_judge'
  const score = finite(data.score) ?? finite(data.avg_score)
  if (score !== null)
    return tenPoint
      ? `${Number(score.toFixed(1))} / 10`
      : `${Number(score.toFixed(2))}`
  const avgRunTime = finite(data.avg_run_time)
  if (avgRunTime !== null) return `${formatDuration(avgRunTime * 1000)} avg`
  const passRate = finite(data.pass_rate)
  if (passRate !== null && results(run).length > 1)
    return `${formatPercent(passRate)} pass`
  return null
}

function evalOutcome(run: EvalRun): Outcome {
  const data = run.eval_data ?? {}
  const status = str(data.eval_status)?.toUpperCase()
  if (status === 'PASSED') return 'passed'
  if (status === 'FAILED') return 'failed'
  if (typeof data.passed === 'boolean') return data.passed ? 'passed' : 'failed'
  const verdicts = results(run)
    .map((result) => result.passed)
    .filter((value): value is boolean => typeof value === 'boolean')
  if (verdicts.length) return verdicts.every(Boolean) ? 'passed' : 'failed'
  if (evalScore(run) !== null) return 'unscored'
  return 'none'
}

function evalTitle(run: EvalRun): string {
  return run.name || run.evaluated_component_name || run.id
}

/* Detail ------------------------------------------------------------------ */

const HIDDEN_DATA_KEYS = new Set([
  'run_id',
  'eval_status',
  'reason',
  'results',
  'passed'
])

function humanize(key: string): string {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatMetric(key: string, value: unknown): ReactNode {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (key.endsWith('run_time')) return formatDuration(value * 1000)
    if (key.endsWith('memory_usage')) return `${value.toFixed(2)} MiB`
    if (key === 'pass_rate') return formatPercent(value, 1)
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
  }
  return String(value)
}

function metricItems(run: EvalRun): KeyValueItem[] {
  const items: KeyValueItem[] = []
  for (const [key, value] of Object.entries(run.eval_data ?? {})) {
    if (HIDDEN_DATA_KEYS.has(key) || value === null || value === undefined)
      continue
    if (typeof value === 'object') continue
    items.push({
      label: humanize(key),
      value: <span className="font-mono">{formatMetric(key, value)}</span>
    })
  }
  for (const key of [
    'scoring_strategy',
    'threshold',
    'num_iterations',
    'warmup_runs',
    'allow_additional_tool_calls'
  ]) {
    const value = run.eval_input?.[key]
    if (value === null || value === undefined || value === '') continue
    if (typeof value === 'object') continue
    items.push({ label: humanize(key), value: formatMetric(key, value) })
  }
  if (run.model_provider)
    items.push({ label: 'Provider', value: run.model_provider })
  if (run.user_id)
    items.push({
      label: 'User',
      value: <span className="font-mono break-all">{run.user_id}</span>
    })
  items.push({
    label: 'Eval ID',
    value: (
      <span className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate font-mono" title={run.id}>
          {run.id}
        </span>
        <CopyButton
          value={run.id}
          aria-label="Copy eval ID"
          successMessage="Eval ID copied"
        />
      </span>
    )
  })
  return items
}

function ToolChip({
  name,
  kind
}: {
  name: string
  kind: 'pass' | 'missing' | 'unexpected' | 'extra' | 'expected'
}) {
  const label = {
    pass: 'called',
    missing: 'missing',
    unexpected: 'not expected',
    extra: 'extra, allowed',
    expected: 'expected'
  }[kind]
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 rounded-[7px] px-2 font-mono text-[12.5px] [&_svg]:size-3.5',
        kind === 'pass' && 'bg-ok-soft text-ok',
        (kind === 'missing' || kind === 'unexpected') && 'bg-bad-soft text-bad',
        (kind === 'extra' || kind === 'expected') &&
          'border border-line-strong text-fg-2'
      )}
    >
      {kind === 'pass' ? (
        <Check aria-hidden />
      ) : kind === 'missing' || kind === 'unexpected' ? (
        <X aria-hidden />
      ) : null}
      {name}
      <span className="sr-only">, {label}</span>
      {kind === 'unexpected' || kind === 'extra' ? (
        <span aria-hidden className="font-sans text-xs opacity-80">
          {kind === 'unexpected' ? 'not expected' : 'extra'}
        </span>
      ) : null}
    </span>
  )
}

function DetailBlock({
  label,
  children
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-3">{label}</span>
      <div className="min-w-0 text-[13px] break-words whitespace-pre-wrap text-fg-2">
        {children}
      </div>
    </div>
  )
}

function EvalDetail({
  run,
  directory
}: {
  run: EvalRun
  directory: ComponentDirectory
}) {
  const data = run.eval_data ?? {}
  const input = run.eval_input ?? {}
  const items = results(run)

  const reasons = [
    str(data.reason),
    ...items.map((result) => str(result.reason))
  ].filter((value): value is string => Boolean(value))
  const criteria =
    str(input.criteria) ?? str(items.find((r) => str(r.criteria))?.criteria)
  const expectedOutput =
    str(input.expected_output) ??
    str(items.find((r) => str(r.expected_output))?.expected_output)

  const expected = strList(input.expected_tool_calls)
  const passed = strList(data.passed_tool_calls)
  const missing = strList(data.missing_tool_calls)
  const unexpected = strList(data.failed_tool_calls)
  const extra = strList(data.additional_tool_calls)
  const argsPassed = strList(data.passed_argument_checks)
  const argsFailed = strList(data.failed_argument_checks)
  const accounted = new Set([...passed, ...missing])
  const pendingExpected = expected.filter((name) => !accounted.has(name))
  const hasToolCalls =
    expected.length +
      passed.length +
      missing.length +
      unexpected.length +
      extra.length >
    0
  const matched = expected.filter((name) => passed.includes(name)).length

  const component = resolveComponent(
    run,
    directory,
    run.evaluated_component_name
  )

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4 pt-1 pb-2 pl-0 md:pl-9">
      <div className="flex min-w-0 flex-col gap-3.5">
        <DetailBlock label="Reason">
          {reasons.length ? (
            reasons.length === 1 ? (
              reasons[0]
            ) : (
              <ol className="flex list-decimal flex-col gap-1.5 pl-4">
                {reasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ol>
            )
          ) : (
            <span className="text-fg-3">No reason recorded.</span>
          )}
        </DetailBlock>
        {criteria ? (
          <DetailBlock label="Criteria">{criteria}</DetailBlock>
        ) : null}
        {expectedOutput ? (
          <DetailBlock label="Expected output">{expectedOutput}</DetailBlock>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3.5">
        {hasToolCalls ? (
          <DetailBlock
            label={
              expected.length
                ? `Tool calls · expected ${expected.length}, matched ${matched}`
                : 'Tool calls'
            }
          >
            <span className="flex flex-wrap items-center gap-1.5 whitespace-normal">
              {passed.map((name, index) => (
                <ToolChip key={`p-${name}-${index}`} name={name} kind="pass" />
              ))}
              {missing.map((name, index) => (
                <ToolChip
                  key={`m-${name}-${index}`}
                  name={name}
                  kind="missing"
                />
              ))}
              {pendingExpected.map((name, index) => (
                <ToolChip
                  key={`e-${name}-${index}`}
                  name={name}
                  kind="expected"
                />
              ))}
              {unexpected.map((name, index) => (
                <ToolChip
                  key={`u-${name}-${index}`}
                  name={name}
                  kind="unexpected"
                />
              ))}
              {extra.map((name, index) => (
                <ToolChip key={`x-${name}-${index}`} name={name} kind="extra" />
              ))}
            </span>
          </DetailBlock>
        ) : null}
        {argsPassed.length || argsFailed.length ? (
          <DetailBlock label="Argument checks">
            <span className="flex flex-wrap items-center gap-1.5 whitespace-normal">
              {argsPassed.map((name, index) => (
                <ToolChip key={`ap-${index}`} name={name} kind="pass" />
              ))}
              {argsFailed.map((name, index) => (
                <ToolChip key={`af-${index}`} name={name} kind="missing" />
              ))}
            </span>
          </DetailBlock>
        ) : null}
        <KeyValueList
          items={metricItems(run)}
          className="sm:grid-cols-[120px_minmax(0,1fr)]"
        />
        {component ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href={chatHref(component.kind, component.id)}>
                <MessageSquare aria-hidden />
                Chat with {component.name}
              </Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link
                href={`/monitoring/traces?component=${encodeURIComponent(encodeComponent(component.kind, component.id))}`}
              >
                <Layers aria-hidden />
                View traces
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* Pieces ------------------------------------------------------------------ */

function CommandHint({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2.5 rounded-xl border border-dashed border-line-strong p-4',
        className
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <Terminal aria-hidden className="size-4 text-fg-3" />
        Record new results
      </span>
      <p className="text-[12.5px] text-fg-3">
        Run the eval CLI on your AgentOS server. It uses the app’s .env and
        database and spends model calls.
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas py-1 pr-1 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">
          {EVAL_COMMAND}
        </code>
        <CopyButton
          value={EVAL_COMMAND}
          label="Copy"
          aria-label="Copy command"
          successMessage="Command copied"
        />
      </div>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const info = OUTCOME_INFO[outcome]
  return (
    <Badge tone={info.tone} dot>
      {info.label}
    </Badge>
  )
}

const evalParams = {
  type: parseAsString.withDefault('all'),
  status: parseAsStringLiteral(OUTCOMES).withDefault('all'),
  q: parseAsString.withDefault('')
}

export function EvalsView() {
  const api = useApi()
  const agents = useStore((state) => state.agents)
  const teams = useStore((state) => state.teams)
  const workflows = useStore((state) => state.workflows)
  const directory: ComponentDirectory = { agents, teams, workflows }

  const [params, setParams] = useQueryStates(evalParams, {
    history: 'replace'
  })
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const runs = useInfiniteQuery({
    queryKey: api.key(MONITORING_KEY, 'evals'),
    queryFn: ({ pageParam, signal }) =>
      api
        .request<unknown>('/eval-runs', {
          signal,
          query: {
            page: pageParam,
            limit: PAGE_SIZE,
            sort_by: 'created_at',
            sort_order: 'desc'
          }
        })
        .then(toPaginated<EvalRun>),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      if (last.meta) {
        return last.meta.page < last.meta.total_pages
          ? last.meta.page + 1
          : undefined
      }
      return last.data.length === PAGE_SIZE ? pages.length + 1 : undefined
    },
    enabled: api.ready
  })

  const all = runs.data?.pages.flatMap((page) => page.data) ?? []
  const totalCount = runs.data?.pages[0]?.meta?.total_count ?? all.length
  const outcomes = new Map(all.map((run) => [run.id, evalOutcome(run)]))

  const typeCounts = new Map<string, number>()
  for (const run of all)
    typeCounts.set(run.eval_type, (typeCounts.get(run.eval_type) ?? 0) + 1)
  const types = [...typeCounts.keys()].sort(
    (a, b) =>
      (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99) ||
      a.localeCompare(b)
  )
  if (params.type !== 'all' && !types.includes(params.type))
    types.push(params.type)

  const search = params.q.trim().toLowerCase()
  const visible = all.filter((run) => {
    if (params.type !== 'all' && run.eval_type !== params.type) return false
    if (params.status !== 'all' && outcomes.get(run.id) !== params.status)
      return false
    if (!search) return true
    const component = resolveComponent(
      run,
      directory,
      run.evaluated_component_name
    )
    return [
      run.name,
      run.evaluated_component_name,
      component?.name,
      run.model_id,
      run.id
    ].some((value) => value?.toLowerCase().includes(search))
  })
  const filtered =
    params.type !== 'all' || params.status !== 'all' || Boolean(search)

  // Summary over every loaded run.
  let passedCount = 0
  let failedCount = 0
  for (const outcome of outcomes.values()) {
    if (outcome === 'passed') passedCount += 1
    else if (outcome === 'failed') failedCount += 1
  }
  const graded = passedCount + failedCount
  const ungraded = all.length - graded
  const passRate = graded ? (passedCount / graded) * 100 : null
  const latest = all.reduce<EvalRun | null>((best, run) => {
    const time = toDate(run.created_at)?.getTime()
    if (time === undefined) return best
    const bestTime = best ? (toDate(best.created_at)?.getTime() ?? 0) : -1
    return time > bestTime ? run : best
  }, null)
  const partial = runs.hasNextPage

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const clearFilters = () =>
    void setParams({ type: null, status: null, q: null })

  return (
    <>
      <MonitoringHeader
        onRefresh={() => void runs.refetch()}
        refreshing={runs.isFetching && !runs.isFetchingNextPage}
      />
      <PageScroll>
        <PageBody>
          {runs.isPending ? (
            <LoadingRows rows={6} label="Loading evaluations" />
          ) : runs.isError && !runs.data ? (
            <ErrorState
              title="Couldn't load evaluation runs"
              error={runs.error}
              onRetry={() => void runs.refetch()}
              retrying={runs.isFetching}
            />
          ) : all.length === 0 ? (
            <EmptyState
              icon={<FlaskConical />}
              title="No evaluation runs yet"
              description="Evaluations check that your agents give grounded answers and call the right tools. Run the eval CLI on your AgentOS server to record the first results."
              action={<CommandHint className="w-[min(420px,80vw)] text-left" />}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <Card className="flex min-w-[190px] flex-[1_1_190px] flex-col gap-1 p-4">
                  <span className="text-[12.5px] text-fg-3">Pass rate</span>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {passRate !== null ? (
                      formatPercent(passRate)
                    ) : (
                      <span className="text-fg-3">—</span>
                    )}
                  </span>
                  {passRate !== null ? (
                    <div
                      role="img"
                      aria-label={`${formatPercent(passRate)} passed`}
                      className="my-1 h-1.5 overflow-hidden rounded-full bg-hover"
                    >
                      <span
                        className="block h-full rounded-full bg-ok"
                        style={{ width: `${passRate}%` }}
                      />
                    </div>
                  ) : null}
                  <span className="text-xs text-fg-3">
                    {graded
                      ? `${passedCount} of ${graded} runs with a result${partial ? `, latest ${all.length} loaded` : ''}`
                      : 'No pass or fail results yet'}
                  </span>
                </Card>
                <Stat
                  className="min-w-[150px] flex-[1_1_150px]"
                  label="Passed"
                  value={<span className="text-ok">{passedCount}</span>}
                  hint={`of ${all.length} ${all.length === 1 ? 'run' : 'runs'}${partial ? ' loaded' : ''}`}
                />
                <Stat
                  className="min-w-[150px] flex-[1_1_150px]"
                  label="Failed"
                  value={
                    <span className={failedCount ? 'text-bad' : undefined}>
                      {failedCount}
                    </span>
                  }
                  hint={
                    ungraded
                      ? `${ungraded} ${ungraded === 1 ? 'run has' : 'runs have'} no pass or fail result`
                      : 'Every run has a result'
                  }
                />
                <Stat
                  className="min-w-[170px] flex-[1_1_170px]"
                  label="Last run"
                  value={
                    latest ? (
                      <time
                        dateTime={toDate(latest.created_at)?.toISOString()}
                        className="text-lg"
                      >
                        {formatDateTime(latest.created_at)}
                      </time>
                    ) : (
                      <span className="text-fg-3">—</span>
                    )
                  }
                  hint={latest ? evalTitle(latest) : 'No run dates recorded'}
                />
                <CommandHint className="flex-[2_1_380px]" />
              </div>

              <div
                role="search"
                aria-label="Filter evaluations"
                className="flex flex-wrap items-center gap-2"
              >
                <SegmentedControl
                  aria-label="Evaluation type"
                  value={params.type}
                  onChange={(type) => void setParams({ type })}
                  options={[
                    { value: 'all', label: 'All', count: all.length },
                    ...types.map((type) => ({
                      value: type,
                      label: typeLabel(type),
                      count: typeCounts.get(type) ?? 0
                    }))
                  ]}
                />
                <label htmlFor="eval-status" className="sr-only">
                  Status
                </label>
                <Select
                  id="eval-status"
                  className="w-[160px] max-sm:w-full"
                  value={params.status}
                  onChange={(event) =>
                    void setParams({
                      status:
                        OUTCOMES.find(
                          (option) => option === event.target.value
                        ) ?? null
                    })
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="unscored">No verdict</option>
                  <option value="none">No result</option>
                </Select>
                <div className="min-w-[200px] flex-[1_1_240px]">
                  <label htmlFor="eval-search" className="sr-only">
                    Search evaluations
                  </label>
                  <SearchInput
                    id="eval-search"
                    placeholder="Search by name, component or model"
                    value={params.q}
                    onChange={(event) =>
                      void setParams({ q: event.target.value || null })
                    }
                  />
                </div>
              </div>

              {visible.length === 0 ? (
                <EmptyState
                  icon={<FlaskConical />}
                  title="No evaluations match these filters"
                  description={
                    partial
                      ? 'Only loaded runs are filtered. Load more runs or clear the filters.'
                      : 'Try a different search or clear the filters.'
                  }
                  action={
                    <Button size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <TableWrap>
                  <Table className="min-w-[920px]">
                    <caption className="sr-only">
                      Evaluation runs, newest first. Expand a run to see why it
                      passed or failed.
                    </caption>
                    <thead>
                      <tr>
                        <Th>Name</Th>
                        <Th>Evaluated</Th>
                        <Th>Type</Th>
                        <Th>Model</Th>
                        <Th>Score</Th>
                        <Th>Status</Th>
                        <Th>Date</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((run) => {
                        const open = expanded.has(run.id)
                        const detailId = `eval-detail-${run.id}`
                        const component = resolveComponent(
                          run,
                          directory,
                          run.evaluated_component_name
                        )
                        const score = evalScore(run)
                        const created = toDate(run.created_at)
                        return (
                          <Fragment key={run.id}>
                            <Tr
                              onClick={() => toggle(run.id)}
                              className={cn(
                                'cursor-pointer',
                                open &&
                                  'bg-raised hover:bg-raised [&>td]:border-b-transparent'
                              )}
                            >
                              <Td className="max-w-[320px]">
                                <button
                                  type="button"
                                  aria-expanded={open}
                                  aria-controls={detailId}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    toggle(run.id)
                                  }}
                                  className="flex max-w-full items-center gap-2 rounded text-left font-medium text-fg"
                                >
                                  <ChevronRight
                                    aria-hidden
                                    className={cn(
                                      'size-4 shrink-0 text-fg-3 transition-transform',
                                      open && 'rotate-90'
                                    )}
                                  />
                                  <span className="truncate">
                                    {evalTitle(run)}
                                  </span>
                                </button>
                              </Td>
                              <Td className="max-w-[200px]">
                                {component ? (
                                  <span className="flex min-w-0 flex-col gap-px">
                                    <span className="truncate">
                                      {component.name}
                                    </span>
                                    <span className="text-xs text-fg-3">
                                      {COMPONENT_KIND_LABEL[component.kind]}
                                    </span>
                                  </span>
                                ) : run.evaluated_component_name ? (
                                  <span className="truncate">
                                    {run.evaluated_component_name}
                                  </span>
                                ) : (
                                  <span className="text-fg-3">—</span>
                                )}
                              </Td>
                              <Td className="whitespace-nowrap">
                                {typeLabel(run.eval_type)}
                              </Td>
                              <Td className="max-w-[180px]">
                                {run.model_id ? (
                                  <span
                                    className="block truncate font-mono text-[12.5px]"
                                    title={
                                      run.model_provider
                                        ? `${run.model_id} · ${run.model_provider}`
                                        : run.model_id
                                    }
                                  >
                                    {run.model_id}
                                  </span>
                                ) : (
                                  <span className="text-fg-3">—</span>
                                )}
                              </Td>
                              <Td className="font-mono whitespace-nowrap">
                                {score ?? <span className="text-fg-3">—</span>}
                              </Td>
                              <Td>
                                <OutcomeBadge
                                  outcome={outcomes.get(run.id) ?? 'none'}
                                />
                              </Td>
                              <Td className="whitespace-nowrap text-fg-3">
                                {created ? (
                                  <time dateTime={created.toISOString()}>
                                    {formatDateTime(created)}
                                  </time>
                                ) : (
                                  '—'
                                )}
                              </Td>
                            </Tr>
                            {open ? (
                              <tr id={detailId} className="bg-raised">
                                <td
                                  colSpan={7}
                                  className="border-b border-line px-4 pb-4"
                                >
                                  <EvalDetail run={run} directory={directory} />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              )}

              {runs.isError ? (
                <ErrorState
                  compact
                  title="Couldn't load more evaluation runs"
                  error={runs.error}
                  onRetry={() => void runs.fetchNextPage()}
                  retrying={runs.isFetchingNextPage}
                />
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] text-fg-3" aria-live="polite">
                  {filtered
                    ? `Showing ${visible.length} matching of ${all.length} loaded ${all.length === 1 ? 'run' : 'runs'}`
                    : `Showing ${all.length} of ${totalCount} ${totalCount === 1 ? 'run' : 'runs'}, newest first`}
                </span>
                {runs.hasNextPage ? (
                  <Button
                    size="sm"
                    onClick={() => void runs.fetchNextPage()}
                    loading={runs.isFetchingNextPage}
                  >
                    Load more
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </PageBody>
      </PageScroll>
    </>
  )
}
