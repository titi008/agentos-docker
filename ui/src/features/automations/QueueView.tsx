'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers, LockKeyhole, RotateCcw, SearchX } from 'lucide-react'
import Link from 'next/link'
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState
} from 'nuqs'
import { useMemo } from 'react'
import { toast } from 'sonner'

import {
  ApiError,
  getErrorMessage,
  isForbiddenError,
  useApi
} from '@/api/client'
import { chatHref, SECTIONS } from '@/components/shell/nav'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/code'
import { useConfirm } from '@/components/ui/confirm'
import { Card, Table, TableWrap, Td, Th, Tr } from '@/components/ui/data'
import { SearchInput, Select } from '@/components/ui/input'
import {
  PageBody,
  PageHeader,
  PageScroll,
  RouteTabs
} from '@/components/ui/page'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Skeleton
} from '@/components/ui/states'
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  toDate
} from '@/lib/time'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'

import { formatStamp, shortId } from './format'
import { useComponentDirectory, type ResolvedComponent } from './model'
import { ErrorText, Pager, RefreshButton, StatusBadge } from './parts'
import {
  JOBS_PAGE_SIZE,
  JOBS_SEARCH_LIMIT,
  QUEUE_REQUEST,
  useQueueJobsQuery,
  useQueueKeys,
  useQueueStatsQuery
} from './queries'
import { JOB_STATUSES, type JobStatus, type QueueJob } from './types'

const section = SECTIONS.automations

const STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

/** Stat cards that double as filters; Paused and Cancelled are in the status menu. */
const STAT_FILTERS: {
  status: JobStatus | null
  label: string
  dot?: string
}[] = [
  { status: null, label: 'All jobs' },
  { status: 'queued', label: 'Queued', dot: 'text-fg-3' },
  { status: 'running', label: 'Running', dot: 'text-info' },
  { status: 'completed', label: 'Completed', dot: 'text-ok' },
  { status: 'failed', label: 'Failed · dead-letter', dot: 'text-bad' }
]

const COLUMN_COUNT = 9

function Timestamp({ value }: { value: number | null | undefined }) {
  const date = toDate(value)
  if (!date) return <span className="text-fg-3">—</span>
  return (
    <time
      dateTime={date.toISOString()}
      title={formatDateTime(value)}
      className="text-fg-2"
    >
      {formatStamp(value)}
    </time>
  )
}

function SessionCell({
  sessionId,
  component
}: {
  sessionId: string
  component: ResolvedComponent
}) {
  if (!sessionId) return <span className="text-fg-3">—</span>
  const short = shortId(sessionId)
  if (component.known && component.kind) {
    return (
      <Link
        href={chatHref(component.kind, component.id, sessionId)}
        title={sessionId}
        aria-label={`Open session ${short} in chat`}
        className="font-mono text-[12.5px] text-accent underline-offset-2 hover:underline"
      >
        {short}
      </Link>
    )
  }
  return (
    <span title={sessionId} className="font-mono text-[12.5px] text-fg-2">
      {short}
    </span>
  )
}

function JobRows({
  job,
  component
}: {
  job: QueueJob
  component: ResolvedComponent
}) {
  const api = useApi()
  const qc = useQueryClient()
  const keys = useQueueKeys()
  const confirm = useConfirm()
  const short = shortId(job.id)

  const requeue = useMutation({
    mutationFn: async () => {
      const path = `/queue/jobs/${encodeURIComponent(job.id)}/requeue`
      try {
        return await api.request<QueueJob>(path, {
          ...QUEUE_REQUEST,
          method: 'POST'
        })
      } catch (error) {
        // 409: it failed within the lock grace, so its worker may still be running.
        if (!(error instanceof ApiError) || error.status !== 409) throw error
        const confirmed = await confirm({
          title: 'Requeue this job anyway?',
          description:
            'It failed moments ago and its worker may still be running, so requeuing now can run the same work twice. Waiting a minute is safer.',
          confirmLabel: 'Requeue anyway',
          tone: 'danger'
        })
        if (!confirmed) return null
        return api.request<QueueJob>(path, {
          ...QUEUE_REQUEST,
          method: 'POST',
          query: { force: true }
        })
      }
    },
    onSuccess: (result) => {
      if (result) toast.success('Job requeued')
    },
    onError: (error) =>
      toast.error("Couldn't requeue the job", {
        description: getErrorMessage(error, api.ctx.endpoint)
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.all })
  })

  const error = job.error?.trim()

  return (
    <tbody className="border-b border-line transition-colors last:border-b-0 hover:bg-hover">
      <Tr className="hover:bg-transparent">
        <Td className={cn('border-b-0', error && 'pb-1.5')}>
          <StatusBadge status={job.status} />
        </Td>
        <Td className={cn('border-b-0', error && 'pb-1.5')}>
          <span className="inline-flex items-center gap-0.5">
            <span title={job.id} className="font-mono text-[12.5px]">
              {short}
            </span>
            <CopyButton
              value={job.id}
              aria-label={`Copy job ID ${short}`}
              successMessage="Job ID copied"
            />
          </span>
        </Td>
        <Td className={cn('border-b-0', error && 'pb-1.5')}>
          <div className="flex min-w-0 flex-col">
            <span
              className={cn(
                'truncate',
                component.name === component.id && 'font-mono text-[12.5px]'
              )}
              title={component.id}
            >
              {component.name}
            </span>
            {component.kindLabel ? (
              <span className="text-xs text-fg-3">{component.kindLabel}</span>
            ) : null}
          </div>
        </Td>
        <Td className={cn('border-b-0', error && 'pb-1.5')}>
          <span className="font-mono text-[12.5px]">{job.job_type}</span>
        </Td>
        <Td className={cn('border-b-0', error && 'pb-1.5')}>
          <SessionCell sessionId={job.session_id} component={component} />
        </Td>
        <Td
          className={cn(
            'border-b-0 whitespace-nowrap tabular-nums',
            error && 'pb-1.5'
          )}
        >
          {job.attempt} / {job.max_attempts}
        </Td>
        <Td className={cn('border-b-0 whitespace-nowrap', error && 'pb-1.5')}>
          <Timestamp value={job.created_at} />
        </Td>
        <Td className={cn('border-b-0 whitespace-nowrap', error && 'pb-1.5')}>
          <Timestamp value={job.completed_at} />
        </Td>
        <Td className={cn('border-b-0 text-right', error && 'pb-1.5')}>
          {job.status === 'failed' ? (
            <Button
              size="sm"
              loading={requeue.isPending}
              aria-label={`Requeue job ${short}`}
              onClick={() => requeue.mutate()}
            >
              {requeue.isPending ? null : <RotateCcw />}
              Requeue
            </Button>
          ) : null}
        </Td>
      </Tr>
      {error ? (
        <Tr className="hover:bg-transparent">
          <Td colSpan={COLUMN_COUNT} className="border-b-0 pt-0">
            <ErrorText text={error} variant="inline" />
          </Td>
        </Tr>
      ) : null}
    </tbody>
  )
}

function StatFilter({
  label,
  dot,
  value,
  hint,
  active,
  loading,
  className,
  onSelect
}: {
  label: string
  dot?: string
  value: number | null
  hint?: string | null
  active: boolean
  loading: boolean
  className?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        'flex min-w-0 flex-col items-start gap-0.5 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-hover',
        active && 'border-accent ring-1 ring-accent',
        className
      )}
    >
      <span className="flex items-center gap-[7px] text-[13px] text-fg-2">
        {dot ? (
          <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full bg-current', dot)}
          />
        ) : null}
        {label}
      </span>
      {loading ? (
        <Skeleton className="my-1 h-6 w-12" />
      ) : (
        <span className="text-[22px] leading-[1.3] font-semibold tracking-[-0.01em] tabular-nums">
          {value === null ? '—' : formatNumber(value)}
        </span>
      )}
      {hint ? <span className="text-xs text-fg-3">{hint}</span> : null}
    </button>
  )
}

/** Agno serves the whole queue API to admin tokens only, so a 403 replaces the page. */
function AdminRequired() {
  const signIn = useStore((state) => state.signIn)

  if (signIn) {
    return (
      <EmptyState
        icon={<LockKeyhole />}
        title="The job queue is for admins"
        description="Only admins can see and requeue background jobs. Admins are listed in AGENTOS_ADMIN_EMAILS on the UI server."
      />
    )
  }

  return (
    <EmptyState
      icon={<LockKeyhole />}
      title="The job queue needs admin access"
      description={
        <>
          AgentOS only lets tokens with the admin scope (
          <code className="font-mono text-[12px] text-fg-2">
            agent_os:admin
          </code>
          ) see and requeue background jobs. Your current token is valid but
          doesn&apos;t include it.
        </>
      }
      action={
        <Button size="sm" asChild>
          <Link href="/settings">Change auth token</Link>
        </Button>
      }
    />
  )
}

export function QueueView() {
  const qc = useQueryClient()
  const keys = useQueueKeys()
  const resolve = useComponentDirectory()
  const [status, setStatus] = useQueryState(
    'status',
    parseAsStringLiteral(JOB_STATUSES)
  )
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''))
  const search = query.trim().toLowerCase()

  const stats = useQueueStatsQuery()
  const jobs = useQueueJobsQuery({ status, page, search: Boolean(search) })

  const matches = useMemo(() => {
    const items = jobs.data?.items ?? []
    if (!search) return items
    return items.filter((job) =>
      [
        job.id,
        job.component_id,
        job.component_type,
        resolve(job.component_type, job.component_id).name,
        job.job_type,
        job.session_id,
        job.user_id
      ].some((value) => value?.toLowerCase().includes(search))
    )
  }, [jobs.data, search, resolve])

  const total = search ? matches.length : (jobs.data?.total ?? 0)
  const rows = search
    ? matches.slice((page - 1) * JOBS_PAGE_SIZE, page * JOBS_PAGE_SIZE)
    : matches

  const counts = stats.data?.counts
  const allCount = counts
    ? Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0)
    : null
  const oldestQueued = stats.data?.oldest_queued_age_seconds
  const queueOff = jobs.error instanceof ApiError && jobs.error.status === 503
  const forbidden =
    isForbiddenError(jobs.error) || isForbiddenError(stats.error)

  const filterBy = (next: JobStatus | null) => {
    void setStatus(next)
    void setPage(null)
  }

  let content
  if (jobs.isPending) {
    content = <LoadingRows rows={6} label="Loading jobs" />
  } else if (jobs.isError) {
    content = (
      <ErrorState
        title="Couldn't load jobs"
        error={jobs.error}
        onRetry={() => jobs.refetch()}
        retrying={jobs.isFetching}
      />
    )
  } else if (rows.length === 0) {
    if (page > 1 && total > 0) {
      content = (
        <EmptyState
          title="This page is empty"
          description="There are fewer jobs than this page needs."
          action={
            <Button size="sm" onClick={() => void setPage(null)}>
              Back to the first page
            </Button>
          }
        />
      )
    } else if (search) {
      content = (
        <EmptyState
          icon={<SearchX />}
          title={`No jobs match “${query.trim()}”`}
          description="Search looks at job IDs, components, job types and sessions."
          action={
            <Button size="sm" onClick={() => void setQuery(null)}>
              Clear search
            </Button>
          }
        />
      )
    } else if (status) {
      content = (
        <EmptyState
          icon={<Layers />}
          title={`No ${STATUS_LABELS[status].toLowerCase()} jobs`}
          description="Jobs with this status appear here."
          action={
            <Button size="sm" onClick={() => filterBy(null)}>
              Show all jobs
            </Button>
          }
        />
      )
    } else {
      content = (
        <EmptyState
          icon={<Layers />}
          title="The queue is clear."
          description="Background jobs appear here while they run."
        />
      )
    }
  } else {
    content = (
      <Card className="overflow-hidden">
        <TableWrap className="rounded-none border-0">
          <Table
            aria-label="Background jobs"
            aria-busy={jobs.isPlaceholderData || undefined}
            className={cn(jobs.isPlaceholderData && 'opacity-60')}
          >
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Job ID</Th>
                <Th>Component</Th>
                <Th>Job type</Th>
                <Th>Session</Th>
                <Th>Attempts</Th>
                <Th>Created</Th>
                <Th>Finished</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            {rows.map((job) => (
              <JobRows
                key={job.id}
                job={job}
                component={resolve(job.component_type, job.component_id)}
              />
            ))}
          </Table>
        </TableWrap>
        <Pager
          label="Job pages"
          className="border-t border-line px-4 py-2.5"
          page={page}
          pageSize={JOBS_PAGE_SIZE}
          total={total}
          onPageChange={(next) => void setPage(next === 1 ? null : next)}
        />
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title={section.title}
        description={section.description}
        actions={
          <RefreshButton
            onRefresh={() => qc.invalidateQueries({ queryKey: keys.all })}
          />
        }
      />
      <RouteTabs tabs={section.tabs} aria-label="Automations sections" />
      <PageScroll>
        <PageBody>
          {queueOff ? (
            <EmptyState
              icon={<Layers />}
              title="The durable job queue isn't enabled"
              description={
                jobs.error instanceof ApiError && jobs.error.detail
                  ? jobs.error.detail
                  : 'This AgentOS runs background work without the durable queue.'
              }
            />
          ) : forbidden ? (
            <AdminRequired />
          ) : (
            <>
              {stats.isError ? (
                <ErrorState
                  title="Couldn't load queue stats"
                  error={stats.error}
                  onRetry={() => stats.refetch()}
                  retrying={stats.isFetching}
                  compact
                />
              ) : null}
              <div
                role="group"
                aria-label="Filter jobs by status"
                className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
              >
                {STAT_FILTERS.map((filter) => (
                  <StatFilter
                    key={filter.label}
                    label={filter.label}
                    dot={filter.dot}
                    value={
                      filter.status === null
                        ? allCount
                        : counts
                          ? (counts[filter.status] ?? 0)
                          : null
                    }
                    hint={
                      filter.status === 'queued' &&
                      oldestQueued &&
                      (counts?.queued ?? 0) > 0
                        ? `Oldest waiting ${formatDuration(oldestQueued * 1000)}`
                        : null
                    }
                    active={status === filter.status}
                    loading={stats.isPending}
                    className={
                      filter.status === null ? 'max-md:col-span-2' : undefined
                    }
                    onSelect={() => filterBy(filter.status)}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <label htmlFor="job-search" className="sr-only">
                  Search jobs
                </label>
                <SearchInput
                  id="job-search"
                  className="min-w-0 flex-[1_1_280px] md:max-w-[420px]"
                  placeholder="Search by job ID, component or session"
                  value={query}
                  onChange={(event) => {
                    void setQuery(event.target.value || null)
                    void setPage(null)
                  }}
                />
                <label htmlFor="job-status" className="sr-only">
                  Status
                </label>
                <Select
                  id="job-status"
                  className="w-full sm:w-44"
                  value={status ?? ''}
                  onChange={(event) =>
                    filterBy(
                      (JOB_STATUSES as readonly string[]).includes(
                        event.target.value
                      )
                        ? (event.target.value as JobStatus)
                        : null
                    )
                  }
                >
                  <option value="">All statuses</option>
                  {JOB_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
                <span className="text-xs text-fg-3">
                  Durable queue · finished jobs are kept for 24 hours by default
                </span>
              </div>
              {search && jobs.data && jobs.data.total > JOBS_SEARCH_LIMIT ? (
                <p className="text-xs text-fg-3">
                  Search covers the {formatNumber(JOBS_SEARCH_LIMIT)} most
                  recent jobs
                  {status
                    ? ` with status ${STATUS_LABELS[status].toLowerCase()}`
                    : ''}
                  .
                </p>
              ) : null}

              {content}
            </>
          )}
        </PageBody>
      </PageScroll>
    </>
  )
}
