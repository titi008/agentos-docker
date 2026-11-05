/**
 * Company records as returned by the Agno 3.1 company routers
 * (agno/os/routers/company/schema.py).
 */

export const TASK_STATUSES = [
  'backlog',
  'ready',
  'in_progress',
  'in_review',
  'done',
  'cancelled'
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export type ExecutorType = 'agent' | 'team' | 'workflow'

export type ProjectStatus = 'proposed' | 'active' | 'done' | 'cancelled'

export type TaskCounts = Partial<Record<TaskStatus, number>>

export interface Product {
  id: string
  name: string
  purpose?: string | null
  user_id?: string | null
  metadata?: Record<string, unknown> | null
  counts?: { projects?: number; tasks?: TaskCounts }
  created_at: number
  updated_at?: number | null
}

export interface Project {
  id: string
  product_id: string
  name: string
  outcome?: string | null
  status: ProjectStatus | string
  target_date?: number | null
  counts?: { tasks?: TaskCounts }
  created_at: number
  updated_at?: number | null
}

/** One entry of a task's lifecycle history. Run starts carry an `attempt`. */
export interface TaskTransitionEntry {
  from?: string
  target?: string
  reason?: string
  user_id?: string | null
  created_at?: number
  attempt?: number
}

export interface Task {
  id: string
  product_id: string
  project_id?: string | null
  title: string
  brief?: string | null
  status: TaskStatus
  origin?: string | null
  routine_id?: string | null
  user_id?: string | null
  transitions?: TaskTransitionEntry[]
  created_at: number
  updated_at?: number | null
  executor_type?: string | null
  executor_id?: string | null
  accepted_by?: string | null
  accepted_at?: number | null
  session_id?: string | null
  job_id?: string | null
  sandboxed?: boolean
}

export interface WikiPageMeta {
  path: string
  size_bytes: number
  version?: number | null
  updated_at?: number | null
  user_id?: string | null
}

export interface WikiPage {
  content: string
  metadata: WikiPageMeta
}
