/**
 * Response shapes of the monitoring endpoints, matching Agno 3.1.12
 * (`agno/os/routers/{traces,metrics,evals}`) and the application's
 * `/pricing` and `/costs` routes (`app/main.py`, `app/pricing.py`).
 * Optional fields are omitted by the server when they are null.
 */

export interface PaginationMeta {
  page: number
  limit: number
  total_pages: number
  total_count: number
  search_time_ms?: number
}

export interface Paginated<T> {
  data: T[]
  meta?: PaginationMeta
}

/* Traces ------------------------------------------------------------------ */

export type TraceStatus = 'OK' | 'ERROR' | 'UNSET' | (string & {})

export interface TraceSummary {
  trace_id: string
  name: string
  status: TraceStatus
  /** Server-formatted duration, e.g. "150ms" or "1.50s". */
  duration: string
  start_time: string
  end_time: string
  total_spans: number
  error_count: number
  input?: string
  run_id?: string
  session_id?: string
  user_id?: string
  agent_id?: string
  team_id?: string
  workflow_id?: string
  created_at: string
}

export type SpanType =
  'AGENT' | 'TEAM' | 'WORKFLOW' | 'LLM' | 'TOOL' | (string & {})

export interface TraceNode {
  id: string
  name: string
  type: SpanType
  duration: string
  start_time?: string
  end_time?: string
  status: TraceStatus
  input?: string
  output?: string
  error?: string
  /** Child spans, ordered by start time. */
  spans?: TraceNode[]
  step_type?: string
  metadata?: Record<string, unknown>
  extra_data?: Record<string, unknown>
}

export interface TraceDetail extends TraceSummary {
  output?: string
  error?: string
  tree: TraceNode[]
}

/* Metrics ----------------------------------------------------------------- */

export interface DayMetrics {
  id: string
  agent_runs_count: number
  agent_sessions_count: number
  team_runs_count: number
  team_sessions_count: number
  workflow_runs_count: number
  workflow_sessions_count: number
  users_count: number
  token_metrics?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
    [key: string]: number | undefined
  }
  model_metrics?: Array<{
    model_id?: string
    model_provider?: string
    count?: number
  }>
  /** UTC midnight of the aggregated day. */
  date: string
  created_at: string
  updated_at: string
}

export interface MetricsResponse {
  metrics: DayMetrics[]
  updated_at?: string | null
}

export interface MetricsRefreshStatus {
  status: 'started' | 'already_running' | (string & {})
  message?: string | null
}

/* Pricing & costs (application endpoints) --------------------------------- */

export interface PriceRate {
  model_id: string
  provider: string
  input_cost_per_m: number
  output_cost_per_m: number
  /** ISO 8601 UTC timestamp from which the rate applies. */
  effective_from: string
}

export interface PricingResponse {
  current_rates: PriceRate[]
  history: PriceRate[]
}

export interface UpdatePriceRequest {
  model_id: string
  input_cost_per_m: number
  output_cost_per_m: number
  provider?: string
}

export interface ProviderCost {
  provider: string
  runs: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_cost: number
  percentage: number
}

export interface ModelCost {
  model_id: string
  provider: string
  runs: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_cost: number
}

export interface DailyCost {
  /** UTC day, YYYY-MM-DD. */
  date: string
  runs: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_cost: number
}

export interface CostBreakdown {
  total_cost: number
  total_runs: number
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  by_provider: ProviderCost[]
  by_model: ModelCost[]
  daily_history: DailyCost[]
  rates: PriceRate[]
}

/* Evaluations ------------------------------------------------------------- */

export type EvalType =
  'accuracy' | 'agent_as_judge' | 'performance' | 'reliability' | (string & {})

export interface EvalRun {
  id: string
  agent_id?: string | null
  team_id?: string | null
  workflow_id?: string | null
  model_id?: string | null
  model_provider?: string | null
  name?: string | null
  evaluated_component_name?: string | null
  user_id?: string | null
  eval_type: EvalType
  /** Result payload; its shape depends on `eval_type`. */
  eval_data: Record<string, unknown>
  /** Parameters the evaluation ran with (criteria, expected tool calls, …). */
  eval_input?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
}
