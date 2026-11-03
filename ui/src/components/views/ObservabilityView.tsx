'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from '@/store'
import {
  getTracesAPI,
  getTraceDetailAPI,
  getMetricsAPI,
  refreshMetricsAPI,
  getEvalRunsAPI
} from '@/api/os'
import {
  TraceSummary,
  TraceDetail,
  TraceNode,
  MetricsResponse,
  EvalSchema
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
  Terminal,
  Zap,
  Sparkles
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { toast } from 'sonner'

dayjs.extend(relativeTime)

type ObservabilityTab = 'traces' | 'metrics' | 'evals'

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
  const { selectedEndpoint, authToken } = useStore()
  const [activeTab, setActiveTab] = useState<ObservabilityTab>('traces')

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
    if (activeTab === 'metrics') fetchMetrics()
    if (activeTab === 'evals') fetchEvals()
  }, [activeTab, fetchTraces, fetchMetrics, fetchEvals])

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
        await fetchMetrics()
      } else {
        toast.error('Failed to trigger metrics refresh')
      }
    } finally {
      setIsRefreshingMetrics(false)
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
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-background text-foreground font-dmmono">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-primary/10 px-6 py-4">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-primary">
            <Activity className="size-5" /> Observability & Traces
          </h1>
          <p className="text-xs text-muted">
            Inspect model latency, token consumption, execution trees, and benchmarks.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-primary/15 bg-accent/40 p-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('traces')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'traces'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Layers className="size-3.5" /> Traces
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'metrics'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <BarChart3 className="size-3.5" /> Metrics & Tokens
          </button>
          <button
            onClick={() => setActiveTab('evals')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="Search traces..."
                    value={traceSearch}
                    onChange={(e) => setTraceSearch(e.target.value)}
                    className="h-9 w-64 rounded-xl border border-primary/15 bg-accent/40 pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
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

        {/* METRICS TAB */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Token Throughput & Execution Costs
                </h2>
                <p className="text-xs text-muted">
                  Aggregated from PostgreSQL storage on your AgentOS server.
                </p>
              </div>

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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  {totalTokens.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted mt-1">
                  In: {inputTokens.toLocaleString()} | Out:{' '}
                  {outputTokens.toLocaleString()}
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
      {selectedTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-primary/20 bg-background p-6 shadow-2xl overflow-hidden font-dmmono">
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
          </div>
        </div>
      )}
    </div>
  )
}
