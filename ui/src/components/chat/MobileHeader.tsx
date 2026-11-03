'use client'

import React from 'react'
import { Menu, Plus, ShieldAlert } from 'lucide-react'
import { useStore } from '@/store'
import useChatActions from '@/hooks/useChatActions'
import { useQueryState } from 'nuqs'
import Icon from '@/components/ui/icon'

export const MobileHeader = () => {
  const {
    activeView,
    setActiveView,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    isEndpointActive,
    pendingApprovalsCount,
    studioTab,
    observabilityTab,
    knowledgeTab,
    operationsTab,
    agents,
    teams,
    workflows,
    mode
  } = useStore()

  const { clearChat, focusChatInput } = useChatActions()
  const [agentId] = useQueryState('agent')
  const [teamId] = useQueryState('team')
  const [workflowId] = useQueryState('workflow')

  const getEntityTitle = () => {
    if (activeView === 'studio') {
      return `Studio · ${studioTab}`
    }
    if (activeView === 'observability') {
      return `Observability · ${observabilityTab}`
    }
    if (activeView === 'knowledge') {
      return `Features · ${knowledgeTab}`
    }
    if (activeView === 'operations') {
      return `Operations · ${operationsTab}`
    }

    if (mode === 'agent' && agentId) {
      const current = agents.find((a) => a.id === agentId)
      return current?.name || agentId
    }
    if (mode === 'team' && teamId) {
      const current = teams.find((t) => t.id === teamId)
      return current?.name || teamId
    }
    if (mode === 'workflow' && workflowId) {
      const current = workflows.find((w) => w.id === workflowId)
      return current?.name || workflowId
    }

    return 'AgentOS Chat'
  }

  const handleNewChat = () => {
    if (activeView !== 'chat') {
      setActiveView('chat')
    }
    clearChat()
    focusChatInput()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-primary/10 bg-background/95 px-3 backdrop-blur-md font-dmmono md:hidden">
      {/* Drawer toggle button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          aria-label={isMobileSidebarOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
          className="flex size-11 items-center justify-center rounded-xl border border-primary/15 bg-accent/40 text-foreground transition active:scale-95"
        >
          <Menu className="size-5" />
        </button>

        <div className="flex items-center gap-1.5 pl-1">
          <Icon type="agno" size="xs" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold capitalize text-foreground truncate max-w-[170px]">
              {getEntityTitle()}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-muted">
              <span
                className={`size-1.5 rounded-full ${
                  isEndpointActive ? 'bg-positive' : 'bg-destructive'
                }`}
              />
              <span>{isEndpointActive ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {pendingApprovalsCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveView('operations')}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-medium text-rose-400"
            title="Pending Approvals"
          >
            <ShieldAlert className="size-3.5" />
            <span>{pendingApprovalsCount}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleNewChat}
          aria-label="New chat"
          className="flex size-11 items-center justify-center rounded-xl bg-primary text-background shadow-xs transition active:scale-95"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </header>
  )
}
