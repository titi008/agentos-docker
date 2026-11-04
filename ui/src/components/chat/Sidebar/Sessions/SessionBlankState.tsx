import React from 'react'
import { useStore } from '@/store'
import { useQueryState } from 'nuqs'
import { MessageSquareOff } from 'lucide-react'

const SessionBlankState = () => {
  const { selectedEndpoint, isEndpointActive } = useStore()
  const [agentId] = useQueryState('agent')

  const errorMessage = (() => {
    switch (true) {
      case !isEndpointActive:
        return 'Endpoint is not connected.'
      case !selectedEndpoint:
        return 'Select an endpoint to view history.'
      case !agentId:
        return 'Select an agent to view history.'
      default:
        return 'No session records yet.'
    }
  })()

  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/10 bg-accent/20 px-3 py-2.5 text-muted">
      <MessageSquareOff className="size-3.5 shrink-0 opacity-60" />
      <p className="text-[11px] leading-tight truncate">
        {errorMessage}
      </p>
    </div>
  )
}

export default SessionBlankState
