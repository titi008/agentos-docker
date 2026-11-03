'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from '@/store'
import {
  getAgentsAPI,
  getTeamsAPI,
  getWorkflowsAPI,
  getComponentsAPI,
  getComponentConfigsAPI,
  createComponentAPI,
  createComponentConfigAPI,
  setCurrentComponentConfigAPI,
  deleteComponentAPI,
  getRegistryAPI
} from '@/api/os'
import {
  AgentDetails,
  TeamDetails,
  WorkflowSummaryResponse,
  ComponentResponse,
  ComponentConfigResponse,
  RegistryContentResponse
} from '@/types/os'
import {
  LayoutGrid,
  User,
  Users,
  GitBranch,
  Boxes,
  Search,
  Plus,
  RefreshCw,
  Play,
  History,
  Check,
  X,
  Code,
  Database,
  CheckCircle2,
  Trash2
} from 'lucide-react'
import { useQueryState } from 'nuqs'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export const StudioView = () => {
  const {
    selectedEndpoint,
    authToken,
    setActiveView,
    setMode,
    studioTab: activeTab,
    setStudioTab: setActiveTab
  } = useStore()
  const [isLoading, setIsLoading] = useState(false)

  // Query state hooks for 1-click Chat launch
  const [, setAgentId] = useQueryState('agent')
  const [, setTeamId] = useQueryState('team')
  const [, setWorkflowId] = useQueryState('workflow')
  const [, setSessionId] = useQueryState('session')

  // Data states
  const [agents, setAgents] = useState<AgentDetails[]>([])
  const [teams, setTeams] = useState<TeamDetails[]>([])
  const [workflows, setWorkflows] = useState<WorkflowSummaryResponse[]>([])
  const [components, setComponents] = useState<ComponentResponse[]>([])
  const [registryItems, setRegistryItems] = useState<RegistryContentResponse[]>([])

  // Search & Registry filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [registryFilter, setRegistryFilter] = useState('all')

  // Inspection & Version History Drawer/Modal
  const [selectedComponent, setSelectedComponent] = useState<ComponentResponse | null>(null)
  const [componentConfigs, setComponentConfigs] = useState<ComponentConfigResponse[]>([])
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false)
  const [isConfigLoading, setIsConfigLoading] = useState(false)
  const [editingInstructions, setEditingInstructions] = useState('')
  const [editingNotes, setEditingNotes] = useState('')

  // Create Modals
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentDescription, setNewAgentDescription] = useState('')
  const [newAgentInstructions, setNewAgentInstructions] = useState('')
  const [newAgentModel, setNewAgentModel] = useState('claude-sonnet-5-5')
  const [newAgentTools, setNewAgentTools] = useState<string[]>([])

  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [newTeamInstructions, setNewTeamInstructions] = useState('')
  const [newTeamLeaderModel, setNewTeamLeaderModel] = useState('claude-sonnet-5-5')
  const [newTeamMembers, setNewTeamMembers] = useState<string[]>([])

  const [isCreateWorkflowOpen, setIsCreateWorkflowOpen] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('')
  const [newWorkflowSteps, setNewWorkflowSteps] = useState<
    Array<{ type: 'agent' | 'team' | 'function'; target: string; name: string }>
  >([])

  const refreshAll = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsLoading(true)
    try {
      const [fetchedAgents, fetchedTeams, fetchedWorkflows, fetchedComponents, fetchedRegistry] =
        await Promise.all([
          getAgentsAPI(selectedEndpoint, authToken),
          getTeamsAPI(selectedEndpoint, authToken),
          getWorkflowsAPI(selectedEndpoint, authToken),
          getComponentsAPI(selectedEndpoint, undefined, authToken),
          getRegistryAPI(selectedEndpoint, undefined, undefined, authToken)
        ])
      setAgents(fetchedAgents)
      setTeams(fetchedTeams)
      setWorkflows(fetchedWorkflows)
      setComponents(fetchedComponents)
      setRegistryItems(fetchedRegistry)
    } finally {
      setIsLoading(false)
    }
  }, [selectedEndpoint, authToken])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // One-click Launch into Chat
  const handleLaunchAgentInChat = (id: string) => {
    setMode('agent')
    setAgentId(id)
    setTeamId(null)
    setWorkflowId(null)
    setSessionId(null)
    setActiveView('chat')
  }

  const handleLaunchTeamInChat = (id: string) => {
    setMode('team')
    setTeamId(id)
    setAgentId(null)
    setWorkflowId(null)
    setSessionId(null)
    setActiveView('chat')
  }

  const handleLaunchWorkflowInChat = (id: string) => {
    setMode('workflow')
    setWorkflowId(id)
    setAgentId(null)
    setTeamId(null)
    setSessionId(null)
    setActiveView('chat')
  }

  // Open Version History / Config Inspector
  const handleInspectComponent = async (component: ComponentResponse) => {
    setSelectedComponent(component)
    setIsConfigDrawerOpen(true)
    setIsConfigLoading(true)
    try {
      const configs = await getComponentConfigsAPI(
        selectedEndpoint,
        component.component_id,
        authToken
      )
      setComponentConfigs(configs)
      const currentConfig = configs.find((c) => c.version === component.current_version) || configs[0]
      if (currentConfig) {
        setEditingInstructions(
          typeof currentConfig.config?.instructions === 'string'
            ? currentConfig.config.instructions
            : JSON.stringify(currentConfig.config?.instructions || '', null, 2)
        )
      } else {
        setEditingInstructions('')
      }
    } finally {
      setIsConfigLoading(false)
    }
  }

  const handlePublishNewVersion = async () => {
    if (!selectedComponent) return
    const activeConfig = componentConfigs.find(
      (c) => c.version === selectedComponent.current_version
    )?.config || {}

    const updatedConfig = {
      ...activeConfig,
      instructions: editingInstructions
    }

    const res = await createComponentConfigAPI(
      selectedEndpoint,
      selectedComponent.component_id,
      {
        config: updatedConfig,
        stage: 'published',
        notes: editingNotes || `Updated instructions via Studio at ${new Date().toLocaleTimeString()}`,
        set_current: true
      },
      authToken
    )

    if (res) {
      setEditingNotes('')
      const configs = await getComponentConfigsAPI(
        selectedEndpoint,
        selectedComponent.component_id,
        authToken
      )
      setComponentConfigs(configs)
      refreshAll()
    }
  }

  const handleRollbackVersion = async (version: number) => {
    if (!selectedComponent) return
    if (!confirm(`Rollback to version v${version}?`)) return
    const ok = await setCurrentComponentConfigAPI(
      selectedEndpoint,
      selectedComponent.component_id,
      version,
      authToken
    )
    if (ok) {
      refreshAll()
      const configs = await getComponentConfigsAPI(
        selectedEndpoint,
        selectedComponent.component_id,
        authToken
      )
      setComponentConfigs(configs)
      setSelectedComponent({
        ...selectedComponent,
        current_version: version
      })
    }
  }

  const handleDeleteComponent = async (componentId: string) => {
    if (!confirm(`Are you sure you want to delete component '${componentId}'?`)) return
    const ok = await deleteComponentAPI(selectedEndpoint, componentId, authToken)
    if (ok) {
      setIsConfigDrawerOpen(false)
      refreshAll()
    }
  }

  // Handle Create Agent Form
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAgentName.trim()) return

    const res = await createComponentAPI(
      selectedEndpoint,
      {
        name: newAgentName.trim(),
        component_type: 'agent',
        description: newAgentDescription.trim() || undefined,
        stage: 'published',
        config: {
          name: newAgentName.trim(),
          instructions: newAgentInstructions.trim(),
          model: { id: newAgentModel },
          tools: newAgentTools
        }
      },
      authToken
    )

    if (res) {
      setIsCreateAgentOpen(false)
      setNewAgentName('')
      setNewAgentDescription('')
      setNewAgentInstructions('')
      setNewAgentTools([])
      refreshAll()
    }
  }

  // Handle Create Team Form
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim() || newTeamMembers.length === 0) {
      toast.error('Please specify a team name and select at least 1 member agent.')
      return
    }

    const res = await createComponentAPI(
      selectedEndpoint,
      {
        name: newTeamName.trim(),
        component_type: 'team',
        description: newTeamDescription.trim() || undefined,
        stage: 'published',
        config: {
          name: newTeamName.trim(),
          instructions: newTeamInstructions.trim(),
          model: { id: newTeamLeaderModel },
          members: newTeamMembers
        }
      },
      authToken
    )

    if (res) {
      setIsCreateTeamOpen(false)
      setNewTeamName('')
      setNewTeamDescription('')
      setNewTeamInstructions('')
      setNewTeamMembers([])
      refreshAll()
    }
  }

  // Handle Create Workflow Form
  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkflowName.trim() || newWorkflowSteps.length === 0) {
      toast.error('Please provide a workflow name and at least 1 step.')
      return
    }

    const res = await createComponentAPI(
      selectedEndpoint,
      {
        name: newWorkflowName.trim(),
        component_type: 'workflow',
        description: newWorkflowDescription.trim() || undefined,
        stage: 'published',
        config: {
          name: newWorkflowName.trim(),
          steps: newWorkflowSteps.map((s) => ({
            name: s.name,
            executor_type: s.type,
            target: s.target
          }))
        }
      },
      authToken
    )

    if (res) {
      setIsCreateWorkflowOpen(false)
      setNewWorkflowName('')
      setNewWorkflowDescription('')
      setNewWorkflowSteps([])
      refreshAll()
    }
  }

  // Filtered lists
  const filteredAgents = agents.filter(
    (a) =>
      a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const dbAgents = components.filter(
    (c) =>
      c.component_type === 'agent' &&
      (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.component_id?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredTeams = teams.filter(
    (t) =>
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const dbTeams = components.filter(
    (c) =>
      c.component_type === 'team' &&
      (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.component_id?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredWorkflows = workflows.filter(
    (w) =>
      w.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredRegistry = registryItems.filter((item) => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    if (registryFilter === 'all') return matchesSearch
    return matchesSearch && item.type === registryFilter
  })

  // Toolkits and functions in registry
  const availableToolkits = registryItems.filter(
    (i) => i.type === 'toolkit' || i.type === 'tool'
  )
  const availableFunctions = registryItems.filter((i) => i.type === 'function')

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background text-foreground font-dmmono">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 px-3 md:px-6 py-3 md:py-4">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-primary">
            <LayoutGrid className="size-5" /> Studio & Component Manager
          </h1>
          <p className="text-xs text-muted">
            Inspect, version, build, and orchestrate Agents, Teams, Workflows, and Registry tools.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded-xl border border-primary/15 bg-accent/40 p-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'agents'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <User className="size-3.5" /> Agents ({agents.length + dbAgents.length})
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'teams'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Users className="size-3.5" /> Teams ({teams.length + dbTeams.length})
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'workflows'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <GitBranch className="size-3.5" /> Workflows ({workflows.length})
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'registry'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Boxes className="size-3.5" /> Registry Palette ({registryItems.length})
          </button>
        </div>
      </div>

      {/* Action Bar (Search + Refresh + New Buttons) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/5 px-3 md:px-6 py-2.5 md:py-3 bg-accent/10">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full sm:w-64 rounded-xl border border-primary/15 bg-accent/40 pl-9 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshAll()}
            disabled={isLoading}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/30 px-3 text-xs text-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {activeTab === 'agents' && (
            <button
              onClick={() => setIsCreateAgentOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-background hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> New Agent
            </button>
          )}

          {activeTab === 'teams' && (
            <button
              onClick={() => setIsCreateTeamOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-background hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> New Team
            </button>
          )}

          {activeTab === 'workflows' && (
            <button
              onClick={() => setIsCreateWorkflowOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-background hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> New Workflow
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* AGENTS TAB */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            {/* DB Studio Created Agents */}
            {dbAgents.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-primary mb-3 flex items-center gap-2">
                  <Database className="size-3.5" /> Studio Database-Managed Agents ({dbAgents.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dbAgents.map((comp) => (
                    <div
                      key={comp.id}
                      className="rounded-2xl border border-primary/20 bg-accent/20 p-4 hover:border-primary/40 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-primary truncate">
                            {comp.name || comp.component_id}
                          </h4>
                          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
                            v{comp.current_version || 1}
                          </span>
                        </div>
                        <p className="text-xs text-muted line-clamp-2 mb-3">
                          {comp.description || 'Studio configurable agent.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-primary/10 pt-3 mt-2 text-xs">
                        <button
                          onClick={() => handleInspectComponent(comp)}
                          className="flex items-center gap-1 text-muted hover:text-foreground"
                        >
                          <History className="size-3" /> Version History
                        </button>
                        <button
                          onClick={() => handleLaunchAgentInChat(comp.component_id)}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-background hover:bg-primary/90"
                        >
                          <Play className="size-3" /> Chat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Code Defined Agents */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-primary mb-3 flex items-center gap-2">
                <Code className="size-3.5" /> Code-Defined Application Agents ({filteredAgents.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-2xl border border-primary/15 bg-accent/20 p-4 hover:border-primary/30 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {agent.name || agent.id}
                        </h4>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          Code
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-2 mb-3">
                        {agent.description || agent.role || 'Application agent.'}
                      </p>

                      <div className="flex flex-wrap items-center gap-1 mb-2">
                        {agent.model && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {agent.model.provider || agent.model.model || 'LLM'}
                          </span>
                        )}
                        {agent.tools && agent.tools.length > 0 && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {agent.tools.length} tool(s)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end border-t border-primary/10 pt-3 mt-2 text-xs">
                      <button
                        onClick={() => handleLaunchAgentInChat(agent.id)}
                        className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-background hover:bg-primary/90"
                      >
                        <Play className="size-3" /> Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TEAMS TAB */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            {dbTeams.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-primary mb-3 flex items-center gap-2">
                  <Database className="size-3.5" /> Studio Database-Managed Teams ({dbTeams.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dbTeams.map((comp) => (
                    <div
                      key={comp.id}
                      className="rounded-2xl border border-primary/20 bg-accent/20 p-4 hover:border-primary/40 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-primary truncate">
                            {comp.name || comp.component_id}
                          </h4>
                          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
                            v{comp.current_version || 1}
                          </span>
                        </div>
                        <p className="text-xs text-muted line-clamp-2 mb-3">
                          {comp.description || 'Studio multi-agent team.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-primary/10 pt-3 mt-2 text-xs">
                        <button
                          onClick={() => handleInspectComponent(comp)}
                          className="flex items-center gap-1 text-muted hover:text-foreground"
                        >
                          <History className="size-3" /> Versions
                        </button>
                        <button
                          onClick={() => handleLaunchTeamInChat(comp.component_id)}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-background hover:bg-primary/90"
                        >
                          <Play className="size-3" /> Chat with Team
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold uppercase text-primary mb-3 flex items-center gap-2">
                <Code className="size-3.5" /> Code-Defined Application Teams ({filteredTeams.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTeams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-2xl border border-primary/15 bg-accent/20 p-4 hover:border-primary/30 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {team.name || team.id}
                        </h4>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          Code
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-2 mb-3">
                        {team.description || 'Autonomous agent coordination unit.'}
                      </p>

                      <div className="flex flex-wrap items-center gap-1 mb-2">
                        {team.model && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-zinc-300">
                            Leader: {team.model.provider || team.model.model || 'Default'}
                          </span>
                        )}
                        {team.members && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {team.members.length} members
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end border-t border-primary/10 pt-3 mt-2 text-xs">
                      <button
                        onClick={() => handleLaunchTeamInChat(team.id)}
                        className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-background hover:bg-primary/90"
                      >
                        <Play className="size-3" /> Chat with Team
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WORKFLOWS TAB */}
        {activeTab === 'workflows' && (
          <div className="space-y-4">
            {filteredWorkflows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-primary/15 p-12 text-center">
                <GitBranch className="mx-auto size-8 text-muted/50 mb-3" />
                <p className="text-xs text-muted">No workflows registered yet.</p>
                <p className="mt-1 text-[11px] text-muted/70">
                  Build multi-step pipelines combining agents and python functions with the &quot;+ New Workflow&quot; button.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWorkflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="rounded-2xl border border-primary/15 bg-accent/20 p-4 hover:border-primary/30 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-primary truncate">
                          {wf.name || wf.id}
                        </h4>
                        <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                          {wf.is_factory ? 'Factory' : 'Pipeline'}
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-2 mb-3">
                        {wf.description || 'Deterministic multi-step execution pipeline.'}
                      </p>

                      <div className="text-[11px] text-muted space-y-1 mb-2 font-mono">
                        <div>ID: {wf.id}</div>
                        {wf.current_version && <div>Version: v{wf.current_version}</div>}
                      </div>
                    </div>

                    <div className="flex items-center justify-end border-t border-primary/10 pt-3 mt-2 text-xs">
                      <button
                        onClick={() => handleLaunchWorkflowInChat(wf.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-background hover:bg-primary/90"
                      >
                        <Play className="size-3" /> Run in Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REGISTRY TAB */}
        {activeTab === 'registry' && (
          <div className="space-y-4">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {['all', 'model', 'toolkit', 'function', 'knowledge', 'learning'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setRegistryFilter(cat)}
                  className={`rounded-xl px-3 py-1 transition capitalize ${
                    registryFilter === cat
                      ? 'bg-primary text-background font-semibold shadow-sm'
                      : 'border border-primary/15 bg-accent/30 text-muted hover:text-foreground'
                  }`}
                >
                  {cat === 'all' ? 'All Resources' : cat}
                </button>
              ))}
            </div>

            {/* Registry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRegistry.map((item, idx) => (
                <div
                  key={`${item.type}-${item.name}-${idx}`}
                  className="rounded-2xl border border-primary/15 bg-accent/20 p-4 hover:border-primary/30 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-xs font-semibold text-primary truncate">
                        {item.name}
                      </h4>
                      <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-mono text-zinc-300 capitalize">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted line-clamp-3 mb-2">
                      {item.description || 'Platform building block.'}
                    </p>
                  </div>

                  <div className="border-t border-primary/10 pt-2 text-[10px] text-muted flex items-center justify-between font-mono">
                    <span>{item.id ? `ID: ${item.id}` : 'Built-in'}</span>
                    {item.sandboxed && (
                      <span className="text-amber-400">Sandboxed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* INSPECT / VERSION HISTORY DRAWER */}
      {isConfigDrawerOpen && selectedComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl font-dmmono">
            <div className="flex items-center justify-between border-b border-primary/15 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-primary">
                  {selectedComponent.name || selectedComponent.component_id}
                </h3>
                <span className="text-xs text-muted">
                  Type: {selectedComponent.component_type} • Current: v{selectedComponent.current_version || 1}
                </span>
              </div>
              <button
                onClick={() => setIsConfigDrawerOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto my-4 space-y-4">
              {/* Instructions Editor */}
              <div>
                <label className="text-xs text-muted uppercase font-semibold">
                  System Instructions / Prompt
                </label>
                <textarea
                  rows={6}
                  value={editingInstructions}
                  onChange={(e) => setEditingInstructions(e.target.value)}
                  placeholder="Enter system prompt for this component..."
                  className="mt-1 w-full rounded-xl border border-primary/20 bg-accent/40 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase font-semibold">
                  Release Notes for New Version
                </label>
                <input
                  type="text"
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="e.g., Updated financial compliance instructions..."
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePublishNewVersion}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-background hover:bg-primary/90"
                >
                  <Check className="size-3.5" /> Publish New Version
                </button>
              </div>

              {/* Version History List */}
              <div className="border-t border-primary/15 pt-4">
                <h4 className="text-xs font-semibold text-primary uppercase mb-2">
                  Version History & Instant Rollback
                </h4>
                {isConfigLoading ? (
                  <div className="text-xs text-muted">Loading version history...</div>
                ) : componentConfigs.length === 0 ? (
                  <div className="text-xs text-muted">No version history records found.</div>
                ) : (
                  <div className="space-y-2">
                    {componentConfigs.map((cfg) => {
                      const isCurrent = cfg.version === selectedComponent.current_version
                      return (
                        <div
                          key={cfg.version}
                          className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                            isCurrent
                              ? 'border-primary bg-primary/10'
                              : 'border-primary/15 bg-accent/20'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                v{cfg.version}
                              </span>
                              {isCurrent && (
                                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="size-3" /> ACTIVE
                                </span>
                              )}
                              <span className="text-muted text-[11px]">
                                {dayjs.unix(cfg.created_at).fromNow()}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted mt-1">
                              {cfg.notes || 'No release notes.'}
                            </p>
                          </div>

                          {!isCurrent && (
                            <button
                              onClick={() => handleRollbackVersion(cfg.version)}
                              className="rounded-lg border border-primary/20 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/10"
                            >
                              Activate v{cfg.version}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-primary/15 pt-3">
              <button
                type="button"
                onClick={() => handleDeleteComponent(selectedComponent.component_id)}
                className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
              >
                <Trash2 className="size-3.5" /> Delete Component
              </button>
              <button
                type="button"
                onClick={() => setIsConfigDrawerOpen(false)}
                className="rounded-xl border border-primary/15 px-4 py-1.5 text-xs text-muted hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE AGENT MODAL */}
      {isCreateAgentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl font-dmmono">
            <div className="flex items-center justify-between border-b border-primary/15 pb-3">
              <h3 className="text-sm font-semibold text-primary">Create Studio Agent</h3>
              <button
                onClick={() => setIsCreateAgentOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-muted uppercase">Agent Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Compliance Auditor"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase">Description</label>
                <input
                  type="text"
                  placeholder="Audits agreements against regulations"
                  value={newAgentDescription}
                  onChange={(e) => setNewAgentDescription(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase">Model</label>
                <select
                  value={newAgentModel}
                  onChange={(e) => setNewAgentModel(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="claude-sonnet-5-5">Claude Sonnet 5.5</option>
                  <option value="claude-opus-5-5">Claude Opus 5.5</option>
                  <option value="claude-haiku-5-5">Claude Haiku 5.5</option>
                  <option value="gemini-4-argon">Gemini 4 Argon</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                  <option value="gpt-6.1-sol">GPT 6.1 Sol</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted uppercase">System Instructions</label>
                <textarea
                  rows={4}
                  required
                  placeholder="You are an expert compliance agent..."
                  value={newAgentInstructions}
                  onChange={(e) => setNewAgentInstructions(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-primary/20 bg-accent/40 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase mb-1.5 block">
                  Select Toolkits from Registry
                </label>
                <div className="max-h-36 overflow-auto rounded-xl border border-primary/15 bg-accent/20 p-2 space-y-1">
                  {availableToolkits.map((tool) => {
                    const isChecked = newAgentTools.includes(tool.name)
                    return (
                      <label
                        key={tool.name}
                        className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white cursor-pointer p-1 rounded hover:bg-accent/40"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAgentTools([...newAgentTools, tool.name])
                            } else {
                              setNewAgentTools(newAgentTools.filter((t) => t !== tool.name))
                            }
                          }}
                          className="rounded border-primary/30"
                        />
                        <span className="font-semibold">{tool.name}</span>
                        {tool.description && (
                          <span className="text-[10px] text-muted truncate">
                            - {tool.description}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateAgentOpen(false)}
                  className="rounded-xl border border-primary/15 px-4 py-2 text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-background hover:bg-primary/90"
                >
                  <Plus className="size-3.5" /> Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {isCreateTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl font-dmmono">
            <div className="flex items-center justify-between border-b border-primary/15 pb-3">
              <h3 className="text-sm font-semibold text-primary">Create Studio Team</h3>
              <button
                onClick={() => setIsCreateTeamOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-muted uppercase">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Growth Strategy Squad"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase">Description</label>
                <input
                  type="text"
                  placeholder="Coordinated squad for marketing & SEO"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase">Leader Model</label>
                <select
                  value={newTeamLeaderModel}
                  onChange={(e) => setNewTeamLeaderModel(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="claude-sonnet-5-5">Claude Sonnet 5.5</option>
                  <option value="gemini-4-argon">Gemini 4 Argon</option>
                  <option value="gpt-6.1-sol">GPT 6.1 Sol</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted uppercase">Leader Instructions</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Coordinate between member agents to achieve optimal growth..."
                  value={newTeamInstructions}
                  onChange={(e) => setNewTeamInstructions(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-primary/20 bg-accent/40 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase mb-1.5 block">
                  Select Member Agents
                </label>
                <div className="max-h-36 overflow-auto rounded-xl border border-primary/15 bg-accent/20 p-2 space-y-1">
                  {[...agents, ...dbAgents.map((d) => ({ id: d.component_id, name: d.name }))].map(
                    (ag) => {
                      const isChecked = newTeamMembers.includes(ag.id)
                      return (
                        <label
                          key={ag.id}
                          className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white cursor-pointer p-1 rounded hover:bg-accent/40"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewTeamMembers([...newTeamMembers, ag.id])
                              } else {
                                setNewTeamMembers(newTeamMembers.filter((m) => m !== ag.id))
                              }
                            }}
                            className="rounded border-primary/30"
                          />
                          <span className="font-semibold">{ag.name || ag.id}</span>
                        </label>
                      )
                    }
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(false)}
                  className="rounded-xl border border-primary/15 px-4 py-2 text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-background hover:bg-primary/90"
                >
                  <Plus className="size-3.5" /> Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE WORKFLOW MODAL */}
      {isCreateWorkflowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl font-dmmono">
            <div className="flex items-center justify-between border-b border-primary/15 pb-3">
              <h3 className="text-sm font-semibold text-primary">Create Workflow Pipeline</h3>
              <button
                onClick={() => setIsCreateWorkflowOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkflow} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-muted uppercase">Workflow Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Content Ingestion & Formatting Pipeline"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase">Description</label>
                <input
                  type="text"
                  placeholder="Researches, formats to JSON, and summarizes output"
                  value={newWorkflowDescription}
                  onChange={(e) => setNewWorkflowDescription(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-muted uppercase">Pipeline Steps</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const firstAgent = agents[0]
                        if (firstAgent) {
                          setNewWorkflowSteps([
                            ...newWorkflowSteps,
                            { type: 'agent', target: firstAgent.id, name: `Step: ${firstAgent.name || firstAgent.id}` }
                          ])
                        }
                      }}
                      className="rounded bg-accent/50 px-2 py-0.5 text-[10px] text-primary hover:bg-accent"
                    >
                      + Agent
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const firstFunc = availableFunctions[0]
                        if (firstFunc) {
                          setNewWorkflowSteps([
                            ...newWorkflowSteps,
                            { type: 'function', target: firstFunc.name, name: `Function: ${firstFunc.name}` }
                          ])
                        }
                      }}
                      className="rounded bg-accent/50 px-2 py-0.5 text-[10px] text-primary hover:bg-accent"
                    >
                      + Function
                    </button>
                  </div>
                </div>

                <div className="max-h-44 overflow-auto rounded-xl border border-primary/15 bg-accent/20 p-2 space-y-2">
                  {newWorkflowSteps.length === 0 ? (
                    <div className="text-[11px] text-muted text-center py-4">
                      Add steps above (e.g. Researcher Agent → extract_json Function → Writer Agent)
                    </div>
                  ) : (
                    newWorkflowSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-primary/10 bg-accent/40 p-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="size-4 rounded-full bg-primary text-[10px] text-background font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-foreground">{step.name}</span>
                          <span className="text-[10px] text-muted uppercase font-mono">
                            ({step.type})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNewWorkflowSteps(newWorkflowSteps.filter((_, i) => i !== idx))
                          }}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateWorkflowOpen(false)}
                  className="rounded-xl border border-primary/15 px-4 py-2 text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-background hover:bg-primary/90"
                >
                  <Plus className="size-3.5" /> Create Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
