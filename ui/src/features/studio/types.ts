/**
 * Response shapes of the Agno 3.1 routers the Studio uses, as they arrive
 * over the wire (`response_model_exclude_none`, so optional fields may be
 * missing). Kept local because `@/types/os` predates several of these fields.
 */

export type StudioKind = 'agent' | 'team' | 'workflow'

/** `ModelResponse`: `model` is the model id, `name` the provider class. */
export interface ModelRef {
  name?: string
  model?: string
  provider?: string
}

/** `AgentResponse` from `GET /agents`. `tools` is `{ tools: [...] }`. */
export interface AgentInfo {
  id: string
  name?: string
  description?: string
  role?: string
  model?: ModelRef
  tools?: unknown
  is_factory?: boolean
  is_component?: boolean
  current_version?: number
  stage?: string
  sandboxed?: boolean
}

/** `TeamResponse` from `GET /teams`. `members` are nested agent/team responses. */
export interface TeamInfo {
  id: string
  name?: string
  description?: string
  role?: string
  mode?: string
  model?: ModelRef
  members?: unknown
  is_factory?: boolean
  is_component?: boolean
  current_version?: number
  stage?: string
  sandboxed?: boolean
}

/** `WorkflowSummaryResponse` from `GET /workflows` (no steps). */
export interface WorkflowInfo {
  id: string
  name?: string
  description?: string
  is_factory?: boolean
  is_component?: boolean
  current_version?: number
  stage?: string
  sandboxed?: boolean
}

/** One entry of `WorkflowResponse.steps` (`Workflow.to_dict_for_steps`). */
export interface WorkflowStepInfo {
  name?: string
  description?: string
  type?: string
  agent?: { id?: string; name?: string } | null
  team?: { id?: string; name?: string } | null
  workflow_id?: string
  steps?: WorkflowStepInfo[] | null
}

/** `WorkflowResponse` from `GET /workflows/{id}`. */
export interface WorkflowDetail extends WorkflowInfo {
  steps?: WorkflowStepInfo[] | null
}

/** `ComponentResponse` from the components router. */
export interface StudioComponent {
  component_id: string
  component_type: StudioKind
  name?: string | null
  user_id?: string | null
  description?: string | null
  current_version?: number | null
  metadata?: Record<string, unknown> | null
  created_at: number
  updated_at?: number | null
  deleted_at?: number | null
}

/** `ComponentConfigResponse`: one version of a component. */
export interface ConfigVersion {
  component_id: string
  version: number
  label?: string | null
  stage: string
  config: Record<string, unknown>
  notes?: string | null
  created_at: number
  updated_at?: number | null
}

/** `RegistryContentResponse` from `GET /registry`. */
export interface RegistryResource {
  name: string
  type: string
  id?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  sandboxed?: boolean
}

/** Entry of the app's `GET /api/models` palette. */
export interface ModelOption {
  id: string
  provider: string
}

export interface ModelList {
  models: ModelOption[]
  /** False when the server list could not be loaded and defaults are shown. */
  fromServer: boolean
}

/** Response of the app's `POST /api/{agents|teams}/{id}/model`. */
export interface ModelUpdateResult {
  status?: string
  model_id?: string
  provider?: string
  updated_in_memory?: boolean
}

export type CatalogSource = 'code' | 'studio'

export interface MemberRef {
  id: string
  name: string
  kind: 'agent' | 'team'
}

/**
 * One card in a Studio grid: a code-defined agent/team/workflow or a
 * Studio-managed component, merged from the list route and the components
 * route so each id appears once.
 */
export interface CatalogItem {
  kind: StudioKind
  id: string
  name: string
  description: string
  source: CatalogSource
  /** Live version of a Studio-managed component; undefined when unpublished. */
  version?: number
  stage?: string
  modelId?: string
  provider?: string
  toolNames: string[]
  members: MemberRef[]
  sandboxed: boolean
  isFactory: boolean
  /** False for a draft-only component the list route does not serve yet. */
  hasDetails: boolean
  /** Text the search box matches against. */
  searchText: string
}
