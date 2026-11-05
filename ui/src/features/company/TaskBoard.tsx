'use client'

import { Folder } from 'lucide-react'

import { Chip } from '@/components/ui/badge'
import { SegmentedControl } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { cn } from '@/lib/utils'

import { ExecutorIcon, type Executors } from './executors'
import { STATUS_META } from './status'
import type { Project, Task, TaskStatus } from './types'

function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span
      aria-hidden
      className={cn('size-2 shrink-0 rounded-full', STATUS_META[status].dot)}
    />
  )
}

function TaskCard({
  task,
  project,
  executors,
  selected,
  onSelect
}: {
  task: Task
  project: Project | undefined
  executors: Executors
  selected: boolean
  onSelect: (taskId: string) => void
}) {
  const executor = executors.lookup(task.executor_type, task.executor_id)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(task.id)}
      className={cn(
        'flex w-full flex-col gap-2 rounded-[10px] border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong',
        selected && 'border-accent ring-1 ring-accent hover:border-accent'
      )}
    >
      <span className="text-[13.5px] leading-snug font-medium break-words">
        {task.title}
      </span>
      {task.brief ? (
        <span className="line-clamp-2 text-[12.5px] leading-normal break-words text-fg-3">
          {task.brief}
        </span>
      ) : null}
      {project ? (
        <span className="flex min-w-0">
          <Chip className="h-6 text-xs">
            <Folder aria-hidden />
            <span className="truncate">{project.name}</span>
          </Chip>
        </span>
      ) : null}
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-fg-2">
          <ExecutorIcon type={executor?.type} />
          <span className="truncate">{executor?.name ?? 'Unassigned'}</span>
        </span>
        <RelativeTime
          value={task.created_at}
          className="shrink-0 whitespace-nowrap text-fg-3"
        />
      </span>
    </button>
  )
}

interface TaskBoardProps {
  statuses: TaskStatus[]
  groups: Map<TaskStatus, Task[]>
  /** Column shown on phones, where the board shows one status at a time. */
  mobileStatus: TaskStatus
  onMobileStatusChange: (status: TaskStatus) => void
  selectedId: string | null
  onSelect: (taskId: string) => void
  projectsById: Map<string, Project>
  /** Hide the project chip when the board is already filtered to one project. */
  showProject: boolean
  executors: Executors
}

/**
 * Kanban board. Desktop and tablets show every column (scrolling sideways
 * with snap when they don't fit); phones switch between columns.
 */
export function TaskBoard({
  statuses,
  groups,
  mobileStatus,
  onMobileStatusChange,
  selectedId,
  onSelect,
  projectsById,
  showProject,
  executors
}: TaskBoardProps) {
  const active = statuses.includes(mobileStatus) ? mobileStatus : statuses[0]

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        aria-label="Task status"
        className="md:hidden"
        value={active}
        onChange={onMobileStatusChange}
        options={statuses.map((status) => ({
          value: status,
          label: (
            <>
              <StatusDot status={status} />
              {STATUS_META[status].label}
            </>
          ),
          count: groups.get(status)?.length ?? 0
        }))}
      />
      <div className="flex items-start gap-3 overflow-x-auto pb-2 md:snap-x md:snap-mandatory">
        {statuses.map((status) => {
          const tasks = groups.get(status) ?? []
          const meta = STATUS_META[status]
          return (
            <section
              key={status}
              aria-labelledby={`column-${status}`}
              className={cn(
                'flex shrink-0 flex-col gap-2 rounded-xl border border-line bg-panel p-2.5 max-md:w-full md:w-[260px] md:snap-start',
                status !== active && 'max-md:hidden'
              )}
            >
              <h2
                id={`column-${status}`}
                className="flex items-center gap-2 px-1 pt-0.5 pb-1 text-[13px] font-semibold"
              >
                <StatusDot status={status} />
                {meta.label}
                <span className="text-[12.5px] font-normal text-fg-3 tabular-nums">
                  {tasks.length}
                </span>
              </h2>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  project={
                    showProject && task.project_id
                      ? projectsById.get(task.project_id)
                      : undefined
                  }
                  executors={executors}
                  selected={task.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
              {tasks.length === 0 ? (
                <div className="flex flex-col gap-1 px-1 py-3.5 text-center text-[12.5px] text-fg-3">
                  <span className="max-md:hidden">No tasks here</span>
                  <span className="font-medium text-fg md:hidden">
                    No {meta.label.toLowerCase()} tasks
                  </span>
                  <span className="md:hidden">{meta.empty}</span>
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Column placeholders while tasks load. */
export function TaskBoardSkeleton({ columns }: { columns: number }) {
  return (
    <div role="status" className="flex gap-3 overflow-hidden">
      <span className="sr-only">Loading tasks…</span>
      {Array.from({ length: columns }, (_, index) => (
        <div
          key={index}
          className={cn(
            'flex shrink-0 flex-col gap-2 rounded-xl border border-line bg-panel p-2.5 max-md:w-full md:w-[260px]',
            index > 0 && 'max-md:hidden'
          )}
        >
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-24 w-full rounded-[10px]" />
          <Skeleton className="h-24 w-full rounded-[10px]" />
        </div>
      ))}
    </div>
  )
}
