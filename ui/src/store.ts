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
  /** The AgentOS host every request goes to. */
  selectedEndpoint: string
  /** True once the operator saved a host; until then the deployment default is used. */
  endpointIsCustom: boolean
  /** Host from the deployment's NEXT_PUBLIC_API_URL, loaded at startup (not persisted). */
  serverDefaultEndpoint: string | null
  /** False until the host is known: a saved one, or the deployment default has loaded. */
  endpointResolved: boolean
  /** Apply the deployment default; keeps a host the operator saved. */
  applyServerDefaultEndpoint: (endpoint: string | null) => void
  /** Save a host chosen in Settings. */
  saveEndpoint: (endpoint: string) => void
  /** Go back to the deployment default (or localhost when there is none). */
  resetEndpoint: () => void
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

const trimEndpoint = (endpoint: string) => endpoint.trim().replace(/\/+$/, '')

type PersistedState = Pick<
  Store,
  | 'selectedEndpoint'
  | 'endpointIsCustom'
  | 'userId'
  | 'authToken'
  | 'sidebarCollapsed'
>

export const useStore = create<Store>()(
  persist(
    (set) => ({
      hydrated: false,
      // A saved host is known as soon as storage is restored; the default waits for /api/config.
      setHydrated: () =>
        set((state) => ({
          hydrated: true,
          endpointResolved: state.endpointResolved || state.endpointIsCustom
        })),

      selectedEndpoint: DEFAULT_ENDPOINT,
      endpointIsCustom: false,
      serverDefaultEndpoint: null,
      endpointResolved: false,
      applyServerDefaultEndpoint: (endpoint) =>
        set((state) => ({
          serverDefaultEndpoint: endpoint,
          endpointResolved: true,
          ...(state.endpointIsCustom
            ? {}
            : { selectedEndpoint: endpoint ?? DEFAULT_ENDPOINT })
        })),
      saveEndpoint: (endpoint) =>
        set((state) => {
          const selectedEndpoint = trimEndpoint(endpoint)
          const fallback = state.serverDefaultEndpoint ?? DEFAULT_ENDPOINT
          return {
            selectedEndpoint,
            endpointIsCustom: selectedEndpoint !== trimEndpoint(fallback),
            endpointResolved: true
          }
        }),
      resetEndpoint: () =>
        set((state) => ({
          selectedEndpoint: state.serverDefaultEndpoint ?? DEFAULT_ENDPOINT,
          endpointIsCustom: false,
          endpointResolved: true
        })),
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
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({
        selectedEndpoint: state.selectedEndpoint,
        endpointIsCustom: state.endpointIsCustom,
        userId: state.userId,
        authToken: state.authToken,
        sidebarCollapsed: state.sidebarCollapsed
      }),
      // v0 stored the host without knowing whether the operator chose it:
      // anything other than the old built-in default counts as their choice.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<PersistedState>
        if (version < 1) {
          const stored =
            typeof state.selectedEndpoint === 'string'
              ? trimEndpoint(state.selectedEndpoint)
              : ''
          state.endpointIsCustom =
            Boolean(stored) && stored !== DEFAULT_ENDPOINT
        }
        return state as PersistedState
      },
      // Runs while the store is still being created, so only use the state's own actions here.
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.()
      }
    }
  )
)
