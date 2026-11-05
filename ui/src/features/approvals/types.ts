/**
 * Approval records as returned by the Agno 3.1 approvals router
 * (agno/os/routers/approvals/schema.py: ApprovalResponse).
 */
export interface Approval {
  id: string
  run_id: string
  session_id: string
  /** pending | approved | rejected | expired | cancelled */
  status: string
  /** agent | team | workflow */
  source_type: string
  /** required (admin gate) | audit (record only) */
  approval_type?: string | null
  /** confirmation | user_input | external_execution */
  pause_type?: string | null
  tool_name?: string | null
  tool_args?: Record<string, unknown> | null
  expires_at?: number | null
  agent_id?: string | null
  team_id?: string | null
  workflow_id?: string | null
  user_id?: string | null
  schedule_id?: string | null
  schedule_run_id?: string | null
  source_name?: string | null
  requirements?: Array<Record<string, unknown>> | null
  context?: Record<string, unknown> | null
  resolution_data?: Record<string, unknown> | null
  resolved_by?: string | null
  resolved_at?: number | null
  created_at?: number | null
  updated_at?: number | null
}

export type ApprovalDecision = 'approved' | 'rejected'

/** Body of POST /approvals/{id}/resolve `resolution_data`, as Agno applies it on continue. */
export interface ResolutionData {
  note?: string
  /** Values for `requires_user_input` tools, keyed by field name. */
  values?: Record<string, unknown>
  /** Result for `external_execution` tools. */
  result?: string
}

export type SourceKind = 'agent' | 'team' | 'workflow'
