import type { BadgeTone } from '@/components/ui/badge'

import type { Task, TaskStatus } from './types'

export const STATUS_META: Record<
  TaskStatus,
  { label: string; tone: BadgeTone; dot: string; empty: string }
> = {
  backlog: {
    label: 'Backlog',
    tone: 'neutral',
    dot: 'bg-fg-3',
    empty: 'Propose a task to get started.'
  },
  ready: {
    label: 'Ready',
    tone: 'warn',
    dot: 'bg-warn',
    empty: 'Mark a backlog task ready once it is clear enough to start.'
  },
  in_progress: {
    label: 'In progress',
    tone: 'info',
    dot: 'bg-info',
    empty: 'Start a ready task to see it here.'
  },
  in_review: {
    label: 'In review',
    tone: 'accent',
    dot: 'bg-accent',
    empty: 'Tasks wait here while their work is reviewed.'
  },
  done: {
    label: 'Done',
    tone: 'ok',
    dot: 'bg-ok',
    empty: 'Finished tasks appear here.'
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'neutral',
    dot: 'bg-line-strong',
    empty: 'Cancelled tasks appear here.'
  }
}

export const BOARD_STATUSES: TaskStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'in_review',
  'done'
]

/** Progress steps shown for a task (cancelled is shown as a badge instead). */
export const PROGRESS_STATUSES = BOARD_STATUSES

/**
 * Lifecycle rules mirrored from agno/db/schemas/tasks.py (TASK_TRANSITIONS).
 * In progress is never a transition target: it is entered by starting a run
 * (POST /company/tasks/{id}/runs).
 */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['ready', 'in_review', 'done', 'cancelled'],
  ready: ['backlog', 'in_review', 'done', 'cancelled'],
  in_progress: ['backlog', 'ready', 'in_review', 'done', 'cancelled'],
  in_review: ['backlog', 'ready', 'done', 'cancelled'],
  done: ['backlog', 'ready', 'in_review', 'cancelled'],
  cancelled: ['backlog', 'ready', 'in_review', 'done']
}

export type TaskAction =
  | { kind: 'transition'; target: TaskStatus; label: string; danger?: boolean }
  | { kind: 'start'; attempt: number; label: string }
  | { kind: 'stop'; runId: string; label: string; danger: true }

export function actionKey(action: TaskAction): string {
  return action.kind === 'transition'
    ? `transition:${action.target}`
    : action.kind
}

function attempts(task: Task): number[] {
  return (task.transitions ?? [])
    .map((entry) => entry.attempt)
    .filter((attempt): attempt is number => typeof attempt === 'number')
}

export function hasExecutor(task: Task): boolean {
  return Boolean(task.executor_type && task.executor_id)
}

function transitionLabel(from: TaskStatus, target: TaskStatus): string {
  switch (target) {
    case 'ready':
      return from === 'backlog' ? 'Mark ready' : 'Move back to Ready'
    case 'backlog':
      return 'Move back to Backlog'
    case 'in_review':
      return from === 'in_progress' ? 'Send to review' : 'Move to review'
    case 'done':
      return 'Mark done'
    case 'cancelled':
      return 'Cancel task'
    default:
      return `Move to ${STATUS_META[target].label}`
  }
}

/**
 * The actions the backend accepts for a task right now: one primary forward
 * step and the remaining valid moves. Review and completion from anywhere but
 * the step before them need an earlier run attempt, as the server enforces.
 */
export function taskActions(task: Task): {
  primary: TaskAction | null
  secondary: TaskAction[]
} {
  const status = task.status
  const runAttempts = attempts(task)
  const hasAttempt = runAttempts.length > 0
  const nextAttempt = Math.max(0, ...runAttempts) + 1

  const targets = TRANSITIONS[status].filter((target) => {
    if (target === 'in_review') return status === 'in_progress' || hasAttempt
    if (target === 'done') return status === 'in_review' || hasAttempt
    return true
  })
  const transition = (target: TaskStatus): TaskAction => ({
    kind: 'transition',
    target,
    label: transitionLabel(status, target),
    danger: target === 'cancelled' || undefined
  })

  let primary: TaskAction | null = null
  const extra: TaskAction[] = []
  if (status === 'backlog') primary = transition('ready')
  if (status === 'ready' && hasExecutor(task)) {
    primary = { kind: 'start', attempt: nextAttempt, label: 'Start' }
  }
  if (status === 'in_progress') {
    primary = transition('in_review')
    if (task.job_id) {
      extra.push({
        kind: 'stop',
        runId: task.job_id,
        label: 'Stop the run',
        danger: true
      })
    }
  }
  if (status === 'in_review') {
    primary = transition('done')
    if (hasExecutor(task) && hasAttempt) {
      extra.push({
        kind: 'start',
        attempt: nextAttempt,
        label: 'Run another attempt'
      })
    }
  }

  const primaryKey = primary ? actionKey(primary) : null
  const moves = targets
    .map(transition)
    .filter((action) => actionKey(action) !== primaryKey)
  const all = [...extra, ...moves]
  // Destructive actions go last.
  const secondary = [
    ...all.filter((action) => !isDanger(action)),
    ...all.filter(isDanger)
  ]
  return { primary, secondary }
}

export function isDanger(action: TaskAction): boolean {
  return (
    action.kind === 'stop' ||
    (action.kind === 'transition' && Boolean(action.danger))
  )
}

/** Short explanation under the primary action. */
export function actionHelp(action: TaskAction): string {
  switch (action.kind) {
    case 'start':
      return action.attempt > 1
        ? `Starts attempt ${action.attempt} and moves the task to In progress.`
        : 'Starts a run and moves the task to In progress.'
    case 'stop':
      return 'Stops the running attempt.'
    case 'transition':
      return action.target === 'ready'
        ? 'Moves the task to Ready. Company Manager can then pick it up.'
        : `Moves the task to ${STATUS_META[action.target].label}.`
  }
}

export function defaultReason(target: TaskStatus): string {
  return `Moved to ${STATUS_META[target].label.toLowerCase()} from UI`
}
