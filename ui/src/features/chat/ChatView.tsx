'use client'

import { FileUp, X } from 'lucide-react'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent
} from 'react'
import { toast } from 'sonner'
import type { StickToBottomContext } from 'use-stick-to-bottom'

import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Sheet, SheetClose } from '@/components/ui/dialog'
import { CREATE_LINKS } from '@/components/shell/nav'
import {
  getActiveRun,
  isLiveMessage,
  stopListening,
  useChatRun,
  type SendInput
} from '@/hooks/useChatRun'
import { sameChat, useChatTranscript } from '@/hooks/useChatTranscript'
import { useStore } from '@/store'
import type { SessionEntry } from '@/types/os'

import { ChatHeader } from './ChatHeader'
import { ChatList } from './ChatList'
import { Composer } from './Composer'
import { Conversation } from './Conversation'
import { hasDraggedFiles, mergeAttachments } from './files'
import { chatTitle } from './format'
import { ModelDialog } from './ModelPicker'
import {
  useChatSessions,
  useDeleteSession,
  type ChatTargetRef
} from './queries'
import { RenameChatDialog } from './RenameChatDialog'
import { chatUrl, defaultTarget, KIND_LABEL, type ChatTarget } from './targets'
import { useChatTarget } from './useChatTarget'
import { useNewChat } from './useNewChat'

/** Closes the chat-list sheet once the persistent column (≥1280px) shows. */
function useCloseOnWide(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const query = window.matchMedia('(min-width: 1280px)')
    const onChange = () => {
      if (query.matches) close()
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [open, close])
}

export function ChatView() {
  const chat = useChatTarget()
  const { target, location, status, requested, targets } = chat
  const messages = useStore((state) => state.messages)
  const isStreaming = useStore((state) => state.isStreaming)
  const agents = useStore((state) => state.agents)
  const teams = useStore((state) => state.teams)
  const setMessages = useStore((state) => state.setMessages)
  const setSessionsData = useStore((state) => state.setSessionsData)
  const confirm = useConfirm()
  const newChat = useNewChat()
  const stickRef = useRef<StickToBottomContext | null>(null)

  const [chatsOpen, setChatsOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [renaming, setRenaming] = useState<SessionEntry | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  const closeChats = useCallback(() => setChatsOpen(false), [])
  useCloseOnWide(chatsOpen, closeChats)

  const memberNames = useMemo(
    () =>
      new Map<string, string>([
        ...agents.map((agent): [string, string] => [
          agent.id,
          agent.name || agent.id
        ]),
        ...teams.map((team): [string, string] => [
          team.id,
          team.name || team.id
        ])
      ]),
    [agents, teams]
  )
  const transcript = useChatTranscript(
    location,
    target?.name ?? '',
    memberNames
  )

  const targetRef = useMemo<ChatTargetRef | null>(
    () =>
      location
        ? { kind: location.kind, id: location.id, dbId: location.dbId }
        : null,
    [location]
  )
  const sessions = useChatSessions(targetRef)
  const loadedSessions = useMemo(
    () => sessions.data?.pages.flatMap((page) => page.items) ?? null,
    [sessions.data]
  )
  // The command palette lists recent chats from the store.
  useEffect(() => {
    setSessionsData(loadedSessions)
  }, [loadedSessions, setSessionsData])

  const { setSession, selectTarget } = chat
  const switchTarget = (next: ChatTarget) => {
    void selectTarget(next)
    window.requestAnimationFrame(() =>
      useStore.getState().chatInputRef.current?.focus()
    )
  }
  const onSessionStarted = useCallback(
    (sessionId: string) => void setSession(sessionId, 'replace'),
    [setSession]
  )
  const runTarget = useMemo(
    () => (location && target ? { location, name: target.name } : null),
    [location, target]
  )
  const run = useChatRun(runTarget, onSessionStarted)

  // Stop listening when the URL moves to another chat mid-response.
  useEffect(() => {
    const active = getActiveRun()
    if (active && location && !sameChat(active.location, location)) {
      stopListening()
    }
  }, [location])

  const deleteSession = useDeleteSession(targetRef)
  const sessionId = location?.sessionId ?? null
  const currentSession: SessionEntry | null = sessionId
    ? (loadedSessions?.find((item) => item.session_id === sessionId) ?? {
        session_id: sessionId,
        session_name:
          messages
            .find((message) => message.role === 'user')
            ?.content.slice(0, 120) ?? ''
      })
    : null

  const onDelete = async (session: SessionEntry) => {
    const confirmed = await confirm({
      title: 'Delete chat?',
      description: `“${chatTitle(session)}” and all its messages will be deleted. This can’t be undone.`,
      confirmLabel: 'Delete chat',
      tone: 'danger'
    })
    if (!confirmed) return
    const open = session.session_id === sessionId
    deleteSession.mutate(session.session_id, {
      onSuccess: () => {
        toast.success('Chat deleted')
        if (open) {
          stopListening()
          setMessages([])
          void setSession(null, 'replace')
        }
      },
      onError: (error) =>
        toast.error("Couldn't delete the chat", {
          description: getErrorMessage(error)
        })
    })
  }

  const addFiles = (files: File[]) => {
    if (!files.length) return
    if (!target) {
      toast.error('Choose who to talk to before attaching files.')
      return
    }
    if (target.kind === 'workflow') {
      toast.error("Workflows take text only, so files can't be attached.")
      return
    }
    const merged = mergeAttachments(attachments, files)
    setAttachments(merged.files)
    if (merged.rejected.length) {
      toast.error(
        merged.rejected.length === 1
          ? `${merged.rejected[0]} can't be attached`
          : `${merged.rejected.length} files can't be attached`,
        {
          description:
            'Attach PDF, text, Markdown, CSV, JSON, code, image or audio files.'
        }
      )
    }
  }

  const send = (text: string) => {
    const input: SendInput = { text, files: attachments }
    setAttachments([])
    void stickRef.current?.scrollToBottom()
    void run.send(input)
  }

  const onDragEnter = (event: DragEvent) => {
    if (!hasDraggedFiles(event.dataTransfer)) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  const onDragOver = (event: DragEvent) => {
    if (!hasDraggedFiles(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect =
      target && target.kind !== 'workflow' ? 'copy' : 'none'
  }
  const onDragLeave = (event: DragEvent) => {
    if (!hasDraggedFiles(event.dataTransfer)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const onDrop = (event: DragEvent) => {
    if (!hasDraggedFiles(event.dataTransfer)) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  const notice =
    status === 'offline' ? (
      <>
        AgentOS can’t be reached, so messages can’t be sent.{' '}
        <Link
          href="/settings"
          className="text-accent underline underline-offset-2"
        >
          Check the connection in Settings
        </Link>
        .
      </>
    ) : status === 'empty' ? (
      <>
        There’s nothing to chat with yet.{' '}
        <Link
          href={CREATE_LINKS.agent}
          className="text-accent underline underline-offset-2"
        >
          Create an agent in Studio
        </Link>{' '}
        or check the host in{' '}
        <Link
          href="/settings"
          className="text-accent underline underline-offset-2"
        >
          Settings
        </Link>
        .
      </>
    ) : status === 'missing' && requested ? (
      <>
        {KIND_LABEL[requested.kind]}{' '}
        <span className="font-mono">{requested.id}</span> isn’t available.
        Choose who to talk to above.
      </>
    ) : target && transcript.error ? (
      'This chat couldn’t be loaded. Try again, or start a new chat.'
    ) : null

  // Announce how a response that streamed in this tab ended.
  const last = messages[messages.length - 1]
  const announcement =
    !last || !isLiveMessage(last) || last.status === 'streaming'
      ? ''
      : last.status === 'error'
        ? `${last.author ?? 'The agent'} failed to respond.`
        : last.status === 'cancelled'
          ? 'Response stopped.'
          : last.status === 'paused'
            ? 'The run is waiting for approval.'
            : `${last.author ?? 'The agent'} replied.`

  const listProps = {
    target,
    targetStatus: status,
    sessions,
    activeSessionId: sessionId,
    deletingSessionId: deleteSession.isPending
      ? (deleteSession.variables ?? null)
      : null,
    hrefFor: (id: string) =>
      location
        ? chatUrl(location.kind, location.id, {
            sessionId: id,
            dbId: location.dbId
          })
        : '/',
    onNewChat: newChat,
    onRename: setRenaming,
    onDelete: (session: SessionEntry) => void onDelete(session)
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="hidden w-72 shrink-0 flex-col border-r border-line bg-canvas xl:flex">
        <ChatList {...listProps} />
      </div>
      <Sheet open={chatsOpen} onOpenChange={setChatsOpen} title="Chats">
        <ChatList
          {...listProps}
          onNavigate={closeChats}
          closeButton={
            <SheetClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close chats">
                <X />
              </Button>
            </SheetClose>
          }
        />
      </Sheet>

      <section
        aria-label="Conversation"
        className="relative flex min-w-0 flex-1 flex-col"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <ChatHeader
          target={target}
          targets={targets}
          status={status}
          requested={requested}
          chatsOpen={chatsOpen}
          hasSession={Boolean(currentSession)}
          onOpenChats={() => setChatsOpen(true)}
          onSelectTarget={switchTarget}
          onNewChat={newChat}
          onRename={() => setRenaming(currentSession)}
          onDelete={() => {
            if (currentSession) void onDelete(currentSession)
          }}
          onOpenModel={() => setModelOpen(true)}
        />
        <Conversation
          target={target}
          status={status}
          requested={requested}
          fallback={defaultTarget(targets)}
          messages={messages}
          isStreaming={isStreaming}
          transcript={transcript}
          chatKey={`${location?.kind}:${location?.id}:${transcript.loading}`}
          stickRef={stickRef}
          onSelectTarget={switchTarget}
          onNewChat={newChat}
          onRetry={run.retry}
        />
        <Composer
          name={target?.name ?? null}
          notice={notice}
          busy={!target || transcript.loading}
          isStreaming={isStreaming}
          allowFiles={target?.kind !== 'workflow'}
          attachments={attachments}
          onAddFiles={addFiles}
          onRemoveFile={(index) =>
            setAttachments((files) =>
              files.filter((_, position) => position !== index)
            )
          }
          onSend={send}
          onStop={run.stop}
        />
        {dragging ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-2 z-20 flex animate-fade-in flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-surface/90 text-center backdrop-blur-sm"
          >
            <FileUp className="size-6 text-accent" />
            <p className="font-medium text-fg">
              {target && target.kind !== 'workflow'
                ? 'Drop files to attach'
                : 'Workflows take text only'}
            </p>
          </div>
        ) : null}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </section>

      {target && target.kind !== 'workflow' ? (
        <ModelDialog
          target={target}
          open={modelOpen}
          onOpenChange={setModelOpen}
        />
      ) : null}
      <RenameChatDialog
        session={renaming}
        target={targetRef}
        onClose={() => setRenaming(null)}
      />
    </div>
  )
}
