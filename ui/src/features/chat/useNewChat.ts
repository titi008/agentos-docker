'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { stopListening } from '@/hooks/useChatRun'
import { useStore } from '@/store'

/**
 * Starts a new chat with the current agent, team or workflow: stops
 * listening to a response that is still streaming, keeps the target in the
 * URL, drops the session and clears the transcript. Outside the chat page it
 * opens a new chat with the last target.
 */
export function useNewChat() {
  const router = useRouter()

  return useCallback(() => {
    stopListening()
    const { activeChat, setMessages, setSelectedModel } = useStore.getState()
    const onChat = window.location.pathname === '/'
    const params = new URLSearchParams(onChat ? window.location.search : '')
    params.delete('session')
    if (!onChat && activeChat) {
      params.set(activeChat.kind, activeChat.id)
      if (activeChat.dbId) params.set('db_id', activeChat.dbId)
    }
    setMessages([])
    setSelectedModel('')
    const query = params.toString()
    router.push(query ? `/?${query}` : '/')
    window.requestAnimationFrame(() =>
      useStore.getState().chatInputRef.current?.focus()
    )
  }, [router])
}
