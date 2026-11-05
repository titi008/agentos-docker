import type { ChatMode } from '@/store'
import type {
  ChatActivityStatus,
  ChatMessage,
  ChatRunMetrics,
  ChatToolCall,
  ChatWorkflowStep,
  ReasoningStep,
  RunEventPayload,
  RunMetricsPayload,
  StepOutputPayload,
  ToolExecution
} from '@/types/os'

/* Shared helpers (also used to map stored runs) ------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonBlock(value: unknown): string {
  try {
    return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
  } catch {
    return `\`\`\`\n${String(value)}\n\`\`\``
  }
}

/** Run output as markdown: text as is, structured output as a JSON block. */
export function contentToMarkdown(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return jsonBlock(value)
}

/** Tool results arrive as strings, objects or nothing. */
export function stringifyResult(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function secondsToMs(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 1000)
    : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function mapRunMetrics(
  metrics: RunMetricsPayload | null | undefined
): ChatRunMetrics | null {
  if (!metrics) return null
  const mapped: ChatRunMetrics = {
    inputTokens: numberOrNull(metrics.input_tokens),
    outputTokens: numberOrNull(metrics.output_tokens),
    totalTokens: numberOrNull(metrics.total_tokens),
    durationMs: secondsToMs(metrics.duration)
  }
  return Object.values(mapped).some((value) => value !== null) ? mapped : null
}

/** The main model of a run, from `metrics.details.model[0].id`. */
export function modelFromMetrics(
  metrics: RunMetricsPayload | null | undefined
): string | null {
  const id = metrics?.details?.model?.[0]?.id
  return typeof id === 'string' && id ? id : null
}

export function toolCallFromExecution(
  tool: ToolExecution,
  options: {
    member?: string | null
    /** Status when the execution itself doesn't settle it (started events). */
    status?: ChatActivityStatus
    error?: string | null
  } = {}
): ChatToolCall {
  const failed = Boolean(tool.tool_call_error) || Boolean(options.error)
  const result = stringifyResult(tool.result)
  return {
    id:
      tool.tool_call_id ||
      `${tool.tool_name ?? 'tool'}-${tool.created_at ?? 'unknown'}`,
    name: tool.tool_name || 'Unnamed tool',
    args: isRecord(tool.tool_args) ? tool.tool_args : null,
    result,
    error: failed ? (options.error ?? result ?? 'The tool call failed.') : null,
    status: failed ? 'failed' : (options.status ?? 'done'),
    durationMs: secondsToMs(tool.metrics?.duration ?? tool.metrics?.time),
    member: options.member ?? null
  }
}

/** Updates a tool call by id or appends it; later events win field by field. */
export function upsertToolCall(
  calls: ChatToolCall[] | undefined,
  next: ChatToolCall
): ChatToolCall[] {
  const list = calls ?? []
  const index = list.findIndex((call) => call.id === next.id)
  if (index === -1) return [...list, next]
  const current = list[index]
  const merged: ChatToolCall = {
    ...current,
    name: next.name || current.name,
    args: next.args ?? current.args,
    result: next.result ?? current.result,
    error: next.error ?? current.error,
    status: next.status,
    durationMs: next.durationMs ?? current.durationMs,
    member: current.member ?? next.member
  }
  return list.map((call, position) => (position === index ? merged : call))
}

export function stepFromOutput(
  output: StepOutputPayload,
  index: number | null
): ChatWorkflowStep {
  const failed = output.success === false || Boolean(output.error)
  return {
    id: output.step_id || output.step_name || `step-${index ?? 0}`,
    name: output.step_name || `Step ${(index ?? 0) + 1}`,
    index,
    status: failed ? 'failed' : 'done',
    output: output.content == null ? null : contentToMarkdown(output.content),
    error: output.error ?? null,
    durationMs: secondsToMs(output.metrics?.duration)
  }
}

function definedFields<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined)
  ) as Partial<T>
}

function upsertStep(
  steps: ChatWorkflowStep[] | undefined,
  next: Partial<ChatWorkflowStep> & { id: string }
): ChatWorkflowStep[] {
  const list = steps ?? []
  const index = list.findIndex((step) => step.id === next.id)
  if (index === -1) {
    const created: ChatWorkflowStep = {
      name: next.id,
      index: null,
      status: 'running',
      output: null,
      error: null,
      durationMs: null,
      ...definedFields(next),
      id: next.id
    }
    return [...list, created]
  }
  return list.map((step, position) =>
    position === index ? { ...step, ...definedFields(next) } : step
  )
}

function isReasoningStep(value: unknown): value is ReasoningStep {
  return (
    isRecord(value) &&
    ['title', 'action', 'result', 'reasoning'].some(
      (key) => typeof value[key] === 'string'
    )
  )
}

/** Marks activity that never reported completion once the run is over. */
function settleActivity(
  message: ChatMessage,
  status: ChatActivityStatus
): Pick<ChatMessage, 'toolCalls' | 'steps'> {
  return {
    toolCalls: message.toolCalls?.map((call) =>
      call.status === 'running' ? { ...call, status } : call
    ),
    steps: message.steps?.map((step) =>
      step.status === 'running' ? { ...step, status } : step
    )
  }
}

/* Event classification -------------------------------------------------- */

const WORKFLOW_EVENT = /^(Workflow|Steps?|Loop|Parallel|Condition|Router)[A-Z]/

type EventScope = 'agent' | 'team' | 'workflow'

function scopeOf(name: string): EventScope {
  if (name.startsWith('Team')) return 'team'
  if (WORKFLOW_EVENT.test(name)) return 'workflow'
  return 'agent'
}

/** Agent and team events share names apart from the `Team` prefix. */
function baseName(name: string): string {
  return name.startsWith('Team') ? name.slice(4) : name
}

/** Whether an event belongs to the target itself rather than a member or step. */
export function isTopLevelEvent(
  event: RunEventPayload,
  kind: ChatMode
): boolean {
  if (event.event === 'error') return true
  if ((event.nested_depth ?? 0) > 0) return false
  const scope = scopeOf(event.event)
  if (kind === 'workflow') return scope === 'workflow'
  return scope === kind && !event.parent_run_id
}

export function isRunStartEvent(event: RunEventPayload): boolean {
  return (
    baseName(event.event) === 'RunStarted' || event.event === 'WorkflowStarted'
  )
}

/** Mutable state of one streamed run that isn't part of the message. */
export interface RunStreamState {
  kind: ChatMode
  /** Content streamed by team members, used when the leader sends none. */
  memberContent: string
}

export function createRunStreamState(kind: ChatMode): RunStreamState {
  return { kind, memberContent: '' }
}

function memberName(event: RunEventPayload): string | null {
  return (
    event.agent_name ||
    event.team_name ||
    event.step_name ||
    event.agent_id ||
    event.team_id ||
    null
  )
}

function applyToolEvent(
  message: ChatMessage,
  event: RunEventPayload,
  member: string | null
): ChatMessage {
  const tool = event.tool
  if (!tool) return message
  const name = baseName(event.event)
  const call = toolCallFromExecution(tool, {
    member,
    status: name === 'ToolCallStarted' ? 'running' : 'done',
    error: name === 'ToolCallError' ? (event.error ?? null) : null
  })
  return { ...message, toolCalls: upsertToolCall(message.toolCalls, call) }
}

function applyNestedEvent(
  message: ChatMessage,
  event: RunEventPayload,
  state: RunStreamState
): ChatMessage {
  const name = baseName(event.event)
  if (name.startsWith('ToolCall')) {
    return applyToolEvent(message, event, memberName(event))
  }
  if (name === 'RunContent' && typeof event.content === 'string') {
    // Workflow steps stream their agents' output live; the final output
    // replaces it on WorkflowCompleted. Team members' output is kept aside.
    if (state.kind === 'workflow') {
      return { ...message, content: message.content + event.content }
    }
    state.memberContent += event.content
  }
  return message
}

function applyCompleted(
  message: ChatMessage,
  event: RunEventPayload,
  state: RunStreamState
): ChatMessage {
  let content = message.content
  if (typeof event.content === 'string' && event.content) {
    content = event.content
  } else if (event.content !== null && event.content !== undefined) {
    content = contentToMarkdown(event.content) || content
  }
  if (!content && state.memberContent) content = state.memberContent

  let toolCalls = message.toolCalls
  for (const tool of event.tools ?? []) {
    toolCalls = upsertToolCall(toolCalls, toolCallFromExecution(tool))
  }

  const settled = settleActivity({ ...message, toolCalls }, 'done')
  return {
    ...message,
    ...settled,
    content,
    status: 'done',
    error: null,
    reasoningSteps: event.reasoning_steps?.length
      ? event.reasoning_steps
      : message.reasoningSteps,
    references: event.references?.length
      ? event.references
      : message.references,
    images: event.images?.length ? event.images : message.images,
    videos: event.videos?.length ? event.videos : message.videos,
    audio: event.audio?.length ? event.audio : message.audio,
    responseAudio: event.response_audio ?? message.responseAudio,
    metrics: mapRunMetrics(event.metrics) ?? message.metrics,
    model: message.model || modelFromMetrics(event.metrics)
  }
}

function stepIndex(event: RunEventPayload): number | null {
  const value = event.step_index
  if (typeof value === 'number') return value
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0]
  return null
}

function stepId(event: RunEventPayload): string {
  return event.step_id || event.step_name || `step-${stepIndex(event) ?? 0}`
}

function applyWorkflowStepEvent(
  message: ChatMessage,
  event: RunEventPayload
): ChatMessage {
  const index = stepIndex(event)
  switch (event.event) {
    case 'StepStarted':
      return {
        ...message,
        steps: upsertStep(message.steps, {
          id: stepId(event),
          name: event.step_name || `Step ${(index ?? 0) + 1}`,
          index,
          status: 'running'
        })
      }
    case 'StepCompleted': {
      const output = event.step_response
      const step = output ? stepFromOutput(output, index) : null
      return {
        ...message,
        steps: upsertStep(message.steps, {
          id: stepId(event),
          name: event.step_name ?? undefined,
          index,
          status: step?.status ?? 'done',
          output:
            step?.output ??
            (event.content == null
              ? undefined
              : contentToMarkdown(event.content)),
          error: step?.error ?? undefined,
          durationMs: step?.durationMs ?? undefined
        })
      }
    }
    case 'StepOutput': {
      if (!event.step_output) return message
      const step = stepFromOutput(event.step_output, index)
      return {
        ...message,
        steps: upsertStep(message.steps, { ...step, id: stepId(event) })
      }
    }
    case 'StepError':
      return {
        ...message,
        steps: upsertStep(message.steps, {
          id: stepId(event),
          name: event.step_name ?? undefined,
          index,
          status: 'failed',
          error: event.error || contentToMarkdown(event.content) || null
        })
      }
    default:
      return message
  }
}

/**
 * Applies one streamed event to the agent message it belongs to. Events of
 * team members and workflow step agents only add tool calls (and live step
 * output for workflows); the target's own events drive the message.
 */
export function applyRunEvent(
  message: ChatMessage,
  event: RunEventPayload,
  state: RunStreamState
): ChatMessage {
  if (!isTopLevelEvent(event, state.kind)) {
    return applyNestedEvent(message, event, state)
  }

  const name = event.event === 'error' ? 'RunError' : baseName(event.event)
  switch (name) {
    case 'RunStarted':
    case 'WorkflowStarted':
      return {
        ...message,
        runId: event.run_id || message.runId,
        model: event.model || message.model
      }
    case 'RunContent': {
      const next: ChatMessage = { ...message }
      if (typeof event.content === 'string') {
        next.content = message.content + event.content
      } else if (event.content !== null && event.content !== undefined) {
        next.content = contentToMarkdown(event.content)
      }
      if (event.reasoning_content) {
        next.reasoningContent =
          (message.reasoningContent ?? '') + event.reasoning_content
      }
      if (event.reasoning_steps?.length) {
        next.reasoningSteps = event.reasoning_steps
      }
      if (event.references?.length) next.references = event.references
      if (event.image) next.images = [...(message.images ?? []), event.image]
      if (event.response_audio?.transcript) {
        next.responseAudio = {
          ...message.responseAudio,
          transcript:
            (message.responseAudio?.transcript ?? '') +
            event.response_audio.transcript
        }
      }
      return next
    }
    case 'ReasoningStep':
      return isReasoningStep(event.content)
        ? {
            ...message,
            reasoningSteps: [...(message.reasoningSteps ?? []), event.content]
          }
        : message
    case 'ReasoningContentDelta':
      return event.reasoning_content
        ? {
            ...message,
            reasoningContent:
              (message.reasoningContent ?? '') + event.reasoning_content
          }
        : message
    case 'ReasoningCompleted':
      return Array.isArray(event.content) &&
        event.content.every(isReasoningStep)
        ? { ...message, reasoningSteps: event.content }
        : message
    case 'ToolCallStarted':
    case 'ToolCallCompleted':
    case 'ToolCallError':
      return applyToolEvent(message, event, null)
    case 'RunCompleted':
    case 'WorkflowCompleted':
      return applyCompleted(message, event, state)
    case 'RunError':
    case 'WorkflowError':
      return {
        ...message,
        ...settleActivity(message, 'stopped'),
        status: 'error',
        error:
          (typeof event.content === 'string' && event.content) ||
          event.error ||
          'The run failed.'
      }
    case 'RunCancelled':
    case 'WorkflowCancelled':
      return {
        ...message,
        ...settleActivity(message, 'stopped'),
        status: 'cancelled',
        error: event.reason || null
      }
    case 'RunPaused':
    case 'WorkflowPaused':
    case 'StepPaused':
      return { ...message, status: 'paused' }
    case 'RunContinued':
      return { ...message, status: 'streaming' }
    default:
      return state.kind === 'workflow'
        ? applyWorkflowStepEvent(message, event)
        : message
  }
}

/** Final state when the stream closed without a terminal event. */
export function settleUnfinished(message: ChatMessage): ChatMessage {
  if (message.status !== 'streaming') return message
  const hasOutput =
    Boolean(message.content) ||
    Boolean(message.toolCalls?.length) ||
    Boolean(message.steps?.length)
  return {
    ...message,
    ...settleActivity(message, hasOutput ? 'done' : 'stopped'),
    status: hasOutput ? 'done' : 'error',
    error: hasOutput
      ? null
      : 'The server closed the connection before the run finished.'
  }
}

/** State after the operator stopped the response. */
export function markStopped(message: ChatMessage): ChatMessage {
  if (message.status !== 'streaming') return message
  return {
    ...message,
    ...settleActivity(message, 'stopped'),
    status: 'cancelled',
    error: null
  }
}
