import { toDate } from '@/lib/time'
import type {
  ChatAttachment,
  ChatMessage,
  ChatMessageStatus,
  SessionRun
} from '@/types/os'

import {
  contentToMarkdown,
  mapRunMetrics,
  modelFromMetrics,
  stepFromOutput,
  toolCallFromExecution
} from './runEvents'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function runStatus(status: string | null | undefined): ChatMessageStatus {
  switch ((status ?? '').toUpperCase()) {
    case 'ERROR':
      return 'error'
    case 'CANCELLED':
      return 'cancelled'
    case 'PAUSED':
      return 'paused'
    case 'RUNNING':
    case 'PENDING':
      return 'pending'
    default:
      return 'done'
  }
}

function attachmentsOf(run: SessionRun): ChatAttachment[] {
  const media = run.input_media
  if (!media) return []
  const items = [
    ...(media.files ?? []),
    ...(media.images ?? []),
    ...(media.audios ?? []),
    ...(media.videos ?? [])
  ]
  return items.filter(isRecord).map((item) => {
    const name = [item.name, item.filename, item.filepath, item.url, item.id]
      .find((value) => typeof value === 'string' && value)
      ?.toString()
      .split('/')
      .pop()
    return {
      name: name || 'Attachment',
      size: typeof item.size === 'number' ? item.size : null,
      type: typeof item.mime_type === 'string' ? item.mime_type : null
    }
  })
}

function timestamp(value: SessionRun['created_at']): number {
  return toDate(value)?.getTime() ?? Date.now()
}

/**
 * Turns the runs of a session into transcript messages: one user message and
 * one answer per top-level run. Team member runs (they carry a
 * `parent_run_id`) contribute their tool calls to the leader's answer.
 */
export function messagesFromRuns(
  runs: SessionRun[],
  author: string,
  memberNames: ReadonlyMap<string, string>
): ChatMessage[] {
  const children = new Map<string, SessionRun[]>()
  for (const run of runs) {
    if (!run.parent_run_id) continue
    const siblings = children.get(run.parent_run_id) ?? []
    siblings.push(run)
    children.set(run.parent_run_id, siblings)
  }

  const memberLabel = (run: SessionRun) => {
    const id = run.agent_id || run.team_id
    return id ? (memberNames.get(id) ?? id) : null
  }

  return runs
    .filter((run) => !run.parent_run_id)
    .flatMap((run): ChatMessage[] => {
      const createdAt = timestamp(run.created_at)
      const status = runStatus(run.status)
      const files = attachmentsOf(run)
      const toolCalls = [
        ...(run.tools ?? []).map((tool) => toolCallFromExecution(tool)),
        ...(children.get(run.run_id) ?? []).flatMap((child) =>
          (child.tools ?? []).map((tool) =>
            toolCallFromExecution(tool, { member: memberLabel(child) })
          )
        )
      ]
      const steps = (run.step_results ?? []).map((output, index) =>
        stepFromOutput(output, index)
      )

      return [
        {
          id: `${run.run_id}:input`,
          role: 'user',
          content: run.run_input ?? '',
          createdAt,
          files: files.length ? files : undefined
        },
        {
          id: `${run.run_id}:output`,
          role: 'agent',
          author,
          content: contentToMarkdown(run.content),
          createdAt,
          runId: run.run_id,
          model: modelFromMetrics(run.metrics),
          status,
          error: status === 'error' ? 'This run ended with an error.' : null,
          reasoningSteps: run.reasoning_steps ?? undefined,
          reasoningContent: run.reasoning_content || undefined,
          toolCalls: toolCalls.length ? toolCalls : undefined,
          steps: steps.length ? steps : undefined,
          references: run.references?.length ? run.references : undefined,
          images: run.images?.length ? run.images : undefined,
          videos: run.videos?.length ? run.videos : undefined,
          audio: run.audio?.length ? run.audio : undefined,
          responseAudio: run.response_audio ?? null,
          metrics: mapRunMetrics(run.metrics)
        }
      ]
    })
}

/**
 * The model override stored in the chat's session state by the app's
 * X-Model-Override middleware; it applies to every later run of the session.
 */
export function modelOverrideFromRuns(runs: SessionRun[]): string | null {
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const run = runs[index]
    if (run.parent_run_id) continue
    const override = run.session_state?.model_override
    if (typeof override === 'string' && override) return override
  }
  return null
}
