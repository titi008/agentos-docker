'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'
import {
  addSessionToCache,
  removeSessionFromCache,
  useChatQueryKeys
} from '@/features/chat/queries'
import { useStore, type ChatLocation } from '@/store'
import type { ChatAttachment, ChatMessage } from '@/types/os'

import {
  applyRunEvent,
  createRunStreamState,
  isRunStartEvent,
  isTopLevelEvent,
  markStopped,
  settleUnfinished
} from './runEvents'
import { streamRun } from './runStream'

/** Sent when the operator attaches files without typing anything. */
const FILES_ONLY_PROMPT = 'Please review and analyze the attached file(s).'

interface ActiveRun {
  controller: AbortController
  /** Mutable: `sessionId` is filled in when the server starts a new session. */
  location: ChatLocation
  runId: string | null
  createdSession: boolean
}

interface LastInput {
  userMessageId: string
  text: string
  files: File[]
}

/*
 * One chat streams at a time. The handle lives at module level so Stop and
 * navigation can reach it even after the chat view remounted.
 */
let activeRun: ActiveRun | null = null
let lastInput: LastInput | null = null
let messageCounter = 0

const LOCAL_PREFIX = 'local-'

function nextMessageId(): string {
  messageCounter += 1
  return `${LOCAL_PREFIX}${Date.now().toString(36)}-${messageCounter}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Whether a message was sent or streamed in this tab (not loaded from history). */
export function isLiveMessage(message: ChatMessage): boolean {
  return message.id.startsWith(LOCAL_PREFIX)
}

/** The run that is streaming right now, if any. */
export function getActiveRun(): Readonly<ActiveRun> | null {
  return activeRun
}

/** Stops listening to the current response without cancelling it on the server. */
export function stopListening(): void {
  activeRun?.controller.abort()
}

/** Whether the failed answer `message` can be sent again with the same input. */
export function canRetry(messages: ChatMessage[], message: ChatMessage) {
  const last = messages[messages.length - 1]
  const previous = messages[messages.length - 2]
  if (last?.id !== message.id || message.status !== 'error') return false
  if (previous?.role !== 'user') return false
  // Attachments can only be re-sent while their File objects are in memory.
  return (
    !previous.files?.length ||
    (lastInput?.userMessageId === previous.id && lastInput.files.length > 0)
  )
}

function focusComposer() {
  if (!window.matchMedia('(pointer: fine)').matches) return
  window.requestAnimationFrame(() =>
    useStore.getState().chatInputRef.current?.focus()
  )
}

export interface ChatRunTarget {
  location: ChatLocation
  /** Shown as the author of answers. */
  name: string
}

export interface SendInput {
  text: string
  files: File[]
}

/**
 * Sends messages to an agent, team or workflow and streams the answer into
 * the transcript. `onSessionStarted` puts a newly created session in the URL.
 */
export function useChatRun(
  target: ChatRunTarget | null,
  onSessionStarted: (sessionId: string) => void
) {
  const api = useApi()
  const qc = useQueryClient()
  const keys = useChatQueryKeys()

  const send = useCallback(
    async ({ text, files }: SendInput) => {
      const store = useStore.getState()
      if (!target || store.isStreaming) return
      const typed = text.trim()
      const message = typed || (files.length ? FILES_ONLY_PROMPT : '')
      if (!message) return

      const location = { ...target.location }
      const sessionsKey = keys.sessions(location)
      const attachments: ChatAttachment[] = files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || null
      }))
      const userMessage: ChatMessage = {
        id: nextMessageId(),
        role: 'user',
        content: message,
        createdAt: Date.now(),
        files: attachments.length ? attachments : undefined
      }
      const answer: ChatMessage = {
        id: nextMessageId(),
        role: 'agent',
        author: target.name,
        content: '',
        createdAt: Date.now(),
        status: 'streaming'
      }
      lastInput = { userMessageId: userMessage.id, text, files }

      const body = new FormData()
      body.append('message', message)
      for (const file of files) body.append('files', file)
      body.append('stream', 'true')
      if (location.sessionId) body.append('session_id', location.sessionId)
      if (api.ctx.userId) body.append('user_id', api.ctx.userId)

      const headers: Record<string, string> = {}
      if (location.kind !== 'workflow' && store.selectedModel) {
        headers['X-Model-Override'] = store.selectedModel
      }

      const run: ActiveRun = {
        controller: new AbortController(),
        location,
        runId: null,
        createdSession: false
      }
      activeRun = run
      store.setMessages((messages) => [...messages, userMessage, answer])
      store.setIsStreaming(true)

      const update = (change: (message: ChatMessage) => ChatMessage) =>
        useStore
          .getState()
          .setMessages((messages) =>
            messages.map((item) =>
              item.id === answer.id ? change(item) : item
            )
          )

      const startSession = (sessionId: string) => {
        run.location.sessionId = sessionId
        run.createdSession = true
        const entry = {
          session_id: sessionId,
          session_name: message.slice(0, 120),
          created_at: new Date().toISOString()
        }
        addSessionToCache(qc, sessionsKey, entry)
        useStore.getState().setActiveChat({ ...run.location })
        // Only touch the URL while the chat is on screen.
        if (window.location.pathname === '/') onSessionStarted(sessionId)
      }

      const forgetSession = () => {
        const sessionId = run.location.sessionId
        if (!run.createdSession || !sessionId) return
        removeSessionFromCache(qc, sessionsKey, sessionId)
      }

      const streamState = createRunStreamState(location.kind)
      let failed = false
      try {
        await streamRun({
          ctx: api.ctx,
          path: `/${location.kind}s/${encodeURIComponent(location.id)}/runs`,
          body,
          headers,
          signal: run.controller.signal,
          onEvent: (event) => {
            if (
              isRunStartEvent(event) &&
              isTopLevelEvent(event, location.kind)
            ) {
              run.runId = event.run_id || run.runId
              if (!run.location.sessionId && event.session_id) {
                startSession(event.session_id)
              }
            }
            update((current) => applyRunEvent(current, event, streamState))
          }
        })
        update(settleUnfinished)
        const settled = useStore
          .getState()
          .messages.find((item) => item.id === answer.id)
        failed = settled?.status === 'error'
      } catch (error) {
        if (isAbortError(error)) {
          update(markStopped)
        } else {
          failed = true
          update((current) => ({
            ...current,
            status: 'error',
            error: getErrorMessage(error, api.ctx.endpoint)
          }))
        }
      } finally {
        if (activeRun === run) activeRun = null
        useStore.getState().setIsStreaming(false)
        if (failed) forgetSession()
        else void qc.invalidateQueries({ queryKey: sessionsKey })
        focusComposer()
      }
    },
    [api.ctx, keys, qc, target, onSessionStarted]
  )

  /** Stops the response here and asks the server to cancel the run. */
  const stop = useCallback(() => {
    const run = activeRun
    if (!run) return
    run.controller.abort()
    if (!run.runId) return
    const { kind, id, sessionId } = run.location
    api
      .request(
        `/${kind}s/${encodeURIComponent(id)}/runs/${encodeURIComponent(run.runId)}/cancel`,
        { method: 'POST', query: { session_id: sessionId } }
      )
      .catch((error: unknown) =>
        toast.error("Couldn't cancel the run on the server", {
          description: getErrorMessage(error, api.ctx.endpoint)
        })
      )
  }, [api])

  /** Sends the last message again after a failed answer. */
  const retry = useCallback(() => {
    const { messages, setMessages } = useStore.getState()
    const failedAnswer = messages[messages.length - 1]
    const question = messages[messages.length - 2]
    if (!failedAnswer || !canRetry(messages, failedAnswer) || !question) return
    const input =
      lastInput?.userMessageId === question.id
        ? { text: lastInput.text, files: lastInput.files }
        : { text: question.content, files: [] }
    setMessages(messages.slice(0, -2))
    void send(input)
  }, [send])

  return { send, stop, retry }
}
