export interface ToolCall {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id: string
  tool_name: string
  tool_args: Record<string, string>
  tool_call_error: boolean
  metrics: {
    time: number
  }
  created_at: number
}

export interface ReasoningSteps {
  title: string
  action?: string
  result: string
  reasoning: string
  confidence?: number
  next_action?: string
}
export interface ReasoningStepProps {
  index: number
  stepTitle: string
}
export interface ReasoningProps {
  reasoning: ReasoningSteps[]
}

export type ToolCallProps = {
  tools: ToolCall
}
interface ModelMessage {
  content: string | null
  context?: MessageContext[]
  created_at: number
  metrics?: {
    time: number
    prompt_tokens: number
    input_tokens: number
    completion_tokens: number
    output_tokens: number
  }
  name: string | null
  role: string
  tool_args?: unknown
  tool_call_id: string | null
  tool_calls: Array<{
    function: {
      arguments: string
      name: string
    }
    id: string
    type: string
  }> | null
}

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

interface MessageContext {
  query: string
  docs?: Array<Record<string, object>>
  time?: number
}

export enum RunEvent {
  RunStarted = 'RunStarted',
  RunContent = 'RunContent',
  RunCompleted = 'RunCompleted',
  RunError = 'RunError',
  RunOutput = 'RunOutput',
  UpdatingMemory = 'UpdatingMemory',
  ToolCallStarted = 'ToolCallStarted',
  ToolCallCompleted = 'ToolCallCompleted',
  MemoryUpdateStarted = 'MemoryUpdateStarted',
  MemoryUpdateCompleted = 'MemoryUpdateCompleted',
  ReasoningStarted = 'ReasoningStarted',
  ReasoningStep = 'ReasoningStep',
  ReasoningCompleted = 'ReasoningCompleted',
  RunCancelled = 'RunCancelled',
  RunPaused = 'RunPaused',
  RunContinued = 'RunContinued',
  // Team Events
  TeamRunStarted = 'TeamRunStarted',
  TeamRunContent = 'TeamRunContent',
  TeamRunCompleted = 'TeamRunCompleted',
  TeamRunError = 'TeamRunError',
  TeamRunCancelled = 'TeamRunCancelled',
  TeamToolCallStarted = 'TeamToolCallStarted',
  TeamToolCallCompleted = 'TeamToolCallCompleted',
  TeamReasoningStarted = 'TeamReasoningStarted',
  TeamReasoningStep = 'TeamReasoningStep',
  TeamReasoningCompleted = 'TeamReasoningCompleted',
  TeamMemoryUpdateStarted = 'TeamMemoryUpdateStarted',
  TeamMemoryUpdateCompleted = 'TeamMemoryUpdateCompleted',
  // Workflow Events
  WorkflowStarted = 'WorkflowStarted',
  WorkflowCompleted = 'WorkflowCompleted',
  WorkflowError = 'WorkflowError',
  WorkflowCancelled = 'WorkflowCancelled',
  StepStarted = 'StepStarted',
  StepCompleted = 'StepCompleted',
  StepError = 'StepError',
  StepOutput = 'StepOutput',
  ParallelExecutionStarted = 'ParallelExecutionStarted',
  ParallelExecutionCompleted = 'ParallelExecutionCompleted',
  ConditionExecutionStarted = 'ConditionExecutionStarted',
  ConditionExecutionCompleted = 'ConditionExecutionCompleted',
  LoopExecutionStarted = 'LoopExecutionStarted',
  LoopIterationStarted = 'LoopIterationStarted',
  LoopIterationCompleted = 'LoopIterationCompleted',
  LoopExecutionCompleted = 'LoopExecutionCompleted',
  RouterExecutionStarted = 'RouterExecutionStarted',
  RouterExecutionCompleted = 'RouterExecutionCompleted'
}

export interface ResponseAudio {
  id?: string
  content?: string
  transcript?: string
  channels?: number
  sample_rate?: number
}

export interface NewRunResponse {
  status: 'RUNNING' | 'PAUSED' | 'CANCELLED'
}

export interface RunResponseContent {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall
  tools?: Array<ToolCall>
  created_at: number
  extra_data?: AgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface RunResponse {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall
  tools?: Array<ToolCall>
  created_at: number
  extra_data?: AgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface AgentExtraData {
  reasoning_steps?: ReasoningSteps[]
  reasoning_messages?: ReasoningMessage[]
  references?: ReferenceData[]
}

export interface AgentExtraData {
  reasoning_messages?: ReasoningMessage[]
  references?: ReferenceData[]
}

export interface ReasoningMessage {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id?: string
  tool_name?: string
  tool_args?: Record<string, string>
  tool_call_error?: boolean
  metrics?: {
    time: number
  }
  created_at?: number
}

export interface AttachedFileMeta {
  name: string
  size: number
  type: string
}

export interface ChatMessage {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  streamingError?: boolean
  created_at: number
  tool_calls?: ToolCall[]
  extra_data?: {
    reasoning_steps?: ReasoningSteps[]
    reasoning_messages?: ReasoningMessage[]
    references?: ReferenceData[]
  }
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
  files?: AttachedFileMeta[]
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

export interface ImageData {
  revised_prompt: string
  url: string
}

export interface VideoData {
  id: number
  eta: number
  url: string
}

export interface AudioData {
  base64_audio?: string
  mime_type?: string
  url?: string
  id?: string
  content?: string
  channels?: number
  sample_rate?: number
}

export interface ReferenceData {
  query: string
  references: Reference[]
  time?: number
}

export interface Reference {
  content: string
  meta_data: {
    chunk: number
    chunk_size: number
  }
  name: string
}

export interface SessionEntry {
  session_id: string
  session_name: string
  created_at: number
  updated_at?: number
}

export interface Pagination {
  page: number
  limit: number
  total_pages: number
  total_count: number
}

export interface Sessions extends SessionEntry {
  data: SessionEntry[]
  meta: Pagination
}

export interface ChatEntry {
  message: {
    role: 'user' | 'system' | 'tool' | 'assistant'
    content: string
    created_at: number
  }
  response: {
    content: string
    tools?: ToolCall[]
    extra_data?: {
      reasoning_steps?: ReasoningSteps[]
      reasoning_messages?: ReasoningMessage[]
      references?: ReferenceData[]
    }
    images?: ImageData[]
    videos?: VideoData[]
    audio?: AudioData[]
    response_audio?: {
      transcript?: string
    }
    created_at: number
  }
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

export interface ProviderCostSummary {
  provider: string
  runs: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_cost: number
  percentage: number
}

export interface ModelCostSummary {
  model_id: string
  provider: string
  runs: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_cost: number
}

export interface DailyCostSummary {
  date: string
  runs: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_cost: number
}

export interface CostBreakdownResponse {
  total_cost: number
  total_runs: number
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  by_provider: ProviderCostSummary[]
  by_model: ModelCostSummary[]
  daily_history: DailyCostSummary[]
  rates: ModelPriceRate[]
}

export interface EvalSchema {
  id: string
  agent_id?: string
  team_id?: string
  workflow_id?: string
  model_id?: string
  model_provider?: string
  name?: string
  evaluated_component_name?: string
  eval_type: 'accuracy' | 'reliability' | 'performance' | string
  eval_data: {
    eval_status?: 'PASSED' | 'FAILED' | string
    score?: number
    failed_tool_calls?: string[]
    passed_tool_calls?: string[]
    metrics?: Record<string, unknown>
    reason?: string
  }
  eval_input?: {
    expected_tool_calls?: string[]
    expected_output?: string
    criteria?: string
  }
  created_at?: string
  updated_at?: string
}

// Memory & Learnings
export interface UserMemorySchema {
  memory_id: string
  memory: string
  topics?: string[]
  agent_id?: string
  team_id?: string
  user_id?: string
  updated_at?: string
}

export interface UserStatsSchema {
  user_id: string
  total_memories: number
  last_memory_updated_at?: string
}

export interface LearningResponse {
  learning_id: string
  learning_type: string
  namespace?: string
  user_id?: string
  agent_id?: string
  team_id?: string
  session_id?: string
  entity_id?: string
  entity_type?: string
  content?: Record<string, unknown>
  metadata?: Record<string, unknown>
  created_at?: number
  updated_at?: number
}

// Knowledge Base
export interface ContentResponseSchema {
  id: string
  name?: string
  description?: string
  type?: string
  size?: string
  status?: 'processing' | 'completed' | 'failed' | string
  status_message?: string
  created_at?: string
  updated_at?: string
}

export interface VectorSearchResult {
  id?: string
  content: string
  name?: string
  meta_data?: Record<string, unknown>
  reranking_score?: number
}

// Operations & Scheduling
export interface ScheduleResponse {
  id: string
  name: string
  description?: string
  method: string
  endpoint: string
  cron_expr?: string
  timezone: string
  enabled: boolean
  next_run_at?: number
  created_at?: number
  updated_at?: number
}

export interface ScheduleRunResponse {
  id: string
  schedule_id: string
  attempt: number
  triggered_at?: number
  completed_at?: number
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | string
  error?: string
  output?: Record<string, unknown>
  created_at?: number
}

// Job Queue
export interface QueueJobSchema {
  id: string
  component_type: string
  component_id: string
  session_id: string
  job_type: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string
  attempt: number
  max_attempts: number
  error?: string
  created_at?: number
  completed_at?: number
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

// Company Tasks
export interface CompanyProduct {
  id: string
  name: string
  purpose?: string
  created_at?: number
}

export interface CompanyProject {
  id: string
  product_id: string
  name: string
  outcome?: string
  status: 'active' | 'completed' | 'archived' | string
  created_at?: number
}

export interface CompanyTask {
  id: string
  product_id: string
  project_id?: string
  title: string
  brief?: string
  status: 'backlog' | 'ready' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
  executor_type?: string
  executor_id?: string
  created_at?: number
  updated_at?: number
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

export interface ComponentCreatePayload {
  name: string
  component_id?: string
  component_type: 'agent' | 'team' | 'workflow'
  description?: string
  metadata?: Record<string, unknown>
  config?: Record<string, unknown>
  label?: string
  stage?: 'draft' | 'published'
  notes?: string
  set_current?: boolean
}

export interface ConfigCreatePayload {
  config: Record<string, unknown>
  version?: number
  label?: string
  stage?: 'draft' | 'published'
  notes?: string
  set_current?: boolean
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

// Filesystem
export interface FileSystemEntry {
  path: string
  type: 'file' | 'directory'
  size_bytes?: number
  version?: number
  updated_at?: number
  user_id?: string
}

export interface FileSystemTableEntry {
  namespace: string
  path: string
  agent_ids: string[]
  size_bytes?: number
  version?: number
  updated_at?: number
  user_id?: string
  snippet?: string
  line?: number
  match_count?: number
}

export interface FileSystemContentResponse {
  namespace: string
  agent_ids: string[]
  path: string
  content: string
  size_bytes?: number
  version?: number
  updated_at?: number
  user_id?: string
  line_count: number
  truncated: boolean
  offset: number
  limit: number
  next_offset?: number | null
}

