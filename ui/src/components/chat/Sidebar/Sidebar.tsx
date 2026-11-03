'use client'

import { Button } from '@/components/ui/button'
import { ModeSelector } from '@/components/chat/Sidebar/ModeSelector'
import { EntitySelector } from '@/components/chat/Sidebar/EntitySelector'
import useChatActions from '@/hooks/useChatActions'
import { useStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import Icon from '@/components/ui/icon'
import { getProviderIcon } from '@/lib/modelProvider'
import Sessions from './Sessions'
import AuthToken from './AuthToken'
import OperatorIdentity from './OperatorIdentity'
import { isValidUrl, truncateText } from '@/lib/utils'
import { toast } from 'sonner'
import { useQueryState } from 'nuqs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MessageSquare,
  Activity,
  Brain,
  Briefcase,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Search,
  Settings,
  Folder,
  BookOpen,
  Database,
  Calendar,
  Layers,
  ShieldCheck,
  BarChart3,
  CheckCircle2,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { getApprovalsCountAPI } from '@/api/os'

const ENDPOINT_PLACEHOLDER = 'NO ENDPOINT ADDED'

const NewChatButton = ({
  disabled,
  onClick
}: {
  disabled: boolean
  onClick: () => void
}) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    size="lg"
    className="h-9 w-full rounded-xl bg-primary text-xs font-medium text-background hover:bg-primary/80"
  >
    <Icon type="plus-icon" size="xs" className="text-background" />
    <span className="uppercase">New Chat</span>
  </Button>
)

const ModelDisplay = ({ model }: { model: string }) => (
  <div className="flex h-9 w-full items-center gap-3 rounded-xl border border-primary/15 bg-accent p-3 text-xs font-medium uppercase text-muted">
    {(() => {
      const icon = getProviderIcon(model)
      return icon ? <Icon type={icon} className="shrink-0" size="xs" /> : null
    })()}
    <span className="truncate">{model}</span>
  </div>
)

const Endpoint = () => {
  const {
    selectedEndpoint,
    isEndpointActive,
    setSelectedEndpoint,
    setAgents,
    setSessionsData,
    setMessages
  } = useStore()
  const { initialize } = useChatActions()
  const [isEditing, setIsEditing] = useState(false)
  const [endpointValue, setEndpointValue] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [, setAgentId] = useQueryState('agent')
  const [, setSessionId] = useQueryState('session')

  useEffect(() => {
    setEndpointValue(selectedEndpoint)
    setIsMounted(true)
  }, [selectedEndpoint])

  const getStatusColor = (isActive: boolean) =>
    isActive ? 'bg-positive' : 'bg-destructive'

  const handleSave = async () => {
    if (!isValidUrl(endpointValue)) {
      toast.error('Please enter a valid URL')
      return
    }
    const cleanEndpoint = endpointValue.replace(/\/$/, '').trim()
    setSelectedEndpoint(cleanEndpoint)
    setAgentId(null)
    setSessionId(null)
    setIsEditing(false)
    setIsHovering(false)
    setAgents([])
    setSessionsData([])
    setMessages([])
  }

  const handleCancel = () => {
    setEndpointValue(selectedEndpoint)
    setIsEditing(false)
    setIsHovering(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleRefresh = async () => {
    setIsRotating(true)
    await initialize()
    setTimeout(() => setIsRotating(false), 500)
  }

  return (
    <div className="flex flex-col items-start gap-1.5 w-full">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        AgentOS Host
      </div>
      {isEditing ? (
        <div className="flex w-full items-center gap-1">
          <input
            type="text"
            value={endpointValue}
            onChange={(e) => setEndpointValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex h-9 w-full items-center text-ellipsis rounded-xl border border-primary/15 bg-accent p-2.5 text-xs font-medium text-foreground"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            className="hover:cursor-pointer hover:bg-accent shrink-0"
          >
            <Icon type="save" size="xs" />
          </Button>
        </div>
      ) : (
        <div className="flex w-full items-center gap-1">
          <motion.div
            className="relative flex h-9 w-full cursor-pointer items-center justify-between rounded-xl border border-primary/15 bg-accent p-2.5"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => setIsEditing(true)}
          >
            <AnimatePresence mode="wait">
              {isHovering ? (
                <motion.div
                  key="endpoint-display-hover"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-primary">
                    <Icon type="edit" size="xxs" /> Edit Host URL
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="endpoint-display"
                  className="absolute inset-0 flex items-center justify-between px-2.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="text-xs font-medium text-muted truncate">
                    {isMounted
                      ? truncateText(selectedEndpoint, 22) || ENDPOINT_PLACEHOLDER
                      : 'http://localhost:7777'}
                  </p>
                  <div
                    className={`size-2 shrink-0 rounded-full ${getStatusColor(
                      isEndpointActive
                    )}`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="hover:cursor-pointer hover:bg-accent shrink-0"
          >
            <motion.div
              key={isRotating ? 'rotating' : 'idle'}
              animate={{ rotate: isRotating ? 360 : 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <Icon type="refresh" size="xs" />
            </motion.div>
          </Button>
        </div>
      )}
    </div>
  )
}

interface SidebarContentProps {
  isMobile?: boolean
  onCloseMobile?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  hasEnvToken?: boolean
  envToken?: string
}

const SidebarContent = ({
  isMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  hasEnvToken,
  envToken
}: SidebarContentProps) => {
  const {
    messages,
    selectedModel,
    isEndpointLoading,
    activeView,
    setActiveView,
    pendingApprovalsCount,
    userId,
    studioTab,
    setStudioTab,
    observabilityTab,
    setObservabilityTab,
    knowledgeTab,
    setKnowledgeTab,
    operationsTab,
    setOperationsTab
  } = useStore()

  const { clearChat, focusChatInput } = useChatActions()
  const [agentId] = useQueryState('agent')
  const [teamId] = useQueryState('team')
  const [workflowId] = useQueryState('workflow')

  // Collapsible accordion states
  const [isStudioOpen, setIsStudioOpen] = useState(true)
  const [isObservabilityOpen, setIsObservabilityOpen] = useState(false)
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  const handleNavClick = (
    view: 'chat' | 'studio' | 'observability' | 'knowledge' | 'operations',
    subTab?: string
  ) => {
    setActiveView(view)
    if (view === 'studio' && subTab) {
      setStudioTab(subTab as 'agents' | 'teams' | 'workflows' | 'registry')
    } else if (view === 'observability' && subTab) {
      setObservabilityTab(subTab as 'traces' | 'metrics' | 'evals')
    } else if (view === 'knowledge' && subTab) {
      setKnowledgeTab(
        subTab as 'memories' | 'learnings' | 'knowledge' | 'filesystem'
      )
    } else if (view === 'operations' && subTab) {
      setOperationsTab(subTab as 'approvals' | 'schedules' | 'queue' | 'tasks')
    }

    if (isMobile && onCloseMobile) {
      onCloseMobile()
    }
  }

  const handleNewChat = () => {
    if (activeView !== 'chat') {
      setActiveView('chat')
    }
    clearChat()
    focusChatInput()
    if (isMobile && onCloseMobile) {
      onCloseMobile()
    }
  }

  const userInitial = userId ? userId.charAt(0).toUpperCase() : 'O'

  // Collapsed view on desktop
  if (isCollapsed && !isMobile) {
    return (
      <div className="flex h-full flex-col items-center justify-between py-2 font-dmmono">
        <div className="flex flex-col items-center gap-4">
          <div
            className="flex size-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-foreground cursor-pointer"
            onClick={onToggleCollapse}
            title={userId}
          >
            {userInitial}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleNavClick('chat')}
              title="Chat Workspace"
              className={`flex size-9 items-center justify-center rounded-xl transition ${
                activeView === 'chat'
                  ? 'bg-primary text-background'
                  : 'text-muted hover:bg-accent/40 hover:text-foreground'
              }`}
            >
              <MessageSquare className="size-4" />
            </button>
            <button
              onClick={() => handleNavClick('studio')}
              title="Studio"
              className={`flex size-9 items-center justify-center rounded-xl transition ${
                activeView === 'studio'
                  ? 'bg-[#f25f38] text-white font-semibold'
                  : 'text-muted hover:bg-accent/40 hover:text-foreground'
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => handleNavClick('observability')}
              title="Observability"
              className={`flex size-9 items-center justify-center rounded-xl transition ${
                activeView === 'observability'
                  ? 'bg-primary text-background'
                  : 'text-muted hover:bg-accent/40 hover:text-foreground'
              }`}
            >
              <Activity className="size-4" />
            </button>
            <button
              onClick={() => handleNavClick('knowledge')}
              title="Features & Knowledge"
              className={`flex size-9 items-center justify-center rounded-xl transition ${
                activeView === 'knowledge'
                  ? 'bg-primary text-background'
                  : 'text-muted hover:bg-accent/40 hover:text-foreground'
              }`}
            >
              <Brain className="size-4" />
            </button>
            <button
              onClick={() => handleNavClick('operations')}
              title="Operations & Approvals"
              className={`relative flex size-9 items-center justify-center rounded-xl transition ${
                activeView === 'operations'
                  ? 'bg-primary text-background'
                  : 'text-muted hover:bg-accent/40 hover:text-foreground'
              }`}
            >
              <Briefcase className="size-4" />
              {pendingApprovalsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-accent/40 hover:text-foreground"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col justify-between font-dmmono">
      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
        {/* User Identity / Header Bar */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-foreground">
              {userInitial}
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                {userId}
              </span>
              <ChevronDown className="size-3 text-muted shrink-0" />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isMobile ? (
              <button
                type="button"
                onClick={onCloseMobile}
                className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-accent hover:text-foreground"
                aria-label="Close sidebar"
              >
                <X className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-accent hover:text-foreground"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search ⌘+K"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-8 w-full rounded-lg border border-primary/10 bg-accent/30 pl-8 pr-2 text-xs text-foreground placeholder:text-muted/60 focus:border-primary/30 focus:outline-hidden"
          />
        </div>

        {/* Navigation Hierarchy */}
        <nav className="flex flex-col gap-1 text-xs">
          {/* 1. Chat Section */}
          <div className="flex flex-col">
            <button
              onClick={() => handleNavClick('chat')}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition ${
                activeView === 'chat'
                  ? 'bg-accent/60 font-semibold text-foreground'
                  : 'text-muted hover:bg-accent/30 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                <span>Chat</span>
              </div>
            </button>

            {activeView === 'chat' && (
              <div className="flex flex-col gap-2.5 pt-2 pb-1 pl-1 pr-1">
                <NewChatButton
                  disabled={messages.length === 0}
                  onClick={handleNewChat}
                />

                {isEndpointLoading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 2 }).map((_, idx) => (
                      <Skeleton key={idx} className="h-8 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <>
                    <ModeSelector />
                    <EntitySelector />
                    {selectedModel && (agentId || teamId || workflowId) && (
                      <ModelDisplay model={selectedModel} />
                    )}
                  </>
                )}

                <div className="pt-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted pb-1.5">
                    Recent Sessions
                  </div>
                  <Sessions />
                </div>
              </div>
            )}
          </div>

          {/* 2. Studio Section */}
          <div className="flex flex-col">
            <button
              onClick={() => {
                setIsStudioOpen(!isStudioOpen)
                if (activeView !== 'studio') handleNavClick('studio', studioTab)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition ${
                activeView === 'studio'
                  ? 'text-[#f25f38] font-semibold'
                  : 'text-muted hover:bg-accent/30 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="size-4 text-[#f25f38]" />
                <span className={activeView === 'studio' ? 'text-[#f25f38]' : ''}>
                  Studio
                </span>
              </div>
              {isStudioOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>

            {isStudioOpen && (
              <div className="flex flex-col border-l border-primary/10 ml-4 pl-2 py-1 gap-0.5">
                <button
                  onClick={() => handleNavClick('studio', 'agents')}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 transition ${
                    activeView === 'studio' && studioTab === 'agents'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <span>Agents</span>
                </button>
                <button
                  onClick={() => handleNavClick('studio', 'teams')}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 transition ${
                    activeView === 'studio' && studioTab === 'teams'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <span>Teams</span>
                </button>
                <button
                  onClick={() => handleNavClick('studio', 'workflows')}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 transition ${
                    activeView === 'studio' && studioTab === 'workflows'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <span>Workflows</span>
                </button>
                <button
                  onClick={() => handleNavClick('studio', 'registry')}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 transition ${
                    activeView === 'studio' && studioTab === 'registry'
                      ? 'text-[#f25f38] font-semibold bg-[#f25f38]/10'
                      : 'text-[#f25f38]/80 hover:text-[#f25f38] hover:bg-accent/20'
                  }`}
                >
                  <span>Registry</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Observability Section */}
          <div className="flex flex-col">
            <button
              onClick={() => {
                setIsObservabilityOpen(!isObservabilityOpen)
                if (activeView !== 'observability')
                  handleNavClick('observability', observabilityTab)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition ${
                activeView === 'observability'
                  ? 'bg-accent/60 font-semibold text-foreground'
                  : 'text-muted hover:bg-accent/30 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="size-4" />
                <span>Observability</span>
              </div>
              {isObservabilityOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>

            {isObservabilityOpen && (
              <div className="flex flex-col border-l border-primary/10 ml-4 pl-2 py-1 gap-0.5">
                <button
                  onClick={() => handleNavClick('observability', 'traces')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'observability' && observabilityTab === 'traces'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <Activity className="size-3.5" />
                  <span>Traces</span>
                </button>
                <button
                  onClick={() => handleNavClick('observability', 'metrics')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'observability' && observabilityTab === 'metrics'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <BarChart3 className="size-3.5" />
                  <span>Metrics</span>
                </button>
                <button
                  onClick={() => handleNavClick('observability', 'evals')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'observability' && observabilityTab === 'evals'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Evaluation</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Features Section */}
          <div className="flex flex-col">
            <button
              onClick={() => {
                setIsFeaturesOpen(!isFeaturesOpen)
                if (activeView !== 'knowledge' && activeView !== 'operations') {
                  handleNavClick('knowledge', knowledgeTab)
                }
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition ${
                activeView === 'knowledge' || activeView === 'operations'
                  ? 'bg-accent/60 font-semibold text-foreground'
                  : 'text-muted hover:bg-accent/30 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <Brain className="size-4" />
                <span>Features</span>
              </div>
              <div className="flex items-center gap-1.5">
                {pendingApprovalsCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {pendingApprovalsCount}
                  </span>
                )}
                {isFeaturesOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </div>
            </button>

            {isFeaturesOpen && (
              <div className="flex flex-col border-l border-primary/10 ml-4 pl-2 py-1 gap-0.5">
                <button
                  onClick={() => handleNavClick('knowledge', 'knowledge')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'knowledge' && knowledgeTab === 'knowledge'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <BookOpen className="size-3.5" />
                  <span>Knowledge</span>
                </button>
                <button
                  onClick={() => handleNavClick('knowledge', 'filesystem')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'knowledge' && knowledgeTab === 'filesystem'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <Folder className="size-3.5" />
                  <span>File System</span>
                </button>
                <button
                  onClick={() => handleNavClick('knowledge', 'memories')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'knowledge' && knowledgeTab === 'memories'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <Database className="size-3.5" />
                  <span>Memory</span>
                </button>
                <button
                  onClick={() => handleNavClick('knowledge', 'learnings')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'knowledge' && knowledgeTab === 'learnings'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <Brain className="size-3.5" />
                  <span>Learning</span>
                </button>
                <button
                  onClick={() => handleNavClick('operations', 'approvals')}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 transition ${
                    activeView === 'operations' && operationsTab === 'approvals'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5" />
                    <span>Approvals</span>
                  </div>
                  {pendingApprovalsCount > 0 && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleNavClick('operations', 'schedules')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'operations' && operationsTab === 'schedules'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <Calendar className="size-3.5" />
                  <span>Scheduler</span>
                </button>
                <button
                  onClick={() => handleNavClick('operations', 'queue')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'operations' && operationsTab === 'queue'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <Layers className="size-3.5" />
                  <span>Queue</span>
                </button>
                <button
                  onClick={() => handleNavClick('operations', 'tasks')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    activeView === 'operations' && operationsTab === 'tasks'
                      ? 'bg-accent/50 text-foreground font-medium'
                      : 'text-muted hover:text-foreground hover:bg-accent/20'
                  }`}
                >
                  <Briefcase className="size-3.5" />
                  <span>Company Tasks</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. Settings Section */}
          <div className="flex flex-col">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-muted hover:bg-accent/30 hover:text-foreground transition"
            >
              <div className="flex items-center gap-2">
                <Settings className="size-4" />
                <span>Settings</span>
              </div>
              {isSettingsOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>

            {isSettingsOpen && (
              <div className="flex flex-col gap-2 border-l border-primary/10 ml-4 pl-2 py-2">
                <OperatorIdentity />
                <Endpoint />
                <AuthToken hasEnvToken={hasEnvToken} envToken={envToken} />
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Footer Branding */}
      <div className="border-t border-primary/10 pt-2 flex items-center justify-between text-[11px] text-muted">
        <div className="flex items-center gap-1.5">
          <Icon type="agno" size="xs" />
          <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
            AgentOS
          </span>
        </div>
        <span className="text-[10px] text-muted/70">v2.1</span>
      </div>
    </div>
  )
}

const Sidebar = ({
  hasEnvToken,
  envToken
}: {
  hasEnvToken?: boolean
  envToken?: string
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { initialize } = useChatActions()
  const {
    selectedEndpoint,
    isEndpointActive,
    hydrated,
    mode,
    setPendingApprovalsCount,
    authToken,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen
  } = useStore()

  useEffect(() => {
    if (hydrated) initialize()
  }, [selectedEndpoint, initialize, hydrated, mode])

  useEffect(() => {
    if (!isEndpointActive || !selectedEndpoint) return
    let isSubscribed = true
    const checkApprovals = async () => {
      try {
        const count = await getApprovalsCountAPI(selectedEndpoint, authToken)
        if (isSubscribed) setPendingApprovalsCount(count)
      } catch {
        // fail silently for background polling
      }
    }
    checkApprovals()
    const timer = setInterval(checkApprovals, 30000)
    return () => {
      isSubscribed = false
      clearInterval(timer)
    }
  }, [isEndpointActive, selectedEndpoint, authToken, setPendingApprovalsCount])

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <motion.aside
        className="relative hidden md:flex h-full shrink-0 flex-col overflow-hidden px-2.5 py-3 border-r border-primary/10 bg-background/50"
        initial={{ width: '16.5rem' }}
        animate={{ width: isCollapsed ? '3.5rem' : '16.5rem' }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      >
        <SidebarContent
          isMobile={false}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          hasEnvToken={hasEnvToken}
          envToken={envToken}
        />
      </motion.aside>

      {/* Mobile Off-Canvas Drawer Backdrop & Container */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              key="mobile-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
            />
            <motion.aside
              key="mobile-drawer-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] flex-col border-r border-primary/15 bg-background p-3 shadow-2xl font-dmmono md:hidden"
            >
              <SidebarContent
                isMobile={true}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
                isCollapsed={false}
                hasEnvToken={hasEnvToken}
                envToken={envToken}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default Sidebar
