/**
 * Response shapes of the AgentOS knowledge, memory, learnings and filesystem
 * routers (agno 3.1.12, `agno/os/routers/*`). Optional fields mirror the
 * Pydantic models, which serialise missing values as null.
 */

export interface PaginationMeta {
  page: number
  limit: number
  total_pages: number
  total_count: number
}

export interface PageResult<T> {
  items: T[]
  totalCount: number
  totalPages: number
}

/* /config ------------------------------------------------------------------ */

export interface KnowledgeInstance {
  id: string
  name: string
  description?: string | null
  db_id: string
  table: string
}

export interface FilesystemNamespaceConfig {
  namespace: string
  agents: { id: string; access?: 'full' | 'read_only' }[]
}

/** The parts of `GET /config` this area reads. */
export interface OsConfigSlice {
  knowledge?: {
    knowledge_instances?: KnowledgeInstance[] | null
  } | null
  filesystem?: {
    namespaces?: FilesystemNamespaceConfig[] | null
  } | null
}

/* /knowledge ---------------------------------------------------------------- */

export type ContentStatus = 'processing' | 'completed' | 'partial' | 'failed'

export interface KnowledgeDocument {
  id: string
  name?: string | null
  description?: string | null
  /** MIME type or reader content type. */
  type?: string | null
  /** Size in bytes, as a string. */
  size?: string | null
  metadata?: Record<string, unknown> | null
  status?: ContentStatus | string | null
  status_message?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface RetrievedChunk {
  id?: string | null
  content: string
  name?: string | null
  meta_data?: Record<string, unknown> | null
  reranking_score?: number | null
  content_id?: string | null
  content_origin?: string | null
  size?: number | null
}

/** The part of `GET /knowledge/config` used to build the upload `accept` list. */
export interface KnowledgeReaderConfig {
  readersForType?: Record<string, string[]> | null
}

/* /memories ----------------------------------------------------------------- */

export interface Memory {
  memory_id: string
  memory: string
  topics?: string[] | null
  agent_id?: string | null
  team_id?: string | null
  user_id?: string | null
  updated_at?: string | null
}

/* /learnings ---------------------------------------------------------------- */

export interface Learning {
  learning_id: string
  learning_type: string
  namespace?: string | null
  user_id?: string | null
  agent_id?: string | null
  team_id?: string | null
  session_id?: string | null
  entity_id?: string | null
  entity_type?: string | null
  content?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  /** Unix seconds. */
  created_at?: number | null
  /** Unix seconds. */
  updated_at?: number | null
}

/* /filesystem --------------------------------------------------------------- */

export interface FileEntry {
  namespace: string
  path: string
  agent_ids: string[]
  size_bytes: number
  version?: number | null
  /** Unix seconds. */
  updated_at?: number | null
  /** Partition owner; empty for the shared partition. */
  user_id?: string | null
  snippet?: string | null
  line?: number | null
  match_count?: number | null
}

export interface FileListResponse {
  entries?: FileEntry[]
  meta?: Partial<PaginationMeta>
}

export interface FileContent {
  namespace: string
  agent_ids: string[]
  path: string
  /** The requested slice of the file (character offset based). */
  content: string
  size_bytes: number
  version?: number | null
  updated_at?: number | null
  user_id?: string | null
  /** Lines in the whole file. */
  line_count: number
  truncated: boolean
  offset: number
  limit: number
  next_offset?: number | null
}
