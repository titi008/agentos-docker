'use client'

import { useMutation } from '@tanstack/react-query'
import { ChevronDown, ExternalLink, Folder } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

import { ApiError, getErrorMessage, useApi } from '@/api/client'
import { chatHref } from '@/components/shell/nav'
import { Badge, Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/code'
import { useConfirm } from '@/components/ui/confirm'
import { Card, KeyValueList, type KeyValueItem } from '@/components/ui/data'
import { DetailPanel } from '@/components/ui/detail-panel'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger
} from '@/components/ui/menu'
import { ErrorState, LoadingRows } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'

import { useInvalidateWork, useTaskQuery } from './api'
import {
  decodeExecutor,
  encodeExecutor,
  ExecutorIcon,
  executorKindLabel,
  ExecutorOptions,
  type Executors
} from './executors'
import {
  actionHelp,
  actionKey,
  defaultReason,
  hasExecutor,
  isDanger,
  PROGRESS_STATUSES,
  STATUS_META,
  taskActions,
  type TaskAction
} from './status'
import type { Product, Project, Task } from './types'

function friendlyError(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    error.detail?.includes('Cancel the run')
  ) {
    return 'The task’s run is still active. Stop the run first, then move the task.'
  }
  return getErrorMessage(error)
}

function Progress({ task }: { task: Task }) {
  if (task.status === 'cancelled') return null
  const index = PROGRESS_STATUSES.indexOf(task.status)
  return (
    <ol
      aria-label={`Task progress: ${STATUS_META[task.status].label}, step ${index + 1} of ${PROGRESS_STATUSES.length}`}
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs md:hidden"
    >
      {PROGRESS_STATUSES.map((status, step) => (
        <li
          key={status}
          className={cn(
            'flex items-center gap-1.5',
            step <= index ? 'text-fg' : 'text-fg-3'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-2 rounded-full',
              step < index
                ? 'bg-ok'
                : step === index
                  ? 'bg-accent'
                  : 'bg-line-strong'
            )}
          />
          {STATUS_META[status].label}
          {step < PROGRESS_STATUSES.length - 1 ? (
            <span aria-hidden className="h-px w-3 bg-line-strong" />
          ) : null}
        </li>
      ))}
    </ol>
  )
}

/** Primary move, other valid moves and the optional note sent as the reason. */
function TaskActions({
  task,
  executors
}: {
  task: Task
  executors: Executors
}) {
  const api = useApi()
  const confirm = useConfirm()
  const invalidate = useInvalidateWork()
  const [note, setNote] = useState('')
  const [executorChoice, setExecutorChoice] = useState<string | null>(null)
  const [executorError, setExecutorError] = useState<string | null>(null)

  const { primary, secondary } = taskActions(task)
  const allActions = primary ? [primary, ...secondary] : secondary
  const current = executors.lookup(task.executor_type, task.executor_id)
  const executorValue =
    executorChoice ?? (current ? encodeExecutor(current.type, current.id) : '')
  const selectedExecutor = decodeExecutor(executorValue)
  const selectedInfo = selectedExecutor
    ? executors.lookup(selectedExecutor.type, selectedExecutor.id)
    : null
  const canMoveToReady = allActions.some(
    (action) => action.kind === 'transition' && action.target === 'ready'
  )
  // Ready needs someone to run the task; ask when it can't come from the task.
  const showExecutor =
    canMoveToReady && (task.status === 'backlog' || !hasExecutor(task))
  const hasTransitions = allActions.some(
    (action) => action.kind === 'transition'
  )

  const run = useMutation({
    mutationFn: async (action: TaskAction) => {
      const id = encodeURIComponent(task.id)
      if (action.kind === 'start') {
        return api.request(`/company/tasks/${id}/runs`, {
          method: 'POST',
          json: { attempt: action.attempt }
        })
      }
      if (action.kind === 'stop') {
        return api.request(
          `/company/runs/${encodeURIComponent(action.runId)}/cancel`,
          { method: 'POST' }
        )
      }
      // Defaults to the task's current executor when none was chosen.
      const executor = action.target === 'ready' ? selectedExecutor : null
      return api.request(`/company/tasks/${id}/transitions`, {
        method: 'POST',
        json: {
          target: action.target,
          reason: note.trim() || defaultReason(action.target),
          ...(executor
            ? { executor_type: executor.type, executor_id: executor.id }
            : {})
        }
      })
    },
    onSuccess: async (_, action) => {
      toast.success(
        action.kind === 'start'
          ? 'Run started'
          : action.kind === 'stop'
            ? 'Run stopped'
            : `Task moved to ${STATUS_META[action.target].label}`
      )
      setNote('')
      await invalidate()
    },
    onError: (error, action) => {
      toast.error(
        action.kind === 'start'
          ? "Couldn't start the run"
          : action.kind === 'stop'
            ? "Couldn't stop the run"
            : "Couldn't move the task",
        { description: friendlyError(error) }
      )
    }
  })

  const perform = async (action: TaskAction) => {
    if (run.isPending) return
    if (
      action.kind === 'transition' &&
      action.target === 'ready' &&
      showExecutor &&
      !selectedExecutor
    ) {
      setExecutorError('Choose a team or agent to run this task.')
      return
    }
    if (action.kind === 'transition' && action.target === 'cancelled') {
      const ok = await confirm({
        title: 'Cancel this task?',
        description: `“${task.title}” moves to Cancelled. You can move it back later.`,
        confirmLabel: 'Cancel task',
        cancelLabel: 'Keep task',
        tone: 'danger'
      })
      if (!ok) return
    }
    if (action.kind === 'stop') {
      const ok = await confirm({
        title: 'Stop the run?',
        description:
          'The agent stops working on this task. What it produced so far stays in the run history.',
        confirmLabel: 'Stop run',
        cancelLabel: 'Keep running',
        tone: 'danger'
      })
      if (!ok) return
    }
    run.mutate(action)
  }

  const pendingKey = run.isPending ? actionKey(run.variables) : null
  const notePlaceholder = defaultReason(
    primary?.kind === 'transition' ? primary.target : 'backlog'
  )
  const safeSecondary = secondary.filter((action) => !isDanger(action))
  const dangerSecondary = secondary.filter(isDanger)

  return (
    <Card className="flex flex-col gap-3 bg-raised p-4">
      {showExecutor ? (
        <Field
          label="Assign to"
          htmlFor="task-executor"
          required={
            primary?.kind === 'transition' && primary.target === 'ready'
          }
          error={executorError}
          help={
            selectedInfo?.caption ?? 'Ready needs a team or agent to run it.'
          }
        >
          <Select
            id="task-executor"
            value={executorValue}
            aria-invalid={Boolean(executorError) || undefined}
            aria-describedby="task-executor-help"
            onChange={(event) => {
              setExecutorChoice(event.target.value)
              setExecutorError(null)
            }}
          >
            <ExecutorOptions executors={executors} current={current} />
          </Select>
        </Field>
      ) : null}
      {hasTransitions ? (
        <Field
          label={
            <>
              Note for this change{' '}
              <span className="font-normal text-fg-3">(optional)</span>
            </>
          }
          htmlFor="task-note"
        >
          <Input
            id="task-note"
            value={note}
            maxLength={500}
            placeholder={notePlaceholder}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {primary ? (
          <Button
            variant="primary"
            size="sm"
            loading={pendingKey === actionKey(primary)}
            disabled={run.isPending}
            onClick={() => perform(primary)}
          >
            {primary.label}
          </Button>
        ) : null}
        {secondary.length > 0 ? (
          <Menu>
            <MenuTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                loading={secondary.some(
                  (action) => actionKey(action) === pendingKey
                )}
                disabled={run.isPending}
              >
                {primary ? 'More actions' : 'Move task'}
                <ChevronDown />
              </Button>
            </MenuTrigger>
            <MenuContent align="start">
              {safeSecondary.map((action) => (
                <MenuItem
                  key={actionKey(action)}
                  onSelect={() => perform(action)}
                >
                  {action.label}
                </MenuItem>
              ))}
              {safeSecondary.length > 0 && dangerSecondary.length > 0 ? (
                <MenuSeparator />
              ) : null}
              {dangerSecondary.map((action) => (
                <MenuItem
                  key={actionKey(action)}
                  tone="danger"
                  onSelect={() => perform(action)}
                >
                  {action.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        ) : null}
      </div>
      <p className="text-[12.5px] text-fg-3">
        {primary
          ? actionHelp(primary)
          : task.status === 'done'
            ? 'This task is done. Move it if it needs more work.'
            : 'This task was cancelled. Move it back to pick it up again.'}
      </p>
    </Card>
  )
}

interface TaskDetailProps {
  taskId: string
  placeholder: Task | undefined
  products: Product[]
  projects: Project[]
  executors: Executors
  onClose: () => void
}

export function TaskDetail({
  taskId,
  placeholder,
  products,
  projects,
  executors,
  onClose
}: TaskDetailProps) {
  const query = useTaskQuery(taskId, placeholder)
  const task = query.data

  if (!task) {
    return (
      <DetailPanel
        title={query.isError ? 'Task unavailable' : 'Loading task…'}
        backLabel="All tasks"
        onClose={onClose}
        aria-label="Task details"
      >
        {query.isError ? (
          <ErrorState
            title="Couldn't load this task"
            error={query.error}
            onRetry={() => query.refetch()}
            retrying={query.isFetching}
          />
        ) : (
          <LoadingRows rows={4} label="Loading task" />
        )}
      </DetailPanel>
    )
  }

  const meta = STATUS_META[task.status]
  const product = products.find((p) => p.id === task.product_id)
  const project = projects.find((p) => p.id === task.project_id)
  const executor = executors.lookup(task.executor_type, task.executor_id)
  const runHref =
    task.job_id && task.session_id && executor
      ? chatHref(executor.type, executor.id, task.session_id)
      : null

  const items: KeyValueItem[] = [
    {
      label: 'Product',
      value: (
        <span className="flex flex-col gap-0.5">
          <span>{product?.name ?? task.product_id}</span>
          {product?.purpose ? (
            <span className="text-xs text-fg-3">{product.purpose}</span>
          ) : null}
        </span>
      )
    },
    {
      label: 'Project',
      value: task.project_id ? (
        <span className="flex flex-col gap-0.5">
          <span>{project?.name ?? task.project_id}</span>
          {project?.outcome ? (
            <span className="text-xs text-fg-3">
              Expected outcome: {project.outcome}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="text-fg-3">None</span>
      )
    },
    {
      label: 'Assigned to',
      value: executor ? (
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <ExecutorIcon type={executor.type} className="text-fg-3" />
            {executor.name}
            <Badge>{executorKindLabel(executor.type)}</Badge>
          </span>
          {executor.caption ? (
            <span className="text-xs text-fg-3">{executor.caption}</span>
          ) : null}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-fg-3">
          <ExecutorIcon type={null} />
          Unassigned
        </span>
      )
    }
  ]
  if (runHref) {
    items.push({
      label: 'Run',
      value: (
        <Link
          href={runHref}
          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
        >
          Open chat
          <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      )
    })
  }
  if (task.origin && task.origin !== 'human') {
    items.push({
      label: 'Origin',
      value: task.origin === 'routine' ? 'Proposed by a routine' : task.origin
    })
  }
  items.push(
    {
      label: 'Created',
      value: (
        <>
          {formatDateTime(task.created_at)}{' '}
          <span className="text-fg-3">
            · <RelativeTime value={task.created_at} />
          </span>
        </>
      )
    },
    {
      label: 'Updated',
      value: <RelativeTime value={task.updated_at} fallback="Never" />
    },
    {
      label: 'Task ID',
      value: (
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-mono text-[12.5px]">{task.id}</span>
          <CopyButton
            value={task.id}
            aria-label="Copy task ID"
            successMessage="Task ID copied"
          />
        </span>
      )
    }
  )

  return (
    <DetailPanel
      title={task.title}
      subtitle={
        <>
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          {project ? (
            <Chip className="h-6 text-xs">
              <Folder aria-hidden />
              <span className="truncate">{project.name}</span>
            </Chip>
          ) : null}
        </>
      }
      backLabel="All tasks"
      onClose={onClose}
      aria-label="Task details"
    >
      <Progress task={task} />
      <TaskActions
        key={`${task.id}:${task.status}:${task.updated_at ?? ''}`}
        task={task}
        executors={executors}
      />
      <section className="flex flex-col gap-1.5" aria-labelledby="task-brief">
        <h3 id="task-brief" className="text-[13px] font-medium text-fg-3">
          Brief
        </h3>
        {task.brief ? (
          <Markdown content={task.brief} className="text-[13.5px] text-fg-2" />
        ) : (
          <p className="text-[13.5px] text-fg-3">No brief yet.</p>
        )}
      </section>
      <hr className="border-line" />
      <KeyValueList items={items} />
    </DetailPanel>
  )
}
