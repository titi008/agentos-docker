'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { ChevronDown, Clock, Pencil, RotateCcw } from 'lucide-react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, Stat, Table, TableWrap, Td, Th } from '@/components/ui/data'
import { ProviderIcon } from '@/components/ui/icon/ProviderIcon'
import { Select } from '@/components/ui/input'
import { PageBody, PageScroll, SectionTitle } from '@/components/ui/page'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Skeleton
} from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'

import {
  MONITORING_KEY,
  formatCompact,
  formatDayKey,
  formatInteger,
  formatPercent,
  formatRate,
  formatUsd,
  isRecord,
  utcDayKey
} from './format'
import { MonitoringHeader } from './MonitoringHeader'
import { PricingSection, usePricingEditor } from './PricingSection'
import { UsageChart, type ChartMetric } from './UsageChart'
import {
  USAGE_RANGES,
  USAGE_RANGE_LABEL,
  aggregateMetrics,
  buildBuckets,
  inRange,
  rangeStart,
  sumTotals,
  type DayTotals
} from './usage'
import type {
  CostBreakdown,
  MetricsResponse,
  ModelCost,
  PriceRate,
  PricingResponse
} from './types'

const DAILY_PREVIEW = 7

/** Today's UTC day, updated when the date changes while the page is open. */
function useTodayKey(): string {
  const [today, setToday] = useState(() => utcDayKey(Date.now()))
  useEffect(() => {
    const timer = window.setInterval(
      () => setToday(utcDayKey(Date.now())),
      60_000
    )
    return () => window.clearInterval(timer)
  }, [])
  return today
}

const NOT_ENOUGH_DATA = 'Not enough data'

function Unknown() {
  return <span className="text-fg-3">—</span>
}

function KpiValue({
  loading,
  children
}: {
  loading: boolean
  children: ReactNode
}) {
  return loading ? <Skeleton className="my-1 h-6 w-24" /> : <>{children}</>
}

function Tokens({ value }: { value: number }) {
  return (
    <span title={`${formatInteger(value)} tokens`}>{formatCompact(value)}</span>
  )
}

function ProviderCards({ costs }: { costs: CostBreakdown }) {
  const providers = costs.by_provider
    .filter((provider) => provider.runs > 0)
    .sort((a, b) => b.total_cost - a.total_cost || b.runs - a.runs)

  if (!providers.length) {
    return (
      <EmptyState
        title="No priced runs yet"
        description="Provider totals appear after agents run on a model with a rate."
        className="py-8"
      />
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {providers.map((provider) => {
        const share = costs.total_cost > 0 ? provider.percentage : null
        return (
          <li key={provider.provider}>
            <Card className="flex flex-col gap-2.5 p-4">
              <div className="flex items-center gap-2">
                <ProviderIcon provider={provider.provider} />
                <span className="min-w-0 truncate font-semibold">
                  {provider.provider}
                </span>
                {share !== null ? (
                  <Badge className="ml-auto">{formatPercent(share, 1)}</Badge>
                ) : null}
                <span
                  className={cn(
                    'font-mono text-sm text-fg',
                    share === null && 'ml-auto'
                  )}
                >
                  {formatUsd(provider.total_cost)}
                </span>
              </div>
              {share !== null ? (
                <div
                  role="img"
                  aria-label={`${formatPercent(share, 1)} of estimated spend`}
                  className="h-1.5 overflow-hidden rounded-full bg-hover"
                >
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
                  />
                </div>
              ) : null}
              <span className="text-[12.5px] text-fg-3">
                {formatInteger(provider.runs)}{' '}
                {provider.runs === 1 ? 'run' : 'runs'} ·{' '}
                {formatCompact(provider.total_tokens)} tokens ·{' '}
                {formatCompact(provider.input_tokens)} in ·{' '}
                {formatCompact(provider.output_tokens)} out
              </span>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

function ModelTable({
  models,
  rates,
  onEditRate
}: {
  models: ModelCost[]
  rates: Map<string, PriceRate>
  onEditRate: (model: ModelCost) => void
}) {
  const totals = models.reduce(
    (sum, model) => ({
      runs: sum.runs + model.runs,
      input: sum.input + model.input_tokens,
      output: sum.output + model.output_tokens,
      total: sum.total + model.total_tokens,
      cost: sum.cost + model.total_cost
    }),
    { runs: 0, input: 0, output: 0, total: 0, cost: 0 }
  )

  return (
    <TableWrap>
      <Table className="min-w-[860px]">
        <caption className="sr-only">
          Runs, tokens and estimated cost per model
        </caption>
        <thead>
          <tr>
            <Th>Model</Th>
            <Th>Provider</Th>
            <Th className="text-right">Runs</Th>
            <Th className="text-right">Input</Th>
            <Th className="text-right">Output</Th>
            <Th className="text-right">Total tokens</Th>
            <Th className="text-right">Estimated cost</Th>
            <Th className="text-right">Active rate ($ / 1M in · out)</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => {
            const rate = rates.get(model.model_id)
            return (
              <tr key={model.model_id} className="hover:bg-hover">
                <Td className="font-mono break-all text-fg">
                  {model.model_id}
                </Td>
                <Td>{model.provider}</Td>
                <Td className="text-right tabular-nums">
                  {formatInteger(model.runs)}
                </Td>
                <Td className="text-right tabular-nums">
                  <Tokens value={model.input_tokens} />
                </Td>
                <Td className="text-right tabular-nums">
                  <Tokens value={model.output_tokens} />
                </Td>
                <Td className="text-right tabular-nums">
                  <Tokens value={model.total_tokens} />
                </Td>
                <Td className="text-right font-semibold tabular-nums">
                  {rate || model.total_cost > 0 ? (
                    formatUsd(model.total_cost)
                  ) : (
                    <span className="font-normal text-fg-3">No rate</span>
                  )}
                </Td>
                <Td className="text-right font-mono whitespace-nowrap">
                  {rate ? (
                    `${formatRate(rate.input_cost_per_m)} · ${formatRate(rate.output_cost_per_m)}`
                  ) : (
                    <Unknown />
                  )}
                </Td>
                <Td className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${rate ? 'Edit' : 'Add'} rate for ${model.model_id}`}
                    aria-controls="pricing"
                    onClick={() => onEditRate(model)}
                  >
                    <Pencil aria-hidden />
                    {rate ? 'Edit rate' : 'Add rate'}
                  </Button>
                </Td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <Td className="border-t border-line">Total</Td>
            <Td className="border-t border-line" />
            <Td className="border-t border-line text-right tabular-nums">
              {formatInteger(totals.runs)}
            </Td>
            <Td className="border-t border-line text-right tabular-nums">
              <Tokens value={totals.input} />
            </Td>
            <Td className="border-t border-line text-right tabular-nums">
              <Tokens value={totals.output} />
            </Td>
            <Td className="border-t border-line text-right tabular-nums">
              <Tokens value={totals.total} />
            </Td>
            <Td className="border-t border-line text-right tabular-nums">
              {formatUsd(totals.cost)}
            </Td>
            <Td className="border-t border-line" />
            <Td className="border-t border-line" />
          </tr>
        </tfoot>
      </Table>
    </TableWrap>
  )
}

function DailyHistory({
  days,
  costByDay,
  today,
  rangeLabel
}: {
  days: DayTotals[]
  /** Null when there is no cost data to show. */
  costByDay: Map<string, number> | null
  today: string
  rangeLabel: string
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? days : days.slice(0, DAILY_PREVIEW)
  const hidden = days.length - visible.length

  return (
    <section aria-labelledby="daily-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <SectionTitle id="daily-title">Daily history</SectionTitle>
          <p className="text-[12.5px] text-fg-3">
            {days.length > DAILY_PREVIEW && !showAll
              ? `Most recent ${DAILY_PREVIEW} of ${days.length} days with activity. ${rangeLabel}.`
              : `${days.length} ${days.length === 1 ? 'day' : 'days'} with activity. ${rangeLabel}.`}
          </p>
        </div>
        {days.length > DAILY_PREVIEW ? (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showAll}
            aria-controls="daily-table"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? 'Show fewer' : `Show all ${days.length} days`}
            <ChevronDown
              aria-hidden
              className={cn('transition-transform', showAll && 'rotate-180')}
            />
          </Button>
        ) : null}
      </div>
      <TableWrap id="daily-table">
        <Table className="min-w-[820px]">
          <caption className="sr-only">
            Runs, sessions, tokens{costByDay ? ' and estimated cost' : ''} per
            day (UTC), newest first
          </caption>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th className="text-right">Agent runs</Th>
              <Th className="text-right">Team runs</Th>
              <Th className="text-right">Workflow runs</Th>
              <Th className="text-right">Sessions</Th>
              <Th className="text-right">Input</Th>
              <Th className="text-right">Output</Th>
              <Th className="text-right">Total</Th>
              {costByDay ? <Th className="text-right">Cost</Th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((day) => (
              <tr key={day.key} className="hover:bg-hover">
                <Td>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {formatDayKey(day.key, true)}
                    {day.key === today ? <Badge>So far</Badge> : null}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">
                  {formatInteger(day.agentRuns)}
                </Td>
                <Td className="text-right tabular-nums">
                  {formatInteger(day.teamRuns)}
                </Td>
                <Td className="text-right tabular-nums">
                  {formatInteger(day.workflowRuns)}
                </Td>
                <Td className="text-right tabular-nums">
                  {formatInteger(
                    day.agentSessions + day.teamSessions + day.workflowSessions
                  )}
                </Td>
                <Td className="text-right tabular-nums">
                  <Tokens value={day.inputTokens} />
                </Td>
                <Td className="text-right tabular-nums">
                  <Tokens value={day.outputTokens} />
                </Td>
                <Td className="text-right font-semibold tabular-nums">
                  <Tokens value={day.totalTokens} />
                </Td>
                {costByDay ? (
                  <Td className="text-right tabular-nums">
                    {formatUsd(costByDay.get(day.key) ?? 0)}
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {hidden > 0 ? (
        <p className="sr-only">{hidden} older days are hidden.</p>
      ) : null}
    </section>
  )
}

export function UsageView() {
  const api = useApi()
  const qc = useQueryClient()
  const today = useTodayKey()
  const [range, setRange] = useQueryState(
    'range',
    parseAsStringLiteral(USAGE_RANGES).withDefault('30d')
  )
  // Null until the viewer picks one: spend when costs exist, else tokens.
  const [chosenMetric, setMetric] = useState<ChartMetric | null>(null)
  const start = rangeStart(range, today)

  const metrics = useQuery({
    queryKey: api.key(MONITORING_KEY, 'metrics', start ?? 'all', today),
    queryFn: ({ signal }) =>
      api.request<MetricsResponse>('/metrics', {
        signal,
        query: start ? { starting_date: start, ending_date: today } : undefined
      }),
    enabled: api.ready,
    placeholderData: keepPreviousData
  })
  const costs = useQuery({
    queryKey: api.key(MONITORING_KEY, 'costs'),
    queryFn: ({ signal }) =>
      api.request<CostBreakdown>('/costs', {
        signal,
        fallbackPaths: ['/api/costs']
      }),
    enabled: api.ready
  })
  const pricing = useQuery({
    queryKey: api.key(MONITORING_KEY, 'pricing'),
    queryFn: ({ signal }) =>
      api.request<PricingResponse>('/pricing', {
        signal,
        fallbackPaths: ['/api/pricing']
      }),
    enabled: api.ready
  })

  const invalidateUsage = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: api.key(MONITORING_KEY, 'metrics') }),
      qc.invalidateQueries({ queryKey: api.key(MONITORING_KEY, 'costs') })
    ])

  const recalculate = useMutation({
    mutationFn: () =>
      api.request<unknown>('/metrics/refresh', { method: 'POST' }),
    onSuccess: (result) => {
      const alreadyRunning =
        isRecord(result) && result.status === 'already_running'
      if (alreadyRunning) {
        toast.info('A recalculation is already running', {
          description: 'Refresh in a minute to see the new totals.'
        })
      } else {
        toast.success('Usage recalculated')
      }
      return invalidateUsage()
    },
    onError: (error) =>
      toast.error("Couldn't recalculate usage", {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  const editor = usePricingEditor(pricing.data?.current_rates ?? [])
  const displayRates = pricing.data?.current_rates ?? costs.data?.rates ?? []
  const rateByModel = new Map(displayRates.map((rate) => [rate.model_id, rate]))

  /* Derived usage ---------------------------------------------------------- */

  const days = aggregateMetrics(metrics.data?.metrics ?? [], start, today)
  const totals = sumTotals(days)
  const hasMetrics = days.length > 0

  const costData = costs.data
  const hasCostData = Boolean(costData && costData.total_runs > 0)
  const costDays = costData
    ? costData.daily_history.filter((day) => inRange(day.date, start, today))
    : []
  const spend =
    costData && range === 'all'
      ? costData.total_cost
      : costDays.reduce((sum, day) => sum + (day.total_cost || 0), 0)
  const pricedRuns =
    costData && range === 'all'
      ? costData.total_runs
      : costDays.reduce((sum, day) => sum + (day.runs || 0), 0)
  const metric: ChartMetric =
    chosenMetric ?? (costs.isPending || hasCostData ? 'spend' : 'tokens')
  const costByDay = hasCostData
    ? new Map(costDays.map((day) => [day.date, day.total_cost || 0]))
    : null

  const { buckets, weekly } = buildBuckets(
    range,
    today,
    days,
    hasCostData && costData ? costData.daily_history : null
  )

  const models = (costData?.by_model ?? [])
    .filter((model) => model.runs > 0)
    .sort((a, b) => b.total_cost - a.total_cost || b.runs - a.runs)
  const knownProviders = (costData?.by_provider ?? []).map((p) => p.provider)

  const metricsLoading = metrics.isPending
  const costsLoading = costs.isPending
  const updatedAt = metrics.data?.updated_at

  const refreshing =
    metrics.isFetching || costs.isFetching || pricing.isFetching
  const refresh = () => {
    void metrics.refetch()
    void costs.refetch()
    void pricing.refetch()
  }

  const rangeLabel =
    range === 'all' ? 'All time' : `${USAGE_RANGE_LABEL[range]} (UTC)`

  /* KPI content ------------------------------------------------------------ */

  const metricsHint = (hint: string) =>
    metrics.isError && !metrics.data
      ? 'Couldn’t load metrics'
      : hasMetrics
        ? hint
        : NOT_ENOUGH_DATA

  const spendHint = costs.isError
    ? 'Couldn’t load costs'
    : !hasCostData
      ? NOT_ENOUGH_DATA
      : pricedRuns > 0
        ? `${formatUsd(spend / pricedRuns)} average per run`
        : 'No priced runs in this range'

  return (
    <>
      <MonitoringHeader onRefresh={refresh} refreshing={refreshing} />
      <PageScroll>
        <PageBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 font-medium">
                <Clock aria-hidden className="size-4 text-fg-3" />
                {metricsLoading ? (
                  'Loading usage…'
                ) : updatedAt ? (
                  <span>
                    Last aggregated <RelativeTime value={updatedAt} />
                  </span>
                ) : (
                  'Not aggregated yet'
                )}
              </span>
              <span className="text-[12.5px] text-fg-3">
                {updatedAt ? `${formatDateTime(updatedAt)}. ` : ''}
                Recalculate re-aggregates stored sessions on the server and can
                take a minute.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="usage-range" className="sr-only">
                Date range
              </label>
              <Select
                id="usage-range"
                className="w-[160px]"
                value={range}
                onChange={(event) =>
                  void setRange(
                    USAGE_RANGES.find(
                      (option) => option === event.target.value
                    ) ?? null
                  )
                }
              >
                {USAGE_RANGES.map((option) => (
                  <option key={option} value={option}>
                    {USAGE_RANGE_LABEL[option]}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                onClick={() => recalculate.mutate()}
                loading={recalculate.isPending}
              >
                {recalculate.isPending ? null : <RotateCcw aria-hidden />}
                {recalculate.isPending ? 'Recalculating…' : 'Recalculate'}
              </Button>
            </div>
          </div>

          {metrics.isError && !metrics.data ? (
            <ErrorState
              title="Couldn't load usage metrics"
              error={metrics.error}
              onRetry={() => void metrics.refetch()}
              retrying={metrics.isFetching}
            />
          ) : null}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-3">
            <Stat
              label="Estimated spend"
              value={
                <KpiValue loading={costsLoading}>
                  {hasCostData ? formatUsd(spend) : <Unknown />}
                </KpiValue>
              }
              hint={costsLoading ? undefined : spendHint}
            />
            <Stat
              label="Runs"
              value={
                <KpiValue loading={metricsLoading}>
                  {hasMetrics ? formatInteger(totals.runs) : <Unknown />}
                </KpiValue>
              }
              hint={
                metricsLoading
                  ? undefined
                  : metricsHint(
                      `${formatInteger(totals.agentRuns)} agent · ${formatInteger(totals.teamRuns)} team · ${formatInteger(totals.workflowRuns)} workflow`
                    )
              }
            />
            <Stat
              label="Tokens"
              value={
                <KpiValue loading={metricsLoading}>
                  {hasMetrics ? (
                    <Tokens value={totals.totalTokens} />
                  ) : (
                    <Unknown />
                  )}
                </KpiValue>
              }
              hint={
                metricsLoading
                  ? undefined
                  : metricsHint(
                      `${formatCompact(totals.inputTokens)} in · ${formatCompact(totals.outputTokens)} out`
                    )
              }
            />
            <Stat
              label="Sessions"
              value={
                <KpiValue loading={metricsLoading}>
                  {hasMetrics ? formatInteger(totals.sessions) : <Unknown />}
                </KpiValue>
              }
              hint={
                metricsLoading
                  ? undefined
                  : metricsHint(
                      `${formatInteger(totals.agentSessions)} agent · ${formatInteger(totals.teamSessions)} team · ${formatInteger(totals.workflowSessions)} workflow`
                    )
              }
            />
            <Stat
              label="Active users"
              value={
                <KpiValue loading={metricsLoading}>
                  {totals.peakUsers > 0 ? (
                    formatInteger(totals.peakUsers)
                  ) : (
                    <Unknown />
                  )}
                </KpiValue>
              }
              hint={
                metricsLoading
                  ? undefined
                  : totals.peakUsers > 0
                    ? 'Most on a single day'
                    : metricsHint(NOT_ENOUGH_DATA)
              }
            />
          </div>

          <div className="flex flex-wrap items-stretch gap-4">
            <UsageChart
              className="flex-[2_1_560px]"
              buckets={buckets}
              weekly={weekly}
              metric={metric}
              onMetricChange={setMetric}
              loading={metric === 'spend' ? costsLoading : metricsLoading}
              spendAvailable={hasCostData}
            />
            <section
              aria-labelledby="provider-title"
              className="flex min-w-0 flex-[1_1_300px] flex-col gap-3"
            >
              <div className="flex flex-col gap-0.5">
                <SectionTitle id="provider-title">By provider</SectionTitle>
                <p className="text-[12.5px] text-fg-3">
                  All recorded runs; the date range doesn’t apply.
                </p>
              </div>
              {costsLoading ? (
                <LoadingRows rows={3} label="Loading providers" />
              ) : costs.isError ? (
                <ErrorState
                  compact
                  title="Couldn't load costs"
                  error={costs.error}
                  onRetry={() => void costs.refetch()}
                  retrying={costs.isFetching}
                />
              ) : costData ? (
                <ProviderCards costs={costData} />
              ) : null}
            </section>
          </div>

          <section
            aria-labelledby="model-title"
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-0.5">
              <SectionTitle id="model-title">By model</SectionTitle>
              <p className="text-[12.5px] text-fg-3">
                All recorded runs. Each run is priced at the rate that was in
                effect when it ran.
              </p>
            </div>
            {costsLoading ? (
              <LoadingRows rows={4} label="Loading models" />
            ) : costs.isError ? (
              <ErrorState
                title="Couldn't load the cost breakdown"
                error={costs.error}
                onRetry={() => void costs.refetch()}
                retrying={costs.isFetching}
              />
            ) : models.length ? (
              <ModelTable
                models={models}
                rates={rateByModel}
                onEditRate={(model) =>
                  void editor.startEdit(model.model_id, model.provider)
                }
              />
            ) : (
              <EmptyState
                title="No model usage yet"
                description="Runs appear here with their token counts and estimated cost once agents have answered."
              />
            )}
          </section>

          <PricingSection
            pricing={pricing}
            editor={editor}
            knownProviders={knownProviders}
          />

          {metricsLoading ? (
            <LoadingRows rows={5} label="Loading daily history" />
          ) : hasMetrics ? (
            <DailyHistory
              days={days}
              costByDay={costByDay}
              today={today}
              rangeLabel={rangeLabel}
            />
          ) : metrics.isError ? null : (
            <section
              aria-labelledby="daily-title"
              className="flex flex-col gap-3"
            >
              <SectionTitle id="daily-title">Daily history</SectionTitle>
              <EmptyState
                title={
                  range === 'all'
                    ? 'No usage aggregated yet'
                    : `No usage aggregated for ${USAGE_RANGE_LABEL[range].toLowerCase()}`
                }
                description="AgentOS aggregates stored sessions into daily totals. Recalculate to include the latest runs."
                action={
                  <Button
                    size="sm"
                    onClick={() => recalculate.mutate()}
                    loading={recalculate.isPending}
                  >
                    {recalculate.isPending ? null : <RotateCcw aria-hidden />}
                    Recalculate
                  </Button>
                }
              />
            </section>
          )}
        </PageBody>
      </PageScroll>
    </>
  )
}
