'use client'

import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { parseAsInteger, useQueryState } from 'nuqs'
import { useMemo } from 'react'

import { SECTIONS } from '@/components/shell/nav'
import { Button } from '@/components/ui/button'
import {
  PageBody,
  PageHeader,
  RouteTabs,
  SplitLayout,
  SplitMain
} from '@/components/ui/page'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/utils'

import { toScheduleModel } from './model'
import { Pager, RefreshButton } from './parts'
import {
  SCHEDULES_PAGE_SIZE,
  useScheduleKeys,
  useScheduleQuery,
  useSchedulesQuery
} from './queries'
import { RunHistoryPanel } from './RunHistoryPanel'
import { ScheduleCard } from './ScheduleCard'

const section = SECTIONS.automations

function ScheduleSkeletons() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Loading schedules…</span>
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  )
}

export function SchedulesView() {
  const qc = useQueryClient()
  const keys = useScheduleKeys()
  const [selectedId, setSelectedId] = useQueryState('schedule', {
    history: 'push'
  })
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const list = useSchedulesQuery(page)

  const models = useMemo(
    () => list.data?.items.map(toScheduleModel) ?? [],
    [list.data]
  )
  const selectedModel =
    models.find((model) => model.schedule.id === selectedId) ?? null
  // A deep link can name a schedule that isn't on the loaded page.
  const detail = useScheduleQuery(
    selectedId ?? '',
    Boolean(selectedId) && list.isSuccess && !selectedModel
  )
  const panelModel =
    selectedModel ?? (detail.data ? toScheduleModel(detail.data) : null)

  const total = list.data?.total ?? 0
  const enabledCount = models.filter((model) => model.schedule.enabled).length

  let content
  if (list.isPending) {
    content = <ScheduleSkeletons />
  } else if (list.isError) {
    content = (
      <ErrorState
        title="Couldn't load schedules"
        error={list.error}
        onRetry={() => list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (models.length === 0 && page > 1) {
    content = (
      <EmptyState
        title="This page is empty"
        description="There are fewer schedules than this page needs."
        action={
          <Button size="sm" onClick={() => setPage(null)}>
            Back to the first page
          </Button>
        }
      />
    )
  } else if (models.length === 0) {
    content = (
      <EmptyState
        icon={<CalendarClock />}
        title="No schedules yet"
        description="The declared agentos-maintenance routine appears here once Company Manager starts."
      />
    )
  } else {
    content = (
      <>
        <div className="flex flex-col gap-0.5">
          <p className="text-[13px] text-fg-2">
            {total === 1 ? '1 schedule' : `${total} schedules`}
            {total <= SCHEDULES_PAGE_SIZE ? ` · ${enabledCount} enabled` : null}
          </p>
          <p className="text-[13px] text-fg-3">
            Schedules come from code, Company routines and your agents. Pause,
            resume or run them here.
          </p>
        </div>
        <ul
          aria-label="Schedules"
          aria-busy={list.isPlaceholderData || undefined}
          className={cn(
            'flex flex-col gap-3',
            list.isPlaceholderData && 'opacity-60'
          )}
        >
          {models.map((model) => {
            const selected = model.schedule.id === selectedId
            return (
              <li key={model.schedule.id}>
                <ScheduleCard
                  model={model}
                  selected={selected}
                  onToggleHistory={() =>
                    setSelectedId(selected ? null : model.schedule.id)
                  }
                />
              </li>
            )
          })}
        </ul>
        <Pager
          label="Schedule pages"
          page={page}
          pageSize={SCHEDULES_PAGE_SIZE}
          total={total}
          onPageChange={(next) => setPage(next === 1 ? null : next)}
        />
      </>
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
      <SplitLayout>
        <SplitMain>
          <PageBody>{content}</PageBody>
        </SplitMain>
        {selectedId ? (
          <RunHistoryPanel
            key={selectedId}
            scheduleId={selectedId}
            model={panelModel}
            loading={!panelModel && (list.isPending || detail.isLoading)}
            error={detail.error ?? list.error}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </SplitLayout>
    </>
  )
}
