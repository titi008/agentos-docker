'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from '@/store'
import {
  getTracesAPI,
  getTraceDetailAPI,
  getMetricsAPI,
  refreshMetricsAPI,
  getEvalRunsAPI,
  getCostsAPI,
  getPricingAPI,
  updatePricingAPI
} from '@/api/os'
import {
  TraceSummary,
  TraceDetail,
  TraceNode,
  MetricsResponse,
  EvalSchema,
  CostBreakdownResponse,
  PricingResponse
} from '@/types/os'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  RefreshCw,
  Search,
  XCircle,
  X,
  ChevronRight,
  ChevronDown,
  Zap,
  Sparkles,
  DollarSign,
  Coins,
  Edit3,
  Save,
  Tag
} from 'lucide-react'
import Icon from '@/components/ui/icon'
import { getProviderIcon } from '@/lib/modelProvider'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { toast } from 'sonner'

dayjs.extend(relativeTime)

const SpanNodeView = ({
  node,
  depth = 0
}: {
  node: TraceNode
  depth?: number
}) => {
  const [isOpen, setIsOpen] = useState(depth < 2)
  const hasChildren = node.spans && node.spans.length > 0

  const getTypeBadgeClass = (type: string) => {
    switch (type.toUpperCase()) {
      case 'LLM':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      case 'TOOL':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      case 'AGENT':
      case 'TEAM':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
      default:
        return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
    }
  }

  return (
    <div
      className="my-1.5 rounded-lg border border-primary/10 bg-background/60 p-2.5 font-dmmono text-xs text-foreground"
      style={{ marginLeft: `${Math.min(depth * 16, 80)}px` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-muted hover:text-foreground"
              aria-label={isOpen ? 'Collapse span' : 'Expand span'}
            >
              {isOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          ) : (
            <span className="size-4 inline-block" />
          )}

          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${getTypeBadgeClass(
              node.type
            )}`}
          >
            {node.type}
          </span>
          <span className="font-semibold text-primary">{node.name}</span>
        </div>

        <div className="flex items-center gap-3 text-muted">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {node.duration || '0s'}
          </span>
          {node.status === 'OK' ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="size-3" /> OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-400">
              <XCircle className="size-3" /> {node.status || 'ERROR'}
            </span>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-2.5 space-y-2 border-t border-primary/10 pt-2 text-[11px]">
          {node.input && (
            <div>
              <span className="text-muted uppercase text-[10px]">Input:</span>
              <pre className="mt-0.5 max-h-36 overflow-auto rounded bg-black/40 p-2 text-zinc-300 whitespace-pre-wrap break-all">
                {typeof node.input === 'string'
                  ? node.input
                  : JSON.stringify(node.input, null, 2)}
              </pre>
            </div>
          )}

          {node.output && (
            <div>
              <span className="text-muted uppercase text-[10px]">Output:</span>
              <pre className="mt-0.5 max-h-36 overflow-auto rounded bg-black/40 p-2 text-zinc-300 whitespace-pre-wrap break-all">
                {typeof node.output === 'string'
                  ? node.output
                  : JSON.stringify(node.output, null, 2)}
              </pre>
            </div>
          )}

          {node.error && (
            <div>
              <span className="text-rose-400 uppercase text-[10px]">
                Error:
              </span>
              <pre className="mt-0.5 max-h-36 overflow-auto rounded bg-rose-950/40 border border-rose-800/40 p-2 text-rose-300 whitespace-pre-wrap break-all">
                {node.error}
              </pre>
            </div>
          )}

          {node.metadata && Object.keys(node.metadata).length > 0 && (
            <div className="flex flex-wrap gap-2 text-[10px] text-muted">
              {Object.entries(node.metadata).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded bg-accent/50 px-1.5 py-0.5 border border-primary/10"
                >
                  <strong className="text-zinc-300">{k}:</strong>{' '}
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && hasChildren && node.spans && (
        <div className="mt-2 space-y-1">
          {node.spans.map((childSpan) => (
            <SpanNodeView
              key={childSpan.id}
              node={childSpan}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const ObservabilityView = () => {
  const {
    selectedEndpoint,
    authToken,
    observabilityTab: activeTab,
    setObservabilityTab: setActiveTab
  } = useStore()

  // Traces state
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [isTracesLoading, setIsTracesLoading] = useState(false)
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'ERROR'>('ALL')
  const [traceSearch, setTraceSearch] = useState('')

  // Metrics state
  const [metricsData, setMetricsData] = useState<MetricsResponse | null>(null)
  const [isMetricsLoading, setIsMetricsLoading] = useState(false)
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false)

  // Costs & Pricing state
  const [costsData, setCostsData] = useState<CostBreakdownResponse | null>(null)
  const [pricingData, setPricingData] = useState<PricingResponse | null>(null)
  const [isCostsLoading, setIsCostsLoading] = useState(false)
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<{
    model_id: string
    provider: string
    input_cost_per_m: number
    output_cost_per_m: number
  } | null>(null)
  const [isSavingRate, setIsSavingRate] = useState(false)
  const [showRateHistory, setShowRateHistory] = useState(false)

  // Evals state
  const [evals, setEvals] = useState<EvalSchema[]>([])
  const [isEvalsLoading, setIsEvalsLoading] = useState(false)

  const fetchTraces = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsTracesLoading(true)
    try {
      const res = await getTracesAPI(selectedEndpoint, authToken, 1, 50)
      setTraces(res.data || [])
    } finally {
      setIsTracesLoading(false)
    }
  }, [selectedEndpoint, authToken])

  const fetchMetrics = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsMetricsLoading(true)
    try {
      const res = await getMetricsAPI(selectedEndpoint, authToken)
      setMetricsData(res)
    } finally {
      setIsMetricsLoading(false)
    }
  }, [selectedEndpoint, authToken])

  const fetchCosts = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsCostsLoading(true)
    try {
      const [costRes, priceRes] = await Promise.all([
        getCostsAPI(selectedEndpoint, authToken),
        getPricingAPI(selectedEndpoint, authToken)
      ])
      if (costRes) setCostsData(costRes)
      if (priceRes) setPricingData(priceRes)
    } finally {
      setIsCostsLoading(false)
    }
  }, [selectedEndpoint, authToken])

  const fetchEvals = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsEvalsLoading(true)
    try {
      const res = await getEvalRunsAPI(selectedEndpoint, authToken)
      setEvals(res)
    } finally {
      setIsEvalsLoading(false)
    }
  }, [selectedEndpoint, authToken])

  useEffect(() => {
    if (activeTab === 'traces') fetchTraces()
    if (activeTab === 'metrics') {
      fetchMetrics()
      fetchCosts()
    }
    if (activeTab === 'evals') fetchEvals()
  }, [activeTab, fetchTraces, fetchMetrics, fetchCosts, fetchEvals])

  const handleOpenTraceDetail = async (traceId: string) => {
    setIsDetailLoading(true)
    try {
      const detail = await getTraceDetailAPI(
        selectedEndpoint,
        traceId,
        authToken
      )
      setSelectedTrace(detail)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleRefreshMetricsNow = async () => {
    setIsRefreshingMetrics(true)
    try {
      const ok = await refreshMetricsAPI(selectedEndpoint, authToken)
      if (ok) {
        toast.success('Metrics aggregation triggered')
        await Promise.all([fetchMetrics(), fetchCosts()])
      } else {
        toast.error('Failed to trigger metrics refresh')
      }
    } finally {
      setIsRefreshingMetrics(false)
    }
  }

  const handleSaveRate = async () => {
    if (!editingRate || !selectedEndpoint) return
    setIsSavingRate(true)
    try {
      const ok = await updatePricingAPI(selectedEndpoint, editingRate, authToken)
      if (ok) {
        setEditingRate(null)
        await fetchCosts()
      }
    } finally {
      setIsSavingRate(false)
    }
  }

  const filteredTraces = traces.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
    if (
      traceSearch &&
      !t.name.toLowerCase().includes(traceSearch.toLowerCase()) &&
      !(t.input || '').toLowerCase().includes(traceSearch.toLowerCase())
    ) {
      return false
    }
    return true
  })

  // Calculate totals from metrics
  const latestMetric = metricsData?.metrics?.[0]
  const totalAgentRuns = metricsData?.metrics?.reduce(
    (acc, m) => acc + (m.agent_runs_count || 0),
    0
  ) || 0
  const totalTeamRuns = metricsData?.metrics?.reduce(
    (acc, m) => acc + (m.team_runs_count || 0),
    0
  ) || 0
  const totalTokens = metricsData?.metrics?.reduce(
    (acc, m) => acc + (m.token_metrics?.total_tokens || 0),
    0
  ) || 0
  const inputTokens = metricsData?.metrics?.reduce(
    (acc, m) => acc + (m.token_metrics?.input_tokens || 0),
    0
  ) || 0
  const outputTokens = metricsData?.metrics?.reduce(
    (acc, m) => acc + (m.token_metrics?.output_tokens || 0),
    0
  ) || 0

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background text-foreground font-dmmono">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 px-3 md:px-6 py-3 md:py-4">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-primary">
            <Activity className="size-5" /> Observability & Traces
          </h1>
          <p className="text-xs text-muted">
            Inspect model latency, token consumption, execution trees, and benchmarks.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded-xl border border-primary/15 bg-accent/40 p-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('traces')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'traces'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Layers className="size-3.5" /> Traces
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'metrics'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <BarChart3 className="size-3.5" /> Metrics & Tokens
          </button>
          <button
            onClick={() => setActiveTab('evals')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'evals'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Sparkles className="size-3.5" /> Evaluations
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* TRACES TAB */}
        {activeTab === 'traces' && (
          <div className="space-y-4">
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="Search traces..."
                    value={traceSearch}
                    onChange={(e) => setTraceSearch(e.target.value)}
                    className="h-9 w-full sm:w-64 rounded-xl border border-primary/15 bg-accent/40 pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex rounded-xl border border-primary/15 bg-accent/30 p-0.5 text-xs">
                  {(['ALL', 'OK', 'ERROR'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] ${
                        statusFilter === s
                          ? 'bg-primary/20 text-primary font-semibold'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={fetchTraces}
                disabled={isTracesLoading}
                className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                <RefreshCw
                  className={`size-3.5 ${isTracesLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            {/* Traces Responsive Data Table */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Agent Execution Traces Table"
              className="overflow-x-auto rounded-xl border border-primary/15 bg-accent/20"
            >
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-primary/10 bg-background/90 backdrop-blur text-muted uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Name / Component</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Spans</th>
                    <th className="px-4 py-3 font-medium">Input Preview</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10 font-normal">
                  {filteredTraces.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted">
                        {isTracesLoading
                          ? 'Loading traces...'
                          : 'No execution traces found. Start chatting with an agent to generate traces!'}
                      </td>
                    </tr>
                  ) : (
                    filteredTraces.map((trace) => (
                      <tr
                        key={trace.trace_id}
                        onClick={() => handleOpenTraceDetail(trace.trace_id)}
                        className="cursor-pointer transition hover:bg-accent/40"
                      >
                        <td className="px-4 py-3">
                          {trace.status === 'OK' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="size-2.5" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/30">
                              <XCircle className="size-2.5" /> {trace.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-primary">
                          {trace.name}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {trace.duration || '0s'}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {trace.total_spans}
                        </td>
                        <td className="px-4 py-3 text-muted max-w-xs truncate">
                          {trace.input || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {dayjs(trace.created_at || trace.start_time).fromNow()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-primary hover:underline text-[11px]">
                            Inspect &rarr;
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* METRICS & COST TAB */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Token Throughput & Execution Costs
                </h2>
                <p className="text-xs text-muted">
                  Aggregated from PostgreSQL storage on your AgentOS server with effective-dated pricing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPricingModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-accent/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent hover:border-primary/40 transition"
                >
                  <Tag className="size-3.5 text-emerald-400" />
                  Configure Model Pricing
                </button>

                <button
                  onClick={handleRefreshMetricsNow}
                  disabled={isRefreshingMetrics}
                  className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 transition"
                >
                  <RefreshCw
                    className={`size-3.5 ${isRefreshingMetrics ? 'animate-spin' : ''}`}
                  />
                  Calculate & Refresh Metrics
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Total Estimated Cost */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                <span className="text-[11px] uppercase text-emerald-400 flex items-center gap-1.5">
                  <DollarSign className="size-3.5" /> Total Estimated Spend
                </span>
                <div className="mt-2 text-2xl font-bold text-emerald-300">
                  ${(costsData?.total_cost ?? 0).toFixed(4)}
                </div>
                <div className="text-[10px] text-muted mt-1">
                  Avg / run: $
                  {costsData && costsData.total_runs > 0
                    ? (costsData.total_cost / costsData.total_runs).toFixed(5)
                    : '0.00000'}
                </div>
              </div>

              <div className="rounded-xl border border-primary/15 bg-accent/30 p-4">
                <span className="text-[11px] uppercase text-muted flex items-center gap-1.5">
                  <Zap className="size-3.5 text-amber-400" /> Total Agent Runs
                </span>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  {totalAgentRuns}
                </div>
              </div>

              <div className="rounded-xl border border-primary/15 bg-accent/30 p-4">
                <span className="text-[11px] uppercase text-muted flex items-center gap-1.5">
                  <Layers className="size-3.5 text-blue-400" /> Total Team Runs
                </span>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  {totalTeamRuns}
                </div>
              </div>

              <div className="rounded-xl border border-primary/15 bg-accent/30 p-4">
                <span className="text-[11px] uppercase text-muted flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-purple-400" /> Total Tokens
                </span>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  {(costsData?.total_tokens ?? totalTokens).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted mt-1">
                  In: {(costsData?.total_input_tokens ?? inputTokens).toLocaleString()} | Out:{' '}
                  {(costsData?.total_output_tokens ?? outputTokens).toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-primary/15 bg-accent/30 p-4">
                <span className="text-[11px] uppercase text-muted flex items-center gap-1.5">
                  <Clock className="size-3.5 text-emerald-400" /> Active Users
                </span>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  {latestMetric?.users_count ?? 1}
                </div>
              </div>
            </div>

            {/* Provider Breakdown Cards */}
            {costsData?.by_provider && costsData.by_provider.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-primary uppercase">
                  Spend & Token Distribution by Provider
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {costsData.by_provider.map((prov) => {
                    const iconName = getProviderIcon(prov.provider)
                    return (
                      <div
                        key={prov.provider}
                        className="rounded-xl border border-primary/15 bg-accent/25 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {iconName ? (
                              <Icon type={iconName} size="xs" />
                            ) : (
                              <Coins className="size-3.5 text-primary" />
                            )}
                            <span className="text-xs font-semibold text-foreground">
                              {prov.provider}
                            </span>
                          </div>
                          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {prov.percentage}%
                          </span>
                        </div>

                        <div className="text-lg font-bold text-emerald-400">
                          ${prov.total_cost.toFixed(4)}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted border-t border-primary/10 pt-2">
                          <span>{prov.runs} runs</span>
                          <span>
                            {prov.total_tokens.toLocaleString()} tokens
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Model Usage & Cost Breakdown Table */}
            <div className="rounded-xl border border-primary/15 bg-accent/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-primary uppercase">
                    Model Usage & Estimated Cost Breakdown
                  </h3>
                  <p className="text-[11px] text-muted">
                    Token usage and estimated costs using versioned rates effective at the time of each run.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-primary/10 text-muted uppercase text-[10px]">
                    <tr>
                      <th className="py-2 font-medium">Model</th>
                      <th className="py-2 font-medium">Provider</th>
                      <th className="py-2 font-medium">Runs</th>
                      <th className="py-2 font-medium">Input Tokens</th>
                      <th className="py-2 font-medium">Output Tokens</th>
                      <th className="py-2 font-medium">Total Tokens</th>
                      <th className="py-2 font-medium">Estimated Cost</th>
                      <th className="py-2 font-medium">Active Rate ($/1M)</th>
                      <th className="py-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                    {!costsData?.by_model || costsData.by_model.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-muted">
                          {isCostsLoading
                            ? 'Loading cost metrics...'
                            : 'No model run records found yet.'}
                        </td>
                      </tr>
                    ) : (
                      costsData.by_model.map((m) => {
                        const currentRate = costsData.rates?.find(
                          (r) => r.model_id === m.model_id
                        )
                        return (
                          <tr key={m.model_id} className="hover:bg-accent/30 transition">
                            <td className="py-2.5 font-medium text-primary">
                              {m.model_id}
                            </td>
                            <td className="py-2.5 text-muted">
                              {m.provider}
                            </td>
                            <td className="py-2.5 text-muted">
                              {m.runs}
                            </td>
                            <td className="py-2.5 text-muted">
                              {m.input_tokens.toLocaleString()}
                            </td>
                            <td className="py-2.5 text-muted">
                              {m.output_tokens.toLocaleString()}
                            </td>
                            <td className="py-2.5 text-muted">
                              {m.total_tokens.toLocaleString()}
                            </td>
                            <td className="py-2.5 font-semibold text-emerald-400">
                              ${m.total_cost.toFixed(4)}
                            </td>
                            <td className="py-2.5 text-[11px] text-muted">
                              {currentRate ? (
                                <span>
                                  In: ${currentRate.input_cost_per_m} / Out: ${currentRate.output_cost_per_m}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => {
                                  if (currentRate) {
                                    setEditingRate({
                                      model_id: currentRate.model_id,
                                      provider: currentRate.provider,
                                      input_cost_per_m: currentRate.input_cost_per_m,
                                      output_cost_per_m: currentRate.output_cost_per_m
                                    })
                                  } else {
                                    setEditingRate({
                                      model_id: m.model_id,
                                      provider: m.provider,
                                      input_cost_per_m: 1.0,
                                      output_cost_per_m: 2.0
                                    })
                                  }
                                  setIsPricingModalOpen(true)
                                }}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-primary hover:bg-accent border border-primary/20 transition"
                              >
                                <Edit3 className="size-3" /> Edit Rate
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="rounded-xl border border-primary/15 bg-accent/20 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-primary uppercase">
                Daily Aggregation History
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-primary/10 text-muted uppercase text-[10px]">
                    <tr>
                      <th className="py-2 font-medium">Date</th>
                      <th className="py-2 font-medium">Agent Runs</th>
                      <th className="py-2 font-medium">Team Runs</th>
                      <th className="py-2 font-medium">Input Tokens</th>
                      <th className="py-2 font-medium">Output Tokens</th>
                      <th className="py-2 font-medium">Total Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                    {!metricsData?.metrics || metricsData.metrics.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-6 text-center text-muted"
                        >
                          {isMetricsLoading
                            ? 'Loading metrics...'
                            : 'No metrics aggregated yet. Click "Calculate & Refresh Metrics" to compile past session data.'}
                        </td>
                      </tr>
                    ) : (
                      metricsData.metrics.map((m) => (
                        <tr key={m.id || m.date}>
                          <td className="py-2.5 font-medium text-primary">
                            {dayjs(m.date).format('YYYY-MM-DD')}
                          </td>
                          <td className="py-2.5 text-muted">
                            {m.agent_runs_count}
                          </td>
                          <td className="py-2.5 text-muted">
                            {m.team_runs_count}
                          </td>
                          <td className="py-2.5 text-muted">
                            {m.token_metrics?.input_tokens?.toLocaleString() || 0}
                          </td>
                          <td className="py-2.5 text-muted">
                            {m.token_metrics?.output_tokens?.toLocaleString() || 0}
                          </td>
                          <td className="py-2.5 font-semibold text-foreground">
                            {m.token_metrics?.total_tokens?.toLocaleString() || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pricing Management Modal */}
            {isPricingModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
                <div className="max-w-2xl w-full rounded-2xl border border-primary/20 bg-background p-6 space-y-4 max-h-[85vh] overflow-y-auto font-dmmono shadow-2xl">
                  <div className="flex items-center justify-between border-b border-primary/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Tag className="size-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Model Pricing & Rate Management
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setIsPricingModalOpen(false)
                        setEditingRate(null)
                      }}
                      className="rounded-lg p-1 text-muted hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Informational Callout */}
                  <div className="rounded-xl border border-primary/15 bg-accent/20 p-3 text-xs text-muted space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" /> Immutable Effective-Dated Pricing
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Updating a price rate takes effect <strong>only from this timestamp forward</strong>. Past runs remain calculated with the rate active when they occurred, preserving historical cost integrity.
                    </p>
                  </div>

                  {/* Active Rates List / Editor */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-primary">
                      Current Active Rates ($ / 1 Million Tokens)
                    </h4>

                    {editingRate && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">
                            Update Rate for: <span className="text-primary">{editingRate.model_id}</span>
                          </span>
                          <span className="text-[10px] text-muted uppercase">
                            Provider: {editingRate.provider}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase text-muted block mb-1">
                              Input Cost / 1M ($)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingRate.input_cost_per_m}
                              onChange={(e) =>
                                setEditingRate({
                                  ...editingRate,
                                  input_cost_per_m: parseFloat(e.target.value) || 0
                                })
                              }
                              className="w-full rounded-lg border border-primary/20 bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-muted block mb-1">
                              Output Cost / 1M ($)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingRate.output_cost_per_m}
                              onChange={(e) =>
                                setEditingRate({
                                  ...editingRate,
                                  output_cost_per_m: parseFloat(e.target.value) || 0
                                })
                              }
                              className="w-full rounded-lg border border-primary/20 bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => setEditingRate(null)}
                            className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-accent"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveRate}
                            disabled={isSavingRate}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background hover:bg-primary/90 transition"
                          >
                            <Save className="size-3.5" />
                            {isSavingRate ? 'Saving...' : 'Apply New Rate'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-primary/10">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="border-b border-primary/10 bg-accent/40 text-muted uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5 font-medium">Model</th>
                            <th className="p-2.5 font-medium">Provider</th>
                            <th className="p-2.5 font-medium">Input $/1M</th>
                            <th className="p-2.5 font-medium">Output $/1M</th>
                            <th className="p-2.5 font-medium">Effective From</th>
                            <th className="p-2.5 font-medium text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-primary/10">
                          {pricingData?.current_rates.map((rate) => (
                            <tr key={rate.model_id} className="hover:bg-accent/20 transition">
                              <td className="p-2.5 font-medium text-primary">
                                {rate.model_id}
                              </td>
                              <td className="p-2.5 text-muted">
                                {rate.provider}
                              </td>
                              <td className="p-2.5 text-foreground">
                                ${rate.input_cost_per_m}
                              </td>
                              <td className="p-2.5 text-foreground">
                                ${rate.output_cost_per_m}
                              </td>
                              <td className="p-2.5 text-muted text-[10px]">
                                {dayjs(rate.effective_from).format('YYYY-MM-DD HH:mm')}
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  onClick={() =>
                                    setEditingRate({
                                      model_id: rate.model_id,
                                      provider: rate.provider,
                                      input_cost_per_m: rate.input_cost_per_m,
                                      output_cost_per_m: rate.output_cost_per_m
                                    })
                                  }
                                  className="text-[11px] text-primary hover:underline"
                                >
                                  Update
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Rate Change History Log */}
                  <div className="border-t border-primary/10 pt-3">
                    <button
                      onClick={() => setShowRateHistory(!showRateHistory)}
                      className="flex w-full items-center justify-between text-xs text-muted hover:text-foreground py-1"
                    >
                      <span className="font-semibold uppercase tracking-wider text-[10px]">
                        Rate Change Audit History ({pricingData?.history.length ?? 0} versions)
                      </span>
                      {showRateHistory ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                    </button>

                    {showRateHistory && (
                      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-primary/10 text-[11px]">
                        <table className="w-full text-left">
                          <thead className="bg-accent/30 text-[10px] uppercase text-muted border-b border-primary/10">
                            <tr>
                              <th className="p-2">Model</th>
                              <th className="p-2">Effective From</th>
                              <th className="p-2">In $/1M</th>
                              <th className="p-2">Out $/1M</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-primary/10 text-muted">
                            {pricingData?.history.map((h, idx) => (
                              <tr key={`${h.model_id}-${h.effective_from}-${idx}`}>
                                <td className="p-2 text-primary">{h.model_id}</td>
                                <td className="p-2">{dayjs(h.effective_from).format('YYYY-MM-DD HH:mm:ss')}</td>
                                <td className="p-2">${h.input_cost_per_m}</td>
                                <td className="p-2">${h.output_cost_per_m}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EVALS TAB */}
        {activeTab === 'evals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Evaluation & Reliability Runs
                </h2>
                <p className="text-xs text-muted">
                  Results from synthetic benchmark tests and criteria evaluation cases.
                </p>
              </div>

              <button
                onClick={fetchEvals}
                disabled={isEvalsLoading}
                className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                <RefreshCw
                  className={`size-3.5 ${isEvalsLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {evals.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-primary/15 bg-accent/20 p-8 text-center text-xs text-muted">
                  {isEvalsLoading
                    ? 'Loading evaluations...'
                    : 'No evaluation runs recorded. Run `python -m evals --tag smoke` on your server to record your first evaluation benchmark!'}
                </div>
              ) : (
                evals.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-xl border border-primary/15 bg-accent/30 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">
                        {e.name || e.evaluated_component_name || e.id}
                      </span>
                      {e.eval_data?.eval_status === 'PASSED' ? (
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          PASSED
                        </span>
                      ) : (
                        <span className="rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                          {e.eval_data?.eval_status || 'FAILED'}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-muted">
                      Type: <strong className="text-zinc-300">{e.eval_type}</strong> | Model:{' '}
                      <strong className="text-zinc-300">
                        {e.model_id || 'default'}
                      </strong>
                    </div>

                    {e.eval_data?.reason && (
                      <p className="rounded bg-black/30 p-2 text-[11px] text-zinc-300">
                        {e.eval_data.reason}
                      </p>
                    )}

                    <div className="text-[10px] text-muted">
                      {dayjs(e.created_at).format('MMM D, YYYY HH:mm')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Trace Detail Modal / Drawer */}
      {(selectedTrace || isDetailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-primary/20 bg-background p-6 shadow-2xl overflow-hidden font-dmmono">
            {isDetailLoading || !selectedTrace ? (
              <div className="flex flex-1 items-center justify-center text-xs text-muted">
                Loading trace details...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-primary/15 pb-4">
                  <div>
                    <span className="text-[10px] uppercase text-muted">
                      Execution Trace
                    </span>
                    <h3 className="text-base font-semibold text-primary">
                      {selectedTrace.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedTrace(null)}
                    className="rounded-lg p-1 text-muted hover:text-foreground"
                    aria-label="Close trace details"
                  >
                    <X className="size-5" />
                  </button>
                </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Trace Metadata Bar */}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-primary/10 bg-accent/30 p-3 text-xs">
                <div>
                  <span className="text-muted text-[10px]">Trace ID:</span>
                  <div className="text-foreground truncate">{selectedTrace.trace_id}</div>
                </div>
                <div>
                  <span className="text-muted text-[10px]">Duration:</span>
                  <div className="text-foreground">{selectedTrace.duration}</div>
                </div>
                <div>
                  <span className="text-muted text-[10px]">Total Spans:</span>
                  <div className="text-foreground">{selectedTrace.total_spans}</div>
                </div>
                <div>
                  <span className="text-muted text-[10px]">Status:</span>
                  <div
                    className={
                      selectedTrace.status === 'OK'
                        ? 'text-emerald-400 font-semibold'
                        : 'text-rose-400 font-semibold'
                    }
                  >
                    {selectedTrace.status}
                  </div>
                </div>
              </div>

              {/* Hierarchical Span Tree */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-primary mb-2">
                  Hierarchical Execution Tree
                </h4>
                {selectedTrace.tree && selectedTrace.tree.length > 0 ? (
                  selectedTrace.tree.map((node) => (
                    <SpanNodeView key={node.id} node={node} />
                  ))
                ) : (
                  <p className="text-xs text-muted">
                    No span tree nodes available for this trace.
                  </p>
                )}
              </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
