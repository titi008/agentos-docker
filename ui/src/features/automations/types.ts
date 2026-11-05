/**
 * Response shapes of the Agno 3.1 schedule and job queue routers
 * (`agno/os/routers/schedules/schema.py`, `agno/os/routers/job_queue/schema.py`).
 * All timestamps are epoch seconds.
 */

export interface PaginationMeta {
  page: number
  limit: number
  total_pages: number
  total_count: number
}

export interface Paginated<T> {
  data: T[]
  meta?: PaginationMeta
}

export interface Schedule {
  id: string
  /** `null` for unowned (system) schedules. */
  user_id?: string | null
  name: string
  description?: string | null
  method: string
  endpoint: string
  payload?: Record<string, unknown> | null
  /** `null` for on-demand schedules, which only run when triggered. */
  cron_expr?: string | null
  timezone: string
  timeout_seconds?: number
  max_retries?: number
  retry_delay_seconds?: number
  enabled: boolean
  next_run_at?: number | null
  /** Control plane that owns the row: `company`, `studio`, or none. */
  managed_by?: string | null
  target_type?: string | null
  target_id?: string | null
  /** Why the system paused it, e.g. `target_archived:agent:x` or `company_off`. */
  disabled_reason?: string | null
  created_at?: number | null
  updated_at?: number | null
}

/** Trimmed response of `/schedules/{id}/enable|disable`. */
export interface ScheduleState {
  id: string
  name: string
  enabled: boolean
  next_run_at?: number | null
  updated_at?: number | null
}

export type ScheduleRunStatus =
  'running' | 'success' | 'failed' | 'paused' | 'cancelled'

export interface ScheduleRun {
  id: string
  schedule_id: string
  user_id?: string | null
  attempt: number
  triggered_at?: number | null
  completed_at?: number | null
  status: ScheduleRunStatus | (string & {})
  status_code?: number | null
  run_id?: string | null
  session_id?: string | null
  error?: string | null
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
  /** Pending approvals of a paused run. */
  requirements?: Record<string, unknown>[] | null
  created_at?: number | null
}

/** `agno.db.schemas.jobs.JOB_STATUSES`. */
export const JOB_STATUSES = [
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled'
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export interface QueueJob {
  /** Identical to the run's run_id. */
  id: string
  component_type: string
  component_id: string
  session_id: string
  job_type: string
  user_id?: string | null
  payload?: Record<string, unknown>
  status: JobStatus | (string & {})
  attempt: number
  max_attempts: number
  idempotency_key?: string | null
  available_at?: number | null
  locked_by?: string | null
  locked_at?: number | null
  error?: string | null
  created_at?: number | null
  updated_at?: number | null
  completed_at?: number | null
}

/** `GET /queue/stats`. */
export interface QueueStats {
  counts: Partial<Record<JobStatus, number>> & Record<string, number>
  oldest_queued_age_seconds: number | null
}
