'use client'

import { ChevronRight, ExternalLink, History } from 'lucide-react'
import Link from 'next/link'
import { useId, useState } from 'react'

import { chatHref } from '@/components/shell/nav'
import { Button } from '@/components/ui/button'
import { CodeBlock, CopyButton, formatJson } from '@/components/ui/code'
import { KeyValueList, type KeyValueItem } from '@/components/ui/data'
import { DetailPanel } from '@/components/ui/detail-panel'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/states'
import { formatDuration } from '@/lib/time'
import { cn } from '@/lib/utils'

import { durationMs, formatFinished, formatPrecise, shortId } from './format'
import {
  useComponentDirectory,
  useNow,
  type ResolvedComponent,
  type ScheduleModel
} from './model'
import { ErrorText, Pager, StatusBadge } from './parts'
import { ScheduleCadence } from './ScheduleCard'
import { RUNS_PAGE_SIZE, useScheduleRunsQuery } from './queries'
import type { ScheduleRun } from './types'

function RunningFor({ since }: { since: ScheduleRun['triggered_at'] }) {
  const now = useNow(1_000)
  return <>running for {formatDuration(durationMs(since, now))}</>
}

function RunItem({
  run,
  target
}: {
  run: ScheduleRun
  target: ResolvedComponent | null
}) {
  const [showOutput, setShowOutput] = useState(false)
  const running = run.status === 'running'
  const took = durationMs(run.triggered_at, run.completed_at)
  const hasOutput =
    run.output !== null &&
    run.output !== undefined &&
    Object.keys(run.output).length > 0
  const waitingForApproval =
    run.status === 'paused' && (run.requirements?.length ?? 0) > 0

  return (
    <li className="flex flex-col gap-2 border-b border-line px-5 py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <StatusBadge status={run.status} />
        <span className="text-[13px] font-medium">Attempt {run.attempt}</span>
        <span className="text-[13px] text-fg-3">
          {running ? (
            <RunningFor since={run.triggered_at} />
          ) : took !== null ? (
            `took ${formatDuration(took)}`
          ) : null}
        </span>
        {run.status_code && run.status !== 'success' ? (
          <span className="font-mono text-xs text-fg-3">
            HTTP {run.status_code}
          </span>
        ) : null}
      </div>
      <span className="text-xs text-fg-3">
        Triggered {formatPrecise(run.triggered_at ?? run.created_at)}
        {run.completed_at
          ? ` · finished ${formatFinished(run.triggered_at, run.completed_at)}`
          : null}
      </span>
      {run.error ? <ErrorText text={run.error} /> : null}
      {waitingForApproval ? (
        <p className="text-[13px] text-fg-2">
          Waiting for approval.{' '}
          <Link
            href="/approvals"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Open approvals
          </Link>
        </p>
      ) : null}
      {hasOutput || run.session_id ? (
        <div className="flex flex-wrap items-center gap-2">
          {hasOutput ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2.5"
              aria-expanded={showOutput}
              onClick={() => setShowOutput((value) => !value)}
            >
              <ChevronRight
                className={cn(
                  'transition-transform',
                  showOutput && 'rotate-90'
                )}
              />
              Output
            </Button>
          ) : null}
          {run.session_id && target?.known && target.kind ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={chatHref(target.kind, target.id, run.session_id)}>
                <ExternalLink />
                Open session
              </Link>
            </Button>
          ) : run.session_id ? (
            <span className="text-xs text-fg-3">
              Session{' '}
              <span className="font-mono" title={run.session_id}>
                {shortId(run.session_id)}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      {hasOutput && showOutput ? (
        <CodeBlock
          code={formatJson(run.output)}
          label="Output"
          maxHeight="20rem"
        />
      ) : null}
    </li>
  )
}

function ScheduleDetails({
  model,
  target
}: {
  model: ScheduleModel
  target: ResolvedComponent | null
}) {
  const [open, setOpen] = useState(false)
  const { schedule } = model
  const rows: (KeyValueItem | null)[] = [
    { label: 'Schedule', value: <ScheduleCadence model={model} /> },
    target
      ? {
          label: 'Executor',
          value: (
            <span>
              {target.name}{' '}
              <span className="text-fg-3">
                {target.kindLabel} ·{' '}
                <span className="font-mono text-[12.5px]">{target.id}</span>
              </span>
            </span>
          )
        }
      : null,
    {
      label: 'Endpoint',
      value: (
        <span className="font-mono text-[12.5px] break-all">
          {schedule.method} {schedule.endpoint}
        </span>
      )
    },
    model.productId
      ? {
          label: 'Product',
          value: (
            <span className="font-mono text-[12.5px]">{model.productId}</span>
          )
        }
      : null,
    schedule.max_retries !== undefined
      ? {
          label: 'Retries',
          value:
            schedule.max_retries === 0
              ? 'None'
              : `${schedule.max_retries} after ${formatDuration((schedule.retry_delay_seconds ?? 0) * 1000)}`
        }
      : null,
    schedule.timeout_seconds
      ? {
          label: 'Timeout',
          value: formatDuration(schedule.timeout_seconds * 1000)
        }
      : null,
    {
      label: 'Schedule ID',
      value: (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-[12.5px] break-all">
            {schedule.id}
          </span>
          <CopyButton
            value={schedule.id}
            aria-label="Copy schedule ID"
            successMessage="Schedule ID copied"
          />
        </span>
      )
    }
  ]
  const items = rows.filter((item): item is KeyValueItem => item !== null)

  return (
    <section className="flex flex-col gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5 self-start"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRight
          className={cn('transition-transform', open && 'rotate-90')}
        />
        Schedule details
      </Button>
      {open ? <KeyValueList items={items} /> : null}
    </section>
  )
}

function RunList({
  scheduleId,
  target
}: {
  scheduleId: string
  target: ResolvedComponent | null
}) {
  const [page, setPage] = useState(1)
  const titleId = useId()
  const runs = useScheduleRunsQuery(scheduleId, page)

  if (runs.isPending) return <LoadingRows rows={4} label="Loading runs" />
  if (runs.isError) {
    return (
      <ErrorState
        title="Couldn't load the run history"
        error={runs.error}
        onRetry={() => runs.refetch()}
        retrying={runs.isFetching}
        compact
      />
    )
  }

  const { items, total } = runs.data
  if (items.length === 0) {
    return page > 1 ? (
      <EmptyState
        title="This page is empty"
        description="There are fewer runs than this page needs."
        action={
          <Button size="sm" onClick={() => setPage(1)}>
            Back to the latest runs
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<History />}
        title="No runs yet"
        description="Runs appear here after the schedule fires or you run it now."
      />
    )
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h3 id={titleId} className="text-[13px] font-semibold">
        Runs
      </h3>
      <ol
        aria-busy={runs.isPlaceholderData || undefined}
        className={cn(
          '-mx-5 border-y border-line',
          runs.isPlaceholderData && 'opacity-60'
        )}
      >
        {items.map((run) => (
          <RunItem key={run.id} run={run} target={target} />
        ))}
      </ol>
      <Pager
        label="Run history pages"
        page={page}
        pageSize={RUNS_PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
    </section>
  )
}

interface RunHistoryPanelProps {
  scheduleId: string
  /** Null while the schedule loads or when it can't be found. */
  model: ScheduleModel | null
  loading: boolean
  error: unknown
  onClose: () => void
}

/**
 * Run history of one schedule. Mount it with `key={scheduleId}` so paging
 * and expanded rows reset, and no runs of the previous schedule linger.
 */
export function RunHistoryPanel({
  scheduleId,
  model,
  loading,
  error,
  onClose
}: RunHistoryPanelProps) {
  const resolve = useComponentDirectory()
  const target = model?.target
    ? resolve(model.target.kind, model.target.id)
    : null

  return (
    <DetailPanel
      aria-label={
        model ? `Run history for ${model.displayName}` : 'Run history'
      }
      backLabel="All schedules"
      onClose={onClose}
      title={
        model ? (
          <span className="font-mono">{model.displayName}</span>
        ) : (
          'Run history'
        )
      }
      subtitle={
        model ? (
          <>
            <span>Run history</span>
            <span aria-hidden>·</span>
            <span>
              {model.onDemand
                ? 'On demand only'
                : `${model.cronText ?? model.schedule.cron_expr} ${model.schedule.timezone}`}
            </span>
            {target ? (
              <>
                <span aria-hidden>·</span>
                <span>{target.name}</span>
              </>
            ) : null}
          </>
        ) : undefined
      }
    >
      {model ? (
        <>
          <ScheduleDetails model={model} target={target} />
          <RunList scheduleId={scheduleId} target={target} />
        </>
      ) : loading ? (
        <LoadingRows rows={4} label="Loading schedule" />
      ) : (
        <ErrorState title="Couldn't load this schedule" error={error} compact />
      )}
    </DetailPanel>
  )
}
