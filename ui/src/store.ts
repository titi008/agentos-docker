import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import {
  AgentDetails,
  SessionEntry,
  TeamDetails,
  WorkflowSummaryResponse,
  type ChatMessage
} from '@/types/os'

export type ChatMode = 'agent' | 'team' | 'workflow'

/** The chat whose transcript is in `messages`; `sessionId` is null for a new chat. */
export interface ChatLocation {
  kind: ChatMode
  id: string
  sessionId: string | null
  dbId: string | null
}

interface Store {
  hydrated: boolean
  setHydrated: () => void

  /* Connection (persisted) */
  selectedEndpoint: string
  setSelectedEndpoint: (selectedEndpoint: string) => void
  authToken: string
  setAuthToken: (authToken: string) => void
  userId: string
  setUserId: (userId: string) => void

  /* Workspace, loaded by the app shell */
  isEndpointActive: boolean
  setIsEndpointActive: (isActive: boolean) => void
  isEndpointLoading: boolean
  setIsEndpointLoading: (isLoading: boolean) => void
  agents: AgentDetails[]
  setAgents: (agents: AgentDetails[]) => void
  teams: TeamDetails[]
  setTeams: (teams: TeamDetails[]) => void
  workflows: WorkflowSummaryResponse[]
  setWorkflows: (workflows: WorkflowSummaryResponse[]) => void
  pendingApprovalsCount: number
  setPendingApprovalsCount: (count: number) => void

  /* Chat */
  /** Model id sent as X-Model-Override with each run; '' uses the target's own model. */
  selectedModel: string
  setSelectedModel: (model: string) => void
  messages: ChatMessage[]
  setMessages: (
    messages: ChatMessage[] | ((prevMessages: ChatMessage[]) => ChatMessage[])
  ) => void
  activeChat: ChatLocation | null
  setActiveChat: (activeChat: ChatLocation | null) => void
  isStreaming: boolean
  setIsStreaming: (isStreaming: boolean) => void
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>
  /** Loaded chats of the current target, newest first (read by the command palette). */
  sessionsData: SessionEntry[] | null
  setSessionsData: (
    sessionsData:
      | SessionEntry[]
      | null
      | ((prevSessions: SessionEntry[] | null) => SessionEntry[] | null)
  ) => void

  /* Layout (collapsed state is persisted) */
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (isOpen: boolean) => void
  isCommandPaletteOpen: boolean
  setIsCommandPaletteOpen: (isOpen: boolean) => void
}

export const DEFAULT_ENDPOINT = 'http://localhost:7777'

export const useStore = create<Store>()(
  persist(
    (set) => ({
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      selectedEndpoint: DEFAULT_ENDPOINT,
      setSelectedEndpoint: (selectedEndpoint) => set({ selectedEndpoint }),
      authToken: '',
      setAuthToken: (authToken) => set({ authToken }),
      userId: 'default',
      setUserId: (userId) => set({ userId }),

      isEndpointActive: false,
      setIsEndpointActive: (isEndpointActive) => set({ isEndpointActive }),
      isEndpointLoading: true,
      setIsEndpointLoading: (isEndpointLoading) => set({ isEndpointLoading }),
      agents: [],
      setAgents: (agents) => set({ agents }),
      teams: [],
      setTeams: (teams) => set({ teams }),
      workflows: [],
      setWorkflows: (workflows) => set({ workflows }),
      pendingApprovalsCount: 0,
      setPendingApprovalsCount: (pendingApprovalsCount) =>
        set({ pendingApprovalsCount }),

      selectedModel: '',
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      messages: [],
      setMessages: (messages) =>
        set((state) => ({
          messages:
            typeof messages === 'function' ? messages(state.messages) : messages
        })),
      activeChat: null,
      setActiveChat: (activeChat) => set({ activeChat }),
      isStreaming: false,
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      chatInputRef: { current: null },
      sessionsData: null,
      setSessionsData: (sessionsData) =>
        set((state) => ({
          sessionsData:
            typeof sessionsData === 'function'
              ? sessionsData(state.sessionsData)
              : sessionsData
        })),

      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      isMobileMenuOpen: false,
      setIsMobileMenuOpen: (isMobileMenuOpen) => set({ isMobileMenuOpen }),
      isCommandPaletteOpen: false,
      setIsCommandPaletteOpen: (isCommandPaletteOpen) =>
        set({ isCommandPaletteOpen })
    }),
    {
      name: 'endpoint-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedEndpoint: state.selectedEndpoint,
        userId: state.userId,
        authToken: state.authToken,
        sidebarCollapsed: state.sidebarCollapsed
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.()
      }
    }
  )
)
