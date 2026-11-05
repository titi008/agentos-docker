'use client'

import {
  Activity as TraceIcon,
  CircleAlert,
  CirclePause,
  FileText,
  Hourglass,
  RotateCcw,
  Square
} from 'lucide-react'
import Link from 'next/link'
import { memo } from 'react'

import { Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/code'
import { Markdown } from '@/components/ui/markdown'
import { formatBytes, formatDateTime, formatDuration } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { ChatMode } from '@/store'
import type { ChatAttachment, ChatMessage } from '@/types/os'

import { Activity } from './Activity'
import { formatTokens, messageTimeLabel } from './format'
import { Audios, Images, Videos } from './Media'
import { KIND_ICON } from './targets'

function AttachmentChips({
  files,
  className
}: {
  files: ChatAttachment[]
  className?: string
}) {
  return (
    <ul
      className={cn('flex flex-wrap gap-1.5', className)}
      aria-label="Attachments"
    >
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`} className="max-w-full">
          <Chip className="max-w-full max-md:h-[30px] max-md:text-[13px]">
            <FileText aria-hidden />
            <span className="truncate" title={file.name}>
              {file.name}
            </span>
            {file.size ? (
              <span className="text-fg-3">{formatBytes(file.size)}</span>
            ) : null}
          </Chip>
        </li>
      ))}
    </ul>
  )
}

export const UserMessage = memo(function UserMessage({
  message
}: {
  message: ChatMessage
}) {
  return (
    <article aria-label="You" className="flex justify-end">
      <div className="flex max-w-[85%] min-w-0 flex-col gap-2 rounded-[14px_14px_4px_14px] border border-line bg-raised px-3.5 py-2.5 max-md:max-w-[88%] max-md:rounded-[16px_16px_4px_16px]">
        {message.content ? (
          <Markdown content={message.content} className="max-md:text-[15px]" />
        ) : null}
        {message.files?.length ? (
          <AttachmentChips files={message.files} />
        ) : null}
      </div>
    </article>
  )
})

function WritingIndicator({ message }: { message: ChatMessage }) {
  const runningTool = message.toolCalls?.find(
    (call) => call.status === 'running'
  )
  const label = runningTool
    ? `Running ${runningTool.name}`
    : !message.content && message.reasoningContent
      ? 'Reasoning'
      : 'Writing'
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
      <span className="truncate">{label}</span>
      <span aria-hidden className="inline-flex shrink-0 items-center gap-[3px]">
        <i className="size-[5px] animate-blink rounded-full bg-fg-3" />
        <i className="size-[5px] animate-blink rounded-full bg-fg-3 [animation-delay:200ms]" />
        <i className="size-[5px] animate-blink rounded-full bg-fg-3 [animation-delay:400ms]" />
      </span>
    </span>
  )
}

function uniqueSourceNames(message: ChatMessage): string[] {
  const names = new Set<string>()
  for (const group of message.references ?? []) {
    for (const reference of group.references ?? []) {
      if (typeof reference !== 'string' && reference.name) {
        names.add(reference.name)
      }
    }
  }
  return Array.from(names)
}

function Sources({ names }: { names: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 max-md:flex-col max-md:items-stretch">
      <span className="text-[12.5px] text-fg-3 max-md:text-xs">Sources</span>
      <ul className="flex flex-wrap gap-1.5 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-0.5">
        {names.map((name) => (
          <li key={name}>
            <Chip className="max-md:h-8 max-md:text-[13px]">
              <FileText aria-hidden />
              {name}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusNote({
  message,
  canRetry,
  onRetry
}: {
  message: ChatMessage
  canRetry: boolean
  onRetry: () => void
}) {
  switch (message.status) {
    case 'error':
      return (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-bad/40 bg-bad-soft p-3"
        >
          <CircleAlert
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-bad"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-[13.5px] font-medium text-fg">
              The response failed
            </p>
            <p className="text-[13px] break-words text-fg-2">
              {message.error ||
                'Something went wrong while the agent was working.'}
            </p>
          </div>
          {canRetry ? (
            <Button size="sm" onClick={onRetry}>
              <RotateCcw />
              Retry
            </Button>
          ) : null}
        </div>
      )
    case 'cancelled':
      return (
        <p className="flex items-center gap-1.5 text-[13px] text-fg-3">
          <Square aria-hidden className="size-3 fill-current" />
          {message.error ? `Stopped: ${message.error}` : 'Response stopped.'}
        </p>
      )
    case 'paused':
      return (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-warn/40 bg-warn-soft p-3">
          <CirclePause
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-warn"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-[13.5px] font-medium text-fg">
              Waiting for approval
            </p>
            <p className="text-[13px] text-fg-2">
              The run is paused until someone approves or rejects its request.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link href="/approvals">Open approvals</Link>
          </Button>
        </div>
      )
    case 'pending':
      return (
        <p className="flex items-center gap-1.5 text-[13px] text-fg-3">
          <Hourglass aria-hidden className="size-3.5" />
          Still running on the server. Open this chat again later for the
          result.
        </p>
      )
    default:
      return null
  }
}

function MetaLine({ message }: { message: ChatMessage }) {
  const parts = [
    { key: 'model', text: message.model, mono: true, phone: false },
    {
      key: 'duration',
      text:
        message.metrics?.durationMs != null
          ? formatDuration(message.metrics.durationMs)
          : null,
      mono: false,
      phone: true
    },
    {
      key: 'tokens',
      text:
        message.metrics?.totalTokens != null
          ? formatTokens(message.metrics.totalTokens)
          : null,
      mono: false,
      phone: false
    }
  ].filter((part) => part.text)
  if (!parts.length) return null
  return (
    <span className="ml-1.5 min-w-0 text-xs text-fg-3 tabular-nums max-md:ml-auto">
      {parts.map((part, index) => {
        const separatorOnPhone = parts
          .slice(0, index)
          .some((previous) => previous.phone)
        return (
          <span
            key={part.key}
            className={part.phone ? undefined : 'max-md:hidden'}
          >
            {index > 0 ? (
              <span
                aria-hidden
                className={
                  part.phone && !separatorOnPhone ? 'max-md:hidden' : undefined
                }
              >
                {' · '}
              </span>
            ) : null}
            <span className={part.mono ? 'font-mono' : undefined}>
              {part.text}
            </span>
          </span>
        )
      })}
    </span>
  )
}

interface AgentMessageProps {
  message: ChatMessage
  kind: ChatMode
  canRetry: boolean
  onRetry: () => void
}

export const AgentMessage = memo(function AgentMessage({
  message,
  kind,
  canRetry,
  onRetry
}: AgentMessageProps) {
  const Icon = KIND_ICON[kind]
  const streaming = message.status === 'streaming'
  const author = message.author || 'Agent'
  const transcript = message.responseAudio?.transcript
  const responseAudio =
    message.responseAudio?.content || message.responseAudio?.url
      ? [message.responseAudio]
      : []
  const sources = uniqueSourceNames(message)
  const hasMedia = Boolean(
    message.images?.length ||
    message.videos?.length ||
    message.audio?.length ||
    responseAudio.length
  )
  const hasActivity = Boolean(
    message.toolCalls?.length ||
    message.steps?.length ||
    message.reasoningSteps?.length ||
    message.reasoningContent ||
    message.references?.length
  )
  const empty =
    message.status === 'done' &&
    !message.content &&
    !transcript &&
    !hasMedia &&
    !hasActivity
  const date = new Date(message.createdAt)

  return (
    <article
      aria-label={author}
      aria-busy={streaming || undefined}
      className="flex items-start gap-3"
    >
      <span
        aria-hidden
        className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent max-md:hidden"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2 max-md:gap-2.5">
          <span
            aria-hidden
            className="grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-accent-soft text-accent md:hidden"
          >
            <Icon className="size-3.5" />
          </span>
          <span className="truncate font-semibold">{author}</span>
          {streaming ? (
            <WritingIndicator message={message} />
          ) : (
            <time
              dateTime={date.toISOString()}
              title={formatDateTime(date)}
              className="shrink-0 text-xs text-fg-3"
              suppressHydrationWarning
            >
              {messageTimeLabel(date)}
            </time>
          )}
        </div>

        <Activity message={message} />

        {message.content ? (
          <Markdown content={message.content} className="max-md:text-[15px]" />
        ) : transcript ? (
          <Markdown content={transcript} className="max-md:text-[15px]" />
        ) : null}

        {message.videos?.length ? <Videos videos={message.videos} /> : null}
        {message.images?.length ? <Images images={message.images} /> : null}
        {message.audio?.length ? <Audios audio={message.audio} /> : null}
        {responseAudio.length ? <Audios audio={responseAudio} /> : null}

        {sources.length ? <Sources names={sources} /> : null}

        {empty ? (
          <p className="text-[13px] text-fg-3">
            The run finished without a reply.
          </p>
        ) : null}

        <StatusNote message={message} canRetry={canRetry} onRetry={onRetry} />

        {!streaming ? (
          <div className="-ml-2 flex flex-wrap items-center gap-1">
            {message.content ? (
              <CopyButton
                value={message.content}
                label="Copy"
                successMessage="Response copied"
              />
            ) : null}
            {message.runId ? (
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href={`/monitoring/traces?run_id=${encodeURIComponent(message.runId)}`}
                >
                  <TraceIcon />
                  View trace
                </Link>
              </Button>
            ) : null}
            <MetaLine message={message} />
          </div>
        ) : null}
      </div>
    </article>
  )
})
