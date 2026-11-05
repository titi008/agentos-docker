export interface Model {
  name: string
  model: string
  provider: string
}

export interface Agent {
  agent_id: string
  name: string
  description: string
  model: Model
  storage?: boolean
}

export interface Team {
  team_id: string
  name: string
  description: string
  model: Model
  storage?: boolean
}

export interface AgentDetails {
  id: string
  name?: string
  db_id?: string
  model?: Model
  role?: string
  description?: string
  tools?: Array<unknown>
}

export interface TeamDetails {
  id: string
  name?: string
  db_id?: string
  model?: Model
  description?: string
  members?: Array<unknown>
}

// Chat transcript (the chat view's own model of a conversation)

/** A file the operator attached to a message. */
export interface ChatAttachment {
  name: string
  size: number | null
  type: string | null
}

export type ChatActivityStatus = 'running' | 'done' | 'failed' | 'stopped'

export interface ChatToolCall {
  id: string
  name: string
  args: Record<string, unknown> | null
  result: string | null
  /** Error text when the tool call failed. */
  error: string | null
  status: ChatActivityStatus
  durationMs: number | null
  /** Team member or workflow step that made the call; null for the target itself. */
  member: string | null
}

export interface ChatWorkflowStep {
  id: string
  name: string
  index: number | null
  status: ChatActivityStatus
  output: string | null
  error: string | null
  durationMs: number | null
}

export interface ReasoningStep {
  title?: string | null
  action?: string | null
  result?: string | null
  reasoning?: string | null
  next_action?: string | null
  confidence?: number | null
}

export interface Reference {
  name?: string
  content?: string
  meta_data?: Record<string, unknown>
}

/** Knowledge retrieved for one query (agno `MessageReferences`). */
export interface ReferenceGroup {
  query: string
  references?: Array<Reference | string> | null
  time?: number | null
}

export interface ImageData {
  id?: string
  url?: string
  /** Base64 bytes when the image is not hosted. */
  content?: string
  mime_type?: string
  revised_prompt?: string
  alt_text?: string
}

export interface VideoData {
  id?: string | number
  url?: string
  content?: string
  mime_type?: string
}

export interface AudioData {
  id?: string
  url?: string
  /** Base64 bytes; raw PCM16 when no mime type is given. */
  content?: string
  base64_audio?: string
  mime_type?: string
  sample_rate?: number
  channels?: number
  transcript?: string
}

export interface ChatRunMetrics {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  durationMs: number | null
}

/**
 * `streaming` while the response arrives; `pending` for a run that is still
 * executing on the server when the chat was loaded; `paused` while a run
 * waits for an approval.
 */
export type ChatMessageStatus =
  'streaming' | 'done' | 'error' | 'cancelled' | 'paused' | 'pending'

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  /** Markdown. */
  content: string
  /** Epoch milliseconds. */
  createdAt: number
  files?: ChatAttachment[]
  /** Display name of the agent, team or workflow that answered. */
  author?: string
  runId?: string | null
  model?: string | null
  status?: ChatMessageStatus
  error?: string | null
  reasoningSteps?: ReasoningStep[]
  /** Free-form thinking text from reasoning models. */
  reasoningContent?: string
  toolCalls?: ChatToolCall[]
  steps?: ChatWorkflowStep[]
  references?: ReferenceGroup[]
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  responseAudio?: AudioData | null
  metrics?: ChatRunMetrics | null
}

// Sessions (GET /sessions, agno SessionSchema)

export interface SessionEntry {
  session_id: string
  session_name: string
  /** ISO date from AgentOS; unix seconds in older responses. */
  created_at?: string | number | null
  updated_at?: string | number | null
}

export interface Pagination {
  page: number
  limit: number
  total_pages: number
  total_count: number
}

export interface Sessions {
  data: SessionEntry[]
  meta: Pagination
}

// Runs as AgentOS streams and stores them (agno 3.1)

/** agno `ToolExecution`. */
export interface ToolExecution {
  tool_call_id?: string | null
  tool_name?: string | null
  tool_args?: Record<string, unknown> | null
  tool_call_error?: boolean | null
  result?: unknown
  metrics?: { duration?: number | null; time?: number | null } | null
  created_at?: number | null
}

/** agno `RunMetrics`; durations are in seconds. */
export interface RunMetricsPayload {
  input_tokens?: number | null
  output_tokens?: number | null
  total_tokens?: number | null
  duration?: number | null
  details?: Record<string, Array<{ id?: string; provider?: string }>> | null
}

/** agno `StepOutput`. */
export interface StepOutputPayload {
  step_name?: string | null
  step_id?: string | null
  content?: unknown
  success?: boolean | null
  error?: string | null
  metrics?: RunMetricsPayload | null
}

/** One server-sent event of an agent, team or workflow run. */
export interface RunEventPayload {
  event: string
  run_id?: string | null
  parent_run_id?: string | null
  session_id?: string | null
  agent_id?: string | null
  agent_name?: string | null
  team_id?: string | null
  team_name?: string | null
  workflow_id?: string | null
  step_id?: string | null
  step_name?: string | null
  step_index?: number | number[] | null
  /** 0 for the top-level workflow, higher for nested workflows. */
  nested_depth?: number | null
  content?: unknown
  reasoning_content?: string | null
  reasoning_steps?: ReasoningStep[] | null
  references?: ReferenceGroup[] | null
  tool?: ToolExecution | null
  tools?: ToolExecution[] | null
  images?: ImageData[] | null
  image?: ImageData | null
  videos?: VideoData[] | null
  audio?: AudioData[] | null
  response_audio?: AudioData | null
  metrics?: RunMetricsPayload | null
  model?: string | null
  error?: string | null
  reason?: string | null
  step_output?: StepOutputPayload | null
  step_response?: StepOutputPayload | null
  created_at?: number | null
}

/** A run from GET /sessions/{id}/runs (agno RunSchema, TeamRunSchema or WorkflowRunSchema). */
export interface SessionRun {
  run_id: string
  parent_run_id?: string | null
  agent_id?: string | null
  team_id?: string | null
  workflow_id?: string | null
  status?: string | null
  run_input?: string | null
  content?: unknown
  reasoning_content?: string | null
  reasoning_steps?: ReasoningStep[] | null
  metrics?: RunMetricsPayload | null
  tools?: ToolExecution[] | null
  references?: ReferenceGroup[] | null
  images?: ImageData[] | null
  videos?: VideoData[] | null
  audio?: AudioData[] | null
  response_audio?: AudioData | null
  input_media?: {
    images?: unknown[]
    videos?: unknown[]
    audios?: unknown[]
    files?: unknown[]
  } | null
  step_results?: StepOutputPayload[] | null
  /** Session state at the end of the run (holds this app's `model_override`). */
  session_state?: Record<string, unknown> | null
  created_at?: string | number | null
}

// Observability & Traces
export interface TraceSummary {
  trace_id: string
  name: string
  status: 'OK' | 'ERROR' | string
  duration: string
  start_time: string
  end_time?: string
  total_spans: number
  error_count: number
  input?: string
  output?: string
  run_id?: string
  session_id?: string
  user_id?: string
  agent_id?: string
  team_id?: string
  workflow_id?: string
  created_at: string
}

export interface TraceNode {
  id: string
  name: string
  type: 'AGENT' | 'LLM' | 'TOOL' | 'TEAM' | 'WORKFLOW' | string
  duration: string
  start_time: string
  end_time?: string
  status: 'OK' | 'ERROR' | string
  input?: string | null
  output?: string | null
  error?: string | null
  spans?: TraceNode[]
  step_type?: string | null
  metadata?: Record<string, unknown> | null
  extra_data?: Record<string, unknown> | null
}

export interface TraceDetail extends TraceSummary {
  tree: TraceNode[]
}

export interface DayAggregatedMetrics {
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
    prompt_tokens?: number
    completion_tokens?: number
  }
  model_metrics?: Array<{
    model?: string
    provider?: string
    runs?: number
    total_tokens?: number
    input_tokens?: number
    output_tokens?: number
  }>
  date: string
}

export interface MetricsResponse {
  metrics: DayAggregatedMetrics[]
  updated_at?: string
}

export interface AvailableModel {
  id: string
  provider: string
}

export interface ModelPriceRate {
  model_id: string
  provider: string
  input_cost_per_m: number
  output_cost_per_m: number
  effective_from: string
}

export interface PricingResponse {
  current_rates: ModelPriceRate[]
  history: ModelPriceRate[]
}

// Approvals
export interface ApprovalResponse {
  id: string
  run_id: string
  session_id: string
  status: 'pending' | 'approved' | 'rejected' | string
  source_type: string
  approval_type?: string
  tool_name?: string
  tool_args?: Record<string, unknown>
  created_at?: number
}

// Company Wiki & Playbook
export interface WikiPageMeta {
  path: string
  size_bytes: number
  version?: number | null
  updated_at?: number | null
  user_id?: string | null
}

// Workflows
export interface WorkflowSummaryResponse {
  id: string
  name?: string
  description?: string
  db_id?: string
  is_factory?: boolean
  is_component?: boolean
  current_version?: number
  stage?: string
  sandboxed?: boolean
  steps?: Array<{
    name?: string
    executor_type?: string
    description?: string
  }>
}

// Studio Components
export interface ComponentResponse {
  id: string
  component_id: string
  component_type: 'agent' | 'team' | 'workflow'
  name?: string
  user_id?: string
  description?: string
  current_version?: number
  metadata?: Record<string, unknown>
  created_at: number
  updated_at?: number
  deleted_at?: number
}

export interface ComponentConfigResponse {
  component_id: string
  version: number
  label?: string
  stage: string
  config: Record<string, unknown>
  notes?: string
  created_at: number
  updated_at?: number
}

// Registry
export interface RegistryContentResponse {
  name: string
  type: string
  id?: string
  description?: string
  metadata?: Record<string, unknown>
  sandboxed?: boolean
}
