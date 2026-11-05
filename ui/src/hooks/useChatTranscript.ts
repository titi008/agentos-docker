'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { unwrapList, useApi } from '@/api/client'
import { CHAT_KEY, useChatQueryKeys } from '@/features/chat/queries'
import { useStore, type ChatLocation } from '@/store'
import type { SessionRun } from '@/types/os'

import { messagesFromRuns, modelOverrideFromRuns } from './transcript'

export function sameChat(
  a: ChatLocation | null,
  b: ChatLocation | null
): boolean {
  return (
    a !== null &&
    b !== null &&
    a.kind === b.kind &&
    a.id === b.id &&
    (a.sessionId ?? null) === (b.sessionId ?? null)
  )
}

/**
 * Keeps the transcript in the store in step with the chat in the URL: loads
 * a session's runs when the URL points at another session, and clears the
 * transcript for a new chat. Nothing changes while a response streams; the
 * stream itself moves a new chat into its session.
 */
export function useChatTranscript(
  location: ChatLocation | null,
  author: string,
  memberNames: ReadonlyMap<string, string>
) {
  const api = useApi()
  const keys = useChatQueryKeys()
  const activeChat = useStore((state) => state.activeChat)
  const isStreaming = useStore((state) => state.isStreaming)
  const setMessages = useStore((state) => state.setMessages)
  const setActiveChat = useStore((state) => state.setActiveChat)
  const setSelectedModel = useStore((state) => state.setSelectedModel)

  const current = sameChat(location, activeChat)
  const sessionId = location?.sessionId ?? null
  const needsLoad = Boolean(location && sessionId) && !current && !isStreaming

  const runs = useQuery({
    queryKey:
      location && sessionId
        ? keys.sessionRuns(location, sessionId)
        : api.key(CHAT_KEY, 'session-runs', 'none'),
    queryFn: async ({ signal }) => {
      const value = await api.request<unknown>(
        `/sessions/${encodeURIComponent(sessionId ?? '')}/runs`,
        {
          signal,
          query: {
            type: location?.kind,
            db_id: location?.dbId,
            user_id: api.ctx.userId
          }
        }
      )
      return unwrapList<SessionRun>(value)
    },
    enabled: api.ready && needsLoad,
    // The transcript is copied into the store once; never serve stale runs.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false
  })

  useEffect(() => {
    if (!location || isStreaming || current) return
    if (!location.sessionId) {
      setMessages([])
      setSelectedModel('')
      setActiveChat(location)
      return
    }
    if (runs.data && !runs.isFetching && !runs.isError) {
      setMessages(messagesFromRuns(runs.data, author, memberNames))
      setSelectedModel(modelOverrideFromRuns(runs.data) ?? '')
      setActiveChat(location)
    }
  }, [
    location,
    isStreaming,
    current,
    runs.data,
    runs.isFetching,
    runs.isError,
    author,
    memberNames,
    setMessages,
    setSelectedModel,
    setActiveChat
  ])

  return {
    /** The session in the URL is still loading. */
    loading: needsLoad && !runs.isError,
    error: needsLoad && runs.isError ? runs.error : null,
    retrying: runs.isFetching,
    retry: () => void runs.refetch()
  }
}
