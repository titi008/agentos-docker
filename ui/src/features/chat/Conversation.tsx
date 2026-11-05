'use client'

import { ArrowDown, MessageSquareOff, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useEffect, type ReactNode, type RefObject } from 'react'
import {
  StickToBottom,
  useStickToBottomContext,
  type StickToBottomContext
} from 'use-stick-to-bottom'

import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { CREATE_LINKS } from '@/components/shell/nav'
import {
  EmptyState,
  ErrorState,
  Skeleton,
  Spinner
} from '@/components/ui/states'
import { canRetry } from '@/hooks/useChatRun'
import type { ChatMode } from '@/store'
import type { ChatMessage } from '@/types/os'

import { BlankState } from './BlankState'
import { AgentMessage, UserMessage } from './MessageItem'
import { KIND_LABEL, type ChatTarget } from './targets'
import type { ChatTargetStatus } from './useChatTarget'

function ScrollToLatest() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  if (isAtBottom) return null
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label="Scroll to the latest message"
      onClick={() => void scrollToBottom()}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 animate-fade-in rounded-full shadow-pop"
    >
      <ArrowDown />
    </Button>
  )
}

function TranscriptSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-7">
      <span className="sr-only">Loading chat…</span>
      {[0, 1].map((index) => (
        <div key={index} aria-hidden className="flex flex-col gap-7">
          <Skeleton className="ml-auto h-14 w-3/4 rounded-[14px] md:w-1/2" />
          <div className="flex gap-3">
            <Skeleton className="size-[30px] shrink-0 rounded-lg max-md:hidden" />
            <div className="flex flex-1 flex-col gap-2.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full rounded-[10px]" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-3/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TargetState({
  status,
  requested,
  fallback,
  onSelect
}: {
  status: ChatTargetStatus
  requested: { kind: ChatMode; id: string } | null
  fallback: ChatTarget | null
  onSelect: (target: ChatTarget) => void
}) {
  switch (status) {
    case 'offline':
      return (
        <EmptyState
          icon={<WifiOff />}
          title="Not connected to AgentOS"
          description="Agents, chats and history load once the server can be reached."
          action={
            <Button size="sm" asChild>
              <Link href="/settings">Connection settings</Link>
            </Button>
          }
        />
      )
    case 'empty':
      return (
        <EmptyState
          title="Nothing to chat with yet"
          description="This AgentOS has no agents, teams or workflows. Create one in Studio, or check that Settings points at the right host."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="primary" asChild>
                <Link href={CREATE_LINKS.agent}>Create an agent</Link>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href="/settings">Settings</Link>
              </Button>
            </div>
          }
        />
      )
    case 'missing':
      return (
        <EmptyState
          icon={<MessageSquareOff />}
          title={`This ${requested ? KIND_LABEL[requested.kind].toLowerCase() : 'agent'} isn’t available`}
          description={
            <>
              <span className="font-mono">{requested?.id}</span> isn’t on this
              server. It may have been removed or renamed. Choose someone else
              to talk to above.
            </>
          }
          action={
            fallback ? (
              <Button size="sm" onClick={() => onSelect(fallback)}>
                Chat with {fallback.name}
              </Button>
            ) : null
          }
        />
      )
    default:
      return (
        <div
          role="status"
          className="flex items-center justify-center gap-2 py-12 text-[13px] text-fg-3"
        >
          <Spinner />
          Loading agents, teams and workflows…
        </div>
      )
  }
}

interface ConversationProps {
  target: ChatTarget | null
  status: ChatTargetStatus
  requested: { kind: ChatMode; id: string } | null
  fallback: ChatTarget | null
  messages: ChatMessage[]
  isStreaming: boolean
  transcript: {
    loading: boolean
    error: unknown
    retrying: boolean
    retry: () => void
  }
  /** Changes whenever another chat's transcript is shown. */
  chatKey: string
  stickRef: RefObject<StickToBottomContext | null>
  onSelectTarget: (target: ChatTarget) => void
  onNewChat: () => void
  onRetry: () => void
}

/** Scrolling transcript that sticks to the newest message while it streams. */
export function Conversation({
  target,
  status,
  requested,
  fallback,
  messages,
  isStreaming,
  transcript,
  chatKey,
  stickRef,
  onSelectTarget,
  onNewChat,
  onRetry
}: ConversationProps) {
  useEffect(() => {
    void stickRef.current?.scrollToBottom('instant')
  }, [chatKey, stickRef])

  let body: ReactNode
  if (!target) {
    body = (
      <div className="flex flex-1 flex-col justify-center">
        <TargetState
          status={status}
          requested={requested}
          fallback={fallback}
          onSelect={onSelectTarget}
        />
      </div>
    )
  } else if (transcript.error) {
    const notFound =
      transcript.error instanceof ApiError && transcript.error.status === 404
    body = (
      <div className="flex flex-1 flex-col justify-center">
        {notFound ? (
          <EmptyState
            icon={<MessageSquareOff />}
            title="This chat isn’t available"
            description="It may have been deleted, or it belongs to someone else."
            action={
              <Button size="sm" onClick={onNewChat}>
                Start a new chat
              </Button>
            }
          />
        ) : (
          <ErrorState
            title="Couldn't load this chat"
            error={transcript.error}
            onRetry={transcript.retry}
            retrying={transcript.retrying}
          />
        )}
      </div>
    )
  } else if (transcript.loading) {
    body = <TranscriptSkeleton />
  } else if (!messages.length) {
    body = (
      <div className="flex flex-1 flex-col justify-end">
        <BlankState target={target} />
      </div>
    )
  } else {
    body = messages.map((message) =>
      message.role === 'user' ? (
        <UserMessage key={message.id} message={message} />
      ) : (
        <AgentMessage
          key={message.id}
          message={message}
          kind={target.kind}
          canRetry={!isStreaming && canRetry(messages, message)}
          onRetry={onRetry}
        />
      )
    )
  }

  return (
    <StickToBottom
      className="relative min-h-0 flex-1"
      resize="smooth"
      initial="instant"
      contextRef={stickRef}
    >
      <StickToBottom.Content
        scrollClassName="overscroll-contain"
        className="mx-auto flex min-h-full w-full max-w-[780px] flex-col gap-7 px-6 pt-7 pb-3 max-md:gap-[22px] max-md:px-4 max-md:pt-5"
      >
        {body}
      </StickToBottom.Content>
      <ScrollToLatest />
    </StickToBottom>
  )
}
