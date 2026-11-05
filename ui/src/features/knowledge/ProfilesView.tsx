'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { SearchInput } from '@/components/ui/input'
import { PageBody, PageScroll } from '@/components/ui/page'
import { SegmentedControl } from '@/components/ui/segmented'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/states'
import { cn } from '@/lib/utils'

import { LearningCard, learningTypeLabel } from './LearningCard'
import { KNOWLEDGE_KEY, readPage, useComponentNames } from './queries'
import {
  KnowledgeHeader,
  Pager,
  RefreshButton,
  UserScopeBar,
  pluralize
} from './shared'
import type { Learning, PageResult } from './types'

/** Learnings per page; the router allows up to 1000. */
const PAGE_SIZE = 100
const ALL = '__all__'

export function ProfilesView() {
  const api = useApi()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const names = useComponentNames()
  const searchId = useId()
  const userId = api.ctx.userId

  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [search, setSearch] = useState('')

  const listRoot = api.key(KNOWLEDGE_KEY, 'learnings')
  const learnings = useQuery({
    queryKey: [...listRoot, page],
    queryFn: ({ signal }): Promise<PageResult<Learning>> =>
      api
        .request<unknown>('/learnings', {
          signal,
          query: { user_id: userId, page, limit: PAGE_SIZE }
        })
        .then(readPage<Learning>),
    enabled: api.ready,
    placeholderData: keepPreviousData
  })

  const items = learnings.data?.items ?? []

  const remove = useMutation({
    mutationFn: (learning: Learning) =>
      api.request(`/learnings/${encodeURIComponent(learning.learning_id)}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      toast.success('Learned profile deleted')
      if (page > 1 && items.length === 1) setPage(page - 1)
      return qc.invalidateQueries({ queryKey: listRoot })
    },
    onError: (error) =>
      toast.error("Couldn't delete the learned profile", {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  const counts = new Map<string, number>()
  for (const learning of items) {
    counts.set(
      learning.learning_type,
      (counts.get(learning.learning_type) ?? 0) + 1
    )
  }
  const types = [...counts.keys()].sort((a, b) =>
    learningTypeLabel(a).localeCompare(learningTypeLabel(b))
  )
  const activeType = types.includes(typeFilter) ? typeFilter : ALL
  const needle = search.trim().toLowerCase()

  const visible = items.filter((learning) => {
    if (activeType !== ALL && learning.learning_type !== activeType)
      return false
    if (!needle) return true
    const source = names.source(learning.agent_id, learning.team_id)
    return [
      learningTypeLabel(learning.learning_type),
      learning.entity_type,
      learning.entity_id,
      learning.namespace,
      learning.agent_id,
      learning.team_id,
      source,
      JSON.stringify(learning.content ?? {})
    ].some((value) => value?.toLowerCase().includes(needle))
  })

  const requestDelete = async (learning: Learning, heading: string) => {
    const ok = await confirm({
      title: 'Delete learned profile?',
      description: `“${heading}” will be deleted. Agents will no longer use it in chats. This can’t be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    })
    if (ok) remove.mutate(learning)
  }

  const filtered = Boolean(needle) || activeType !== ALL
  const totalPages = learnings.data?.totalPages ?? 1

  return (
    <>
      <KnowledgeHeader
        actions={
          <RefreshButton
            onRefresh={() => qc.refetchQueries({ queryKey: listRoot })}
          />
        }
      />
      <PageScroll>
        <PageBody className="gap-4">
          <UserScopeBar
            noun="learned profiles"
            help="Agents capture these facts during chats. Delete anything that is wrong or out of date."
          />

          {items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                aria-label="Filter by learning type"
                value={activeType}
                onChange={setTypeFilter}
                options={[
                  { value: ALL, label: 'All', count: items.length },
                  ...types.map((type) => ({
                    value: type,
                    label: learningTypeLabel(type),
                    count: counts.get(type)
                  }))
                ]}
              />
              <div className="flex-1" />
              <label htmlFor={searchId} className="sr-only">
                Search learned profiles
              </label>
              <SearchInput
                id={searchId}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search facts, entities or agents"
                className="w-[280px] max-w-full"
              />
            </div>
          ) : null}

          {learnings.isPending ? (
            <LoadingRows rows={4} label="Loading learned profiles" />
          ) : learnings.isError && !learnings.data ? (
            <ErrorState
              title="Couldn't load learned profiles"
              error={learnings.error}
              onRetry={() => void learnings.refetch()}
              retrying={learnings.isFetching}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<BookOpen />}
              title="Nothing learned yet"
              description="As you chat with agents that have learning enabled, the profiles, entities and facts they capture about this user appear here."
            />
          ) : (
            <>
              {learnings.isError ? (
                <ErrorState
                  compact
                  title="Couldn't refresh learned profiles"
                  error={learnings.error}
                  onRetry={() => void learnings.refetch()}
                  retrying={learnings.isFetching}
                />
              ) : null}
              {filtered || totalPages > 1 ? (
                <p className="text-xs text-fg-3" aria-live="polite">
                  {filtered
                    ? `${pluralize(visible.length, 'result')} of ${pluralize(items.length, 'record')}`
                    : pluralize(
                        learnings.data?.totalCount ?? items.length,
                        'record'
                      )}
                  {totalPages > 1 ? ' · Filters apply to this page.' : ''}
                </p>
              ) : null}
              {visible.length === 0 ? (
                <EmptyState
                  title="No learned profiles match"
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setTypeFilter(ALL)
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <div
                  className={cn(
                    'grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] items-start gap-4 transition-opacity',
                    learnings.isPlaceholderData && 'opacity-60'
                  )}
                >
                  {visible.map((learning) => (
                    <LearningCard
                      key={learning.learning_id}
                      learning={learning}
                      source={names.source(learning.agent_id, learning.team_id)}
                      deleting={
                        remove.isPending &&
                        remove.variables?.learning_id === learning.learning_id
                      }
                      onDelete={(heading) =>
                        void requestDelete(learning, heading)
                      }
                    />
                  ))}
                </div>
              )}
              <Pager
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                disabled={learnings.isPlaceholderData}
              />
            </>
          )}
        </PageBody>
      </PageScroll>
    </>
  )
}
