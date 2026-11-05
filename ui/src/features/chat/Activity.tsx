'use client'

import {
  Activity as ActivityIcon,
  BookOpen,
  ChevronDown,
  Lightbulb,
  ListOrdered,
  LoaderCircle,
  Wrench
} from 'lucide-react'
import { memo, useId, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { CodeBlock, formatJson } from '@/components/ui/code'
import { Markdown } from '@/components/ui/markdown'
import { formatDuration } from '@/lib/time'
import { cn } from '@/lib/utils'
import type {
  ChatActivityStatus,
  ChatMessage,
  ChatToolCall,
  ChatWorkflowStep,
  ReasoningStep,
  ReferenceGroup
} from '@/types/os'

import { argumentSummary, plural } from './format'

function StatusBadge({
  status,
  durationMs
}: {
  status: ChatActivityStatus
  durationMs: number | null
}) {
  const duration = durationMs === null ? '' : ` · ${formatDuration(durationMs)}`
  switch (status) {
    case 'running':
      return (
        <Badge tone="info">
          <LoaderCircle aria-hidden className="size-3 animate-spin" />
          Running
        </Badge>
      )
    case 'failed':
      return (
        <Badge tone="bad" dot>
          Failed{duration}
        </Badge>
      )
    case 'stopped':
      return (
        <Badge tone="neutral" dot>
          Stopped
        </Badge>
      )
    default:
      return (
        <Badge tone="ok" dot>
          Done{duration}
        </Badge>
      )
  }
}

interface ActivityRowProps {
  icon: ReactNode
  title: ReactNode
  summary?: ReactNode
  badge?: ReactNode
  children: ReactNode
}

/** One expandable line of the activity block. */
function ActivityRow({
  icon,
  title,
  summary,
  badge,
  children
}: ActivityRowProps) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-fg-2 transition-colors hover:bg-hover max-md:min-h-12 max-md:text-sm"
      >
        <span aria-hidden className="shrink-0 text-fg-3 [&_svg]:size-4">
          {icon}
        </span>
        <span className="min-w-0 shrink-0 truncate max-md:shrink">{title}</span>
        <span className="min-w-0 flex-1 truncate text-fg-3">{summary}</span>
        {badge}
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-fg-3 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      <div id={bodyId} hidden={!open} className="px-3 pb-3 md:pl-[38px]">
        {open ? children : null}
      </div>
    </div>
  )
}

function stepText(step: ReasoningStep): string[] {
  return [
    step.reasoning,
    step.action ? `Action: ${step.action}` : null,
    step.result ? `Result: ${step.result}` : null,
    typeof step.confidence === 'number'
      ? `Confidence: ${Math.round(step.confidence * 100)}%`
      : null
  ].filter((part): part is string => Boolean(part))
}

function ReasoningRow({
  steps,
  content,
  streaming
}: {
  steps: ReasoningStep[]
  content: string | undefined
  streaming: boolean
}) {
  const title = steps.length
    ? `Reasoned in ${plural(steps.length, 'step')}`
    : streaming
      ? 'Reasoning…'
      : 'Reasoned'
  return (
    <ActivityRow icon={<Lightbulb />} title={title}>
      <div className="flex flex-col gap-3">
        {steps.length ? (
          <ol className="flex flex-col gap-2.5">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-2.5 text-[13px] text-fg-2">
                <span
                  aria-hidden
                  className="grid size-[22px] shrink-0 place-items-center rounded-full bg-hover text-xs font-semibold text-fg-2"
                >
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium text-fg">
                    {step.title || `Step ${index + 1}`}
                  </span>
                  {stepText(step).map((text, line) => (
                    <p key={line} className="break-words whitespace-pre-wrap">
                      {text}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {content ? (
          <Markdown content={content} className="text-[13px] text-fg-2" />
        ) : null}
      </div>
    </ActivityRow>
  )
}

function ToolRow({ call }: { call: ChatToolCall }) {
  const args = argumentSummary(call.args)
  const summary = [call.member ? `via ${call.member}` : null, args]
    .filter(Boolean)
    .join(' · ')
  const showResult = call.result !== null && call.result !== call.error
  return (
    <ActivityRow
      icon={<Wrench />}
      title={
        <span className="font-mono text-[12.5px] text-fg">{call.name}</span>
      }
      summary={summary}
      badge={<StatusBadge status={call.status} durationMs={call.durationMs} />}
    >
      <div className="flex flex-col gap-2.5">
        {call.error ? (
          <p className="rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] break-words whitespace-pre-wrap text-fg">
            {call.error}
          </p>
        ) : null}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-2.5">
          <CodeBlock
            label="Arguments"
            code={call.args ? formatJson(call.args) : 'No arguments'}
            copyable={Boolean(call.args)}
            maxHeight="16rem"
          />
          {showResult ? (
            <CodeBlock
              label="Result"
              code={formatJson(call.result)}
              maxHeight="16rem"
            />
          ) : call.status === 'running' ? (
            <p className="flex items-center gap-2 text-[13px] text-fg-3">
              <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
              Waiting for the result…
            </p>
          ) : call.error ? null : (
            <p className="text-[13px] text-fg-3">
              The tool returned no output.
            </p>
          )}
        </div>
      </div>
    </ActivityRow>
  )
}

function StepRow({ step }: { step: ChatWorkflowStep }) {
  return (
    <ActivityRow
      icon={<ListOrdered />}
      title={<span className="font-medium text-fg">{step.name}</span>}
      summary={step.index !== null ? `Step ${step.index + 1}` : null}
      badge={<StatusBadge status={step.status} durationMs={step.durationMs} />}
    >
      <div className="flex flex-col gap-2.5">
        {step.error ? (
          <p className="rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] break-words whitespace-pre-wrap text-fg">
            {step.error}
          </p>
        ) : null}
        {step.output ? (
          <div className="max-h-72 overflow-y-auto rounded-[10px] border border-line bg-canvas px-3.5 py-3">
            <Markdown content={step.output} className="text-[13px]" />
          </div>
        ) : step.error ? null : (
          <p className="text-[13px] text-fg-3">
            {step.status === 'running'
              ? 'This step is still running.'
              : 'The step produced no output.'}
          </p>
        )}
      </div>
    </ActivityRow>
  )
}

function ReferenceRow({ group }: { group: ReferenceGroup }) {
  const references = group.references ?? []
  return (
    <ActivityRow
      icon={<BookOpen />}
      title="Searched knowledge"
      summary={group.query ? `“${group.query}”` : null}
      badge={<Badge>{plural(references.length, 'result')}</Badge>}
    >
      {references.length ? (
        <ol className="flex flex-col gap-2">
          {references.map((reference, index) => {
            const item =
              typeof reference === 'string' ? { content: reference } : reference
            const chunk = item.meta_data?.chunk
            return (
              <li
                key={index}
                className="flex flex-col gap-1 rounded-lg border border-line bg-canvas px-3 py-2"
              >
                <span className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                  <span className="font-medium text-fg">
                    {item.name || `Result ${index + 1}`}
                  </span>
                  {typeof chunk === 'number' ? (
                    <span className="text-xs text-fg-3">Chunk {chunk}</span>
                  ) : null}
                </span>
                {item.content ? (
                  <p className="line-clamp-4 text-[13px] break-words whitespace-pre-wrap text-fg-2">
                    {item.content}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-[13px] text-fg-3">No matching content was found.</p>
      )}
    </ActivityRow>
  )
}

function activitySummary(message: ChatMessage): string {
  const parts: string[] = []
  const steps = message.reasoningSteps?.length ?? 0
  if (steps) parts.push(`reasoned in ${plural(steps, 'step')}`)
  else if (message.reasoningContent) parts.push('reasoned')
  if (message.steps?.length)
    parts.push(`ran ${plural(message.steps.length, 'step')}`)
  if (message.toolCalls?.length) {
    parts.push(`used ${plural(message.toolCalls.length, 'tool')}`)
  }
  if (message.references?.length) {
    parts.push(
      `searched knowledge ${plural(message.references.length, 'time')}`
    )
  }
  const text = parts.join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * What the agent did before answering: reasoning, tool calls, workflow steps
 * and knowledge searches. Rows expand to show arguments, results and output.
 * Phones show one summary line that opens the list.
 */
export const Activity = memo(function Activity({
  message
}: {
  message: ChatMessage
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const reasoningSteps = message.reasoningSteps ?? []
  const hasReasoning =
    reasoningSteps.length > 0 || Boolean(message.reasoningContent)
  const toolCalls = message.toolCalls ?? []
  const steps = message.steps ?? []
  const references = message.references ?? []
  if (
    !hasReasoning &&
    !toolCalls.length &&
    !steps.length &&
    !references.length
  ) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface max-md:rounded-xl">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-fg-2 hover:bg-hover md:hidden"
      >
        <ActivityIcon aria-hidden className="size-4 shrink-0 text-fg-3" />
        <span className="min-w-0 flex-1">{activitySummary(message)}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-fg-3 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      <div
        id={listId}
        className={cn(
          'divide-y divide-line max-md:border-t max-md:border-line',
          !open && 'max-md:hidden'
        )}
      >
        {hasReasoning ? (
          <ReasoningRow
            steps={reasoningSteps}
            content={message.reasoningContent}
            streaming={message.status === 'streaming'}
          />
        ) : null}
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
        {toolCalls.map((call) => (
          <ToolRow key={call.id} call={call} />
        ))}
        {references.map((group, index) => (
          <ReferenceRow key={`${group.query}-${index}`} group={group} />
        ))}
      </div>
    </div>
  )
})
