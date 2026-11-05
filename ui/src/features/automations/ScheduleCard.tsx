'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  CalendarClock,
  Clock,
  Globe,
  History,
  Play,
  Users,
  Workflow
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'
import { Badge, Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/data'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import {
  describeDisabledReason,
  formatInTimezone,
  formatNextRun,
  relativeDay
} from './format'
import {
  togglePath,
  triggerPath,
  useComponentDirectory,
  useNow,
  type ComponentKind,
  type ScheduleModel
} from './model'
import { Note } from './parts'
import { patchScheduleCache, useIsTriggering, useScheduleKeys } from './queries'
import type { Schedule, ScheduleRun, ScheduleState } from './types'

const KIND_ICONS: Record<ComponentKind, typeof Bot> = {
  agent: Bot,
  team: Users,
  workflow: Workflow
}

const LONG_DESCRIPTION = 180

/** "Every day at 09:00 · 0 9 * * * · UTC"; never invents a cadence for a missing cron. */
export function ScheduleCadence({ model }: { model: ScheduleModel }) {
  const { schedule, cronText, onDemand } = model
  if (onDemand) return <span>On demand only</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span>{cronText ?? 'Custom schedule'}</span>
      <span className="font-mono text-[12.5px] text-fg-3">
        {schedule.cron_expr}
      </span>
      <span className="text-fg-3">{schedule.timezone}</span>
    </span>
  )
}

/** Who or what the schedule runs: a registered component or a raw endpoint. */
export function ScheduleExecutor({ model }: { model: ScheduleModel }) {
  const resolve = useComponentDirectory()
  const { schedule, target } = model
  if (target) {
    const component = resolve(target.kind, target.id)
    const Icon = KIND_ICONS[target.kind]
    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon aria-hidden className="size-4 shrink-0 text-fg-3" />
        <span className="sr-only">{component.kindLabel}: </span>
        {component.name}
      </span>
    )
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Globe aria-hidden className="size-4 shrink-0 text-fg-3" />
      <span className="font-mono text-[12.5px] break-all">
        {schedule.method} {schedule.endpoint}
      </span>
    </span>
  )
}

function NextRun({
  schedule,
  onDemand
}: {
  schedule: Schedule
  onDemand: boolean
}) {
  const now = useNow(30_000)
  if (!schedule.enabled) return <span>Not scheduled while paused</span>
  if (onDemand) return <span>Runs only when started manually</span>
  if (!schedule.next_run_at) return <span>Next run not scheduled yet</span>
  return (
    <span title={formatInTimezone(schedule.next_run_at, schedule.timezone)}>
      Next run {formatNextRun(schedule.next_run_at)}{' '}
      <span className="text-fg-3">
        ({relativeDay(schedule.next_run_at, now)})
      </span>
    </span>
  )
}

interface ScheduleCardProps {
  model: ScheduleModel
  selected: boolean
  onToggleHistory: () => void
}

export function ScheduleCard({
  model,
  selected,
  onToggleHistory
}: ScheduleCardProps) {
  const api = useApi()
  const qc = useQueryClient()
  const keys = useScheduleKeys()
  const router = useRouter()
  const nameId = useId()
  const labelId = useId()
  const [expanded, setExpanded] = useState(false)

  const { schedule, displayName, description, control } = model
  const { id, enabled } = schedule

  const toggle = useMutation({
    mutationFn: (enable: boolean) => {
      const path = togglePath(model, enable)
      if (!path) throw new Error("This schedule can't be changed here.")
      return api.request<ScheduleState>(path, { method: 'POST' })
    },
    onMutate: async (enable) => {
      await qc.cancelQueries({ queryKey: keys.lists })
      const lists = qc.getQueriesData({ queryKey: keys.lists })
      const detail = qc.getQueryData(keys.detail(id))
      patchScheduleCache(qc, keys, id, { enabled: enable })
      return { lists, detail }
    },
    onSuccess: (result, enable) => {
      patchScheduleCache(qc, keys, id, {
        enabled: result.enabled,
        next_run_at: result.next_run_at ?? null
      })
      toast.success(enable ? `${displayName} enabled` : `${displayName} paused`)
    },
    onError: (error, enable, snapshot) => {
      snapshot?.lists.forEach(([key, data]) => qc.setQueryData(key, data))
      if (snapshot?.detail) qc.setQueryData(keys.detail(id), snapshot.detail)
      toast.error(
        enable
          ? `Couldn't enable ${displayName}`
          : `Couldn't pause ${displayName}`,
        { description: getErrorMessage(error, api.ctx.endpoint) }
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.all })
  })

  const trigger = useMutation({
    mutationKey: keys.trigger(id),
    mutationFn: () => {
      const path = triggerPath(model)
      if (!path) throw new Error("This schedule can't be run from here.")
      // Resolves when the run ends; the history panel polls meanwhile.
      return api.request<ScheduleRun>(path, { method: 'POST' })
    },
    onMutate: () => {
      toast(`Running ${displayName}`, {
        description: 'Follow its progress in History.'
      })
    },
    onSuccess: (run) => {
      switch (run.status) {
        case 'success':
          toast.success(`${displayName} finished`)
          break
        case 'failed':
          toast.error(`${displayName} failed`, {
            description: run.error ?? undefined
          })
          break
        case 'paused':
          toast.warning(`${displayName} is waiting for approval`, {
            action: {
              label: 'Open approvals',
              onClick: () => router.push('/approvals')
            }
          })
          break
        case 'cancelled':
          toast(`${displayName} was cancelled`)
          break
        default:
          toast(`${displayName} is still running`)
      }
    },
    onError: (error) =>
      toast.error(`Couldn't run ${displayName}`, {
        description: getErrorMessage(error, api.ctx.endpoint)
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.all })
  })

  // Read from the mutation cache so a run started before a remount still shows as busy.
  const triggering = useIsTriggering(id)
  const canToggle = togglePath(model, !enabled) !== null
  const canTrigger = triggerPath(model) !== null
  const systemReason = enabled
    ? null
    : describeDisabledReason(schedule.disabled_reason)
  const longDescription =
    (description?.length ?? 0) > LONG_DESCRIPTION || description?.includes('\n')

  return (
    <Card
      aria-current={selected || undefined}
      className={cn(
        'flex flex-col gap-3 px-[18px] py-4 transition-shadow',
        selected && 'border-accent ring-1 ring-accent'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={nameId}
              className="font-mono text-[15px] font-semibold break-all"
            >
              {displayName}
            </h2>
            {enabled ? (
              <Badge tone="ok" dot>
                Enabled
              </Badge>
            ) : (
              <Badge dot>Paused</Badge>
            )}
            {model.origin ? <Chip>{model.origin}</Chip> : null}
          </div>
          {description ? (
            <div className="flex flex-col items-start gap-0.5">
              <p
                className={cn(
                  'text-[13px] break-words whitespace-pre-line text-fg-2',
                  longDescription && !expanded && 'line-clamp-2'
                )}
              >
                {description}
              </p>
              {longDescription ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                  className="text-xs font-medium text-fg-3 underline-offset-2 hover:text-fg hover:underline"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 max-md:min-h-11">
          <Switch
            checked={enabled}
            disabled={!canToggle || toggle.isPending}
            aria-busy={toggle.isPending || undefined}
            aria-labelledby={`${nameId} ${labelId}`}
            onCheckedChange={(next) => toggle.mutate(next)}
          />
          <span id={labelId} className="text-[13px] text-fg-2">
            {enabled ? 'Enabled' : 'Paused'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-fg-2">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock aria-hidden className="size-4 shrink-0 text-fg-3" />
          <ScheduleCadence model={model} />
        </span>
        <ScheduleExecutor model={model} />
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden className="size-4 shrink-0 text-fg-3" />
          <NextRun schedule={schedule} onDemand={model.onDemand} />
        </span>
      </div>

      {model.isMaintenance && !enabled ? (
        <Note tone="warn">
          Disabled by default. When enabled it runs daily and spends model
          calls.
        </Note>
      ) : null}
      {systemReason ? <Note tone="warn">{systemReason}</Note> : null}
      {model.readonlyReason ? <Note>{model.readonlyReason}</Note> : null}
      {control === 'routine' && model.onDemand && enabled ? (
        <Note>
          On-demand routines can&apos;t be paused. Run them when needed.
        </Note>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canTrigger ? (
          <Button
            size="sm"
            loading={triggering}
            disabled={!enabled}
            aria-describedby={enabled ? undefined : `${labelId}-hint`}
            onClick={() => trigger.mutate()}
          >
            {triggering ? null : <Play />}
            {triggering ? 'Running…' : 'Run now'}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={selected}
          onClick={onToggleHistory}
        >
          <History />
          History
        </Button>
        {canTrigger && !enabled ? (
          <span id={`${labelId}-hint`} className="text-xs text-fg-3">
            Enable the schedule to run it now.
          </span>
        ) : null}
      </div>
    </Card>
  )
}
