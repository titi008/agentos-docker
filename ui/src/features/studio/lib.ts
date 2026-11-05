import type {
  AgentInfo,
  CatalogItem,
  ConfigVersion,
  MemberRef,
  ModelOption,
  RegistryResource,
  StudioComponent,
  StudioKind,
  TeamInfo,
  WorkflowInfo,
  WorkflowStepInfo
} from './types'

export const KIND_LABEL: Record<StudioKind, { one: string; many: string }> = {
  agent: { one: 'agent', many: 'agents' },
  team: { one: 'team', many: 'teams' },
  workflow: { one: 'workflow', many: 'workflows' }
}

export const LIST_HREF: Record<StudioKind, string> = {
  agent: '/studio/agents',
  team: '/studio/teams',
  workflow: '/studio/workflows'
}

export const LIST_TITLE: Record<StudioKind, string> = {
  agent: 'Agents',
  team: 'Teams',
  workflow: 'Workflows'
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function componentHref(componentId: string): string {
  return `/studio/components/${encodeURIComponent(componentId)}`
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

/* Models ------------------------------------------------------------------ */

/** Models offered when the server has no model palette. */
export const FALLBACK_MODELS: ModelOption[] = [
  { id: 'claude-sonnet-5-5', provider: 'Anthropic' },
  { id: 'claude-opus-5-5', provider: 'Anthropic' },
  { id: 'claude-haiku-5-5', provider: 'Anthropic' },
  { id: 'gemini-4-argon', provider: 'Google' },
  { id: 'gemini-3.8-flash', provider: 'Google' },
  { id: 'gpt-6.1-sol', provider: 'OpenAI' }
]

/** Keeps well-formed `{ id, provider }` entries, without duplicates. */
export function parseModelList(value: unknown): ModelOption[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.data)
      ? value.data
      : []
  const seen = new Set<string>()
  const models: ModelOption[] = []
  for (const entry of list) {
    if (!isRecord(entry)) continue
    const id = readString(entry, 'id')
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push({ id, provider: readString(entry, 'provider') ?? 'Other' })
  }
  return models
}

/** Model id stored in a component config: `{ id }` or `"provider:id"`. */
export function configModelId(config: Record<string, unknown> | undefined) {
  const model = config?.model
  if (typeof model === 'string') return model.split(':').pop() || undefined
  if (isRecord(model)) return readString(model, 'id')
  return undefined
}

/* Tools and members -------------------------------------------------------- */

function toolEntries(tools: unknown): unknown[] {
  if (Array.isArray(tools)) return tools
  if (isRecord(tools) && Array.isArray(tools.tools)) return tools.tools
  return []
}

/** Tool names from an agent response (`{ tools: [...] }`) or a config list. */
export function toolNames(tools: unknown): string[] {
  const names: string[] = []
  for (const entry of toolEntries(tools)) {
    if (typeof entry === 'string' && entry.trim()) names.push(entry)
    else if (isRecord(entry)) {
      const name = readString(entry, 'name')
      if (name) names.push(name)
    }
  }
  return names
}

/**
 * Tool chips for a stored config: toolkit functions are grouped under their
 * toolkit name, so a toolkit shows once.
 */
export function configToolLabels(config: Record<string, unknown> | undefined) {
  const labels: string[] = []
  for (const entry of toolEntries(config?.tools)) {
    let label: string | undefined
    if (typeof entry === 'string') label = entry.trim() || undefined
    else if (isRecord(entry))
      label = readString(entry, 'toolkit') ?? readString(entry, 'name')
    if (label && !labels.includes(label)) labels.push(label)
  }
  return labels
}

/** Members of a team response (nested agent/team responses). */
export function teamMembers(members: unknown): MemberRef[] {
  if (!Array.isArray(members)) return []
  const refs: MemberRef[] = []
  for (const member of members) {
    if (!isRecord(member)) continue
    const id = readString(member, 'id')
    if (!id) continue
    refs.push({
      id,
      name: readString(member, 'name') ?? id,
      kind: 'members' in member || 'mode' in member ? 'team' : 'agent'
    })
  }
  return refs
}

/** Member ids of a team config (`{ type, agent_id | team_id }`). */
export function configMemberIds(config: Record<string, unknown> | undefined) {
  const members = config?.members
  if (!Array.isArray(members)) return []
  const ids: string[] = []
  for (const member of members) {
    if (typeof member === 'string' && member.trim()) ids.push(member)
    else if (isRecord(member)) {
      const id = readString(member, 'agent_id') ?? readString(member, 'team_id')
      if (id) ids.push(id)
    }
  }
  return ids
}

export interface ConfigStepSummary {
  name: string
  executor: string
  target?: string
}

/** Steps of a workflow config (`{ type, name, agent_id | team_id | executor_ref }`). */
export function configSteps(config: Record<string, unknown> | undefined) {
  const steps = config?.steps
  if (!Array.isArray(steps)) return []
  return steps.filter(isRecord).map<ConfigStepSummary>((step, index) => {
    const agentId = readString(step, 'agent_id')
    const teamId = readString(step, 'team_id')
    const functionRef = readString(step, 'executor_ref')
    const type = readString(step, 'type') ?? 'Step'
    return {
      name: readString(step, 'name') ?? `Step ${index + 1}`,
      executor: agentId
        ? 'Agent'
        : teamId
          ? 'Team'
          : functionRef
            ? 'Function'
            : type,
      target: agentId ?? teamId ?? functionRef
    }
  })
}

/** Executor of a step in `GET /workflows/{id}` steps. */
export function stepExecutor(step: WorkflowStepInfo): {
  label: string
  target?: string
} {
  if (step.agent)
    return { label: 'Agent', target: step.agent.name ?? step.agent.id }
  if (step.team)
    return { label: 'Team', target: step.team.name ?? step.team.id }
  if (step.workflow_id) return { label: 'Workflow', target: step.workflow_id }
  const type = step.type?.trim()
  if (!type || type.toLowerCase() === 'step') return { label: 'Function' }
  return { label: capitalize(type) }
}

/* Instructions ------------------------------------------------------------- */

export interface InstructionsDraft {
  text: string
  /** `json` when the stored value is not a string (usually a list of strings). */
  format: 'text' | 'json'
}

export function instructionsToDraft(value: unknown): InstructionsDraft {
  if (value === undefined || value === null) return { text: '', format: 'text' }
  if (typeof value === 'string') return { text: value, format: 'text' }
  try {
    return { text: JSON.stringify(value, null, 2), format: 'json' }
  } catch {
    return { text: String(value), format: 'text' }
  }
}

/**
 * Turns edited instructions back into the stored type: a string stays a
 * string; JSON must still parse to the same kind of value (list or object).
 */
export function draftToInstructions(
  draft: InstructionsDraft,
  original: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (draft.format === 'text') return { ok: true, value: draft.text }
  let parsed: unknown
  try {
    parsed = JSON.parse(draft.text)
  } catch {
    return {
      ok: false,
      error: Array.isArray(original)
        ? 'These instructions are stored as a JSON list. Keep valid JSON, for example ["First rule", "Second rule"].'
        : 'These instructions are stored as JSON. Keep valid JSON syntax.'
    }
  }
  if (Array.isArray(original) !== Array.isArray(parsed)) {
    return {
      ok: false,
      error: Array.isArray(original)
        ? 'Keep the instructions as a JSON list of strings.'
        : 'Keep the instructions in the same JSON shape.'
    }
  }
  if (
    Array.isArray(parsed) &&
    parsed.some((entry) => typeof entry !== 'string')
  ) {
    return { ok: false, error: 'Every instruction in the list must be text.' }
  }
  return { ok: true, value: parsed }
}

/** Latest visible version number; the next publish gets this plus one. */
export function latestVersion(configs: ConfigVersion[]): number {
  return configs.reduce((max, config) => Math.max(max, config.version), 0)
}

/* Catalog ------------------------------------------------------------------ */

type ListEntry = AgentInfo | TeamInfo | WorkflowInfo

function describe(entry: ListEntry | undefined): string {
  if (!entry) return ''
  if ('role' in entry && entry.role && !entry.description) return entry.role
  return entry.description ?? ''
}

function toItem(
  kind: StudioKind,
  entry: ListEntry | undefined,
  component: StudioComponent | undefined
): CatalogItem {
  const id = component?.component_id ?? entry?.id ?? ''
  const name = component?.name || entry?.name || id
  const description = component?.description || describe(entry)
  const model = entry && 'model' in entry ? entry.model : undefined
  const tools =
    kind === 'agent' && entry && 'tools' in entry ? toolNames(entry.tools) : []
  const members =
    kind === 'team' && entry && 'members' in entry
      ? teamMembers(entry.members)
      : []
  const role = entry && 'role' in entry ? (entry.role ?? '') : ''
  return {
    kind,
    id,
    name,
    description,
    // A component row always means Studio-managed; so does a list entry the
    // server marks as a component (published Studio agents in GET /agents).
    source: component || entry?.is_component ? 'studio' : 'code',
    version: component?.current_version ?? entry?.current_version ?? undefined,
    stage: entry?.stage,
    modelId: model?.model,
    provider: model?.provider,
    toolNames: tools,
    members,
    sandboxed: Boolean(entry?.sandboxed),
    isFactory: Boolean(entry?.is_factory),
    hasDetails: Boolean(entry),
    searchText: [name, id, description, role].join('\n').toLowerCase()
  }
}

/**
 * Merges the list route (code-defined entries plus published Studio
 * components) with the components route (every Studio component, drafts
 * included) so each id appears once. Code-defined items come first.
 */
export function buildCatalog(
  kind: StudioKind,
  entries: ListEntry[] | undefined,
  components: StudioComponent[] | undefined
): CatalogItem[] {
  const byId = new Map<string, ListEntry>()
  for (const entry of entries ?? []) if (entry.id) byId.set(entry.id, entry)

  const studio = new Map<string, CatalogItem>()
  for (const component of components ?? []) {
    if (component.component_type !== kind || component.deleted_at) continue
    studio.set(
      component.component_id,
      toItem(kind, byId.get(component.component_id), component)
    )
  }

  const code: CatalogItem[] = []
  for (const entry of byId.values()) {
    if (studio.has(entry.id)) continue
    const item = toItem(kind, entry, undefined)
    if (item.source === 'studio') studio.set(item.id, item)
    else code.push(item)
  }

  const byName = (a: CatalogItem, b: CatalogItem) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  return [...code.sort(byName), ...[...studio.values()].sort(byName)]
}

export function matchesQuery(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return !needle || text.includes(needle)
}

/* Registry ----------------------------------------------------------------- */

export type RegistryFilter =
  'all' | 'model' | 'tool' | 'function' | 'knowledge' | 'learning' | 'other'

export const REGISTRY_FILTERS: { value: RegistryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'model', label: 'Models' },
  { value: 'tool', label: 'Tools & toolkits' },
  { value: 'function', label: 'Functions' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'learning', label: 'Learning' },
  { value: 'other', label: 'Other' }
]

/** Filter bucket of a resource; `tool` and `toolkit` share one bucket. */
export function registryCategory(
  resource: RegistryResource
): Exclude<RegistryFilter, 'all'> {
  switch (resource.type) {
    case 'model':
      return 'model'
    case 'tool':
    case 'toolkit':
      return 'tool'
    case 'function':
      return 'function'
    case 'knowledge':
      return 'knowledge'
    case 'learning':
      return 'learning'
    default:
      return 'other'
  }
}

export function isToolkit(resource: RegistryResource): boolean {
  return (
    resource.type === 'toolkit' ||
    (resource.type === 'tool' && resource.metadata?.is_toolkit === true)
  )
}

const TYPE_LABELS: Record<string, string> = {
  tool: 'Tool',
  toolkit: 'Toolkit',
  model: 'Model',
  db: 'Database',
  vector_db: 'Vector database',
  schema: 'Schema',
  function: 'Function',
  agent: 'Agent',
  team: 'Team',
  workflow: 'Workflow',
  knowledge: 'Knowledge',
  memory_manager: 'Memory manager',
  session_summary_manager: 'Session summaries',
  learning: 'Learning'
}

export function registryTypeLabel(resource: RegistryResource): string {
  if (isToolkit(resource)) return 'Toolkit'
  return TYPE_LABELS[resource.type] ?? capitalize(resource.type)
}

/** Stable key for URLs and React lists. */
export function registryKey(resource: RegistryResource): string {
  return `${resource.type}:${resource.id || resource.name}`
}

/** Name another component uses to refer to the resource. */
export function registryIdentifier(resource: RegistryResource): string {
  if (resource.id) return resource.id
  const modelId = resource.metadata?.model_id
  if (resource.type === 'model' && typeof modelId === 'string' && modelId)
    return modelId
  return resource.name
}

export interface RegistryFunctionInfo {
  name: string
  description?: string
  parameters: Record<string, unknown>
  requiresConfirmation: boolean
  externalExecution: boolean
}

const EMPTY_PARAMETERS = { type: 'object', properties: {}, required: [] }

function functionInfo(
  record: Record<string, unknown>,
  fallbackName: string,
  fallbackDescription?: string | null
): RegistryFunctionInfo | null {
  const name = readString(record, 'name') ?? fallbackName
  if (!name) return null
  return {
    name,
    description:
      readString(record, 'description') ?? fallbackDescription ?? undefined,
    parameters: isRecord(record.parameters)
      ? record.parameters
      : EMPTY_PARAMETERS,
    requiresConfirmation: record.requires_confirmation === true,
    externalExecution: record.external_execution === true
  }
}

/** Functions a tool resource contributes (a toolkit lists several). */
export function registryFunctions(
  resource: RegistryResource
): RegistryFunctionInfo[] {
  const metadata = resource.metadata ?? {}
  if (isToolkit(resource)) {
    const functions = Array.isArray(metadata.functions)
      ? metadata.functions
      : []
    return functions
      .filter(isRecord)
      .map((fn) => functionInfo(fn, ''))
      .filter((fn): fn is RegistryFunctionInfo => fn !== null)
  }
  const single = functionInfo(
    { ...metadata, name: resource.name },
    resource.name,
    resource.description
  )
  return single ? [single] : []
}

/**
 * Serialized tool entries for an agent config, in the `Function.to_dict()`
 * shape the registry rehydrates (`name` + `parameters`, plus the owning
 * `toolkit` so functions bind to the right toolkit on load).
 */
export function toolConfigEntries(
  resource: RegistryResource
): Record<string, unknown>[] {
  const toolkit = isToolkit(resource) ? resource.name : undefined
  return registryFunctions(resource).map((fn) => ({
    name: fn.name,
    ...(fn.description ? { description: fn.description } : {}),
    parameters: fn.parameters,
    ...(fn.requiresConfirmation ? { requires_confirmation: true } : {}),
    ...(fn.externalExecution ? { external_execution: true } : {}),
    ...(toolkit ? { toolkit } : {})
  }))
}

/** Registry resources an agent can attach as tools. */
export function isAttachableTool(resource: RegistryResource): boolean {
  return registryCategory(resource) === 'tool'
}
