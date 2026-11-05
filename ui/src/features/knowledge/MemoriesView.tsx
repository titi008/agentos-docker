'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { Brain, Plus } from 'lucide-react'
import { parseAsString, useQueryStates } from 'nuqs'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'
import { Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { DetailPanel } from '@/components/ui/detail-panel'
import { SearchInput } from '@/components/ui/input'
import { PageBody, SplitLayout, SplitMain } from '@/components/ui/page'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Skeleton
} from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { cn } from '@/lib/utils'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import {
  MemoryEditor,
  mergeTopics,
  type MemoryDraft,
  type MemoryDraftPatch
} from './MemoryEditor'
import { KNOWLEDGE_KEY, readPage, useComponentNames } from './queries'
import {
  FilterChip,
  KnowledgeHeader,
  Pager,
  RefreshButton,
  UserScopeBar,
  clip,
  pluralize
} from './shared'
import type { Memory, PageResult } from './types'

const PAGE_SIZE = 25

const EDITOR_PARAMS = { memory: parseAsString, new: parseAsString }

const sameTopics = (a: string[], b: string[]) =>
  a.length === b.length && a.every((topic, index) => topic === b[index])

interface SaveInput {
  id: string | null
  memory: string
  topics: string[]
}

export function MemoriesView() {
  const api = useApi()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const names = useComponentNames()
  const ids = useId()
  const userId = api.ctx.userId

  const [params, setParams] = useQueryStates(EDITOR_PARAMS, {
    history: 'push'
  })
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<MemoryDraft | null>(null)

  const listRoot = api.key(KNOWLEDGE_KEY, 'memories')

  const memories = useQuery({
    queryKey: [...listRoot, 'list', { search, topic, page }],
    queryFn: ({ signal }): Promise<PageResult<Memory>> =>
      api
        .request<unknown>('/memories', {
          signal,
          query: {
            user_id: userId,
            search_content: search || undefined,
            topics: topic ?? undefined,
            page,
            limit: PAGE_SIZE,
            sort_by: 'updated_at',
            sort_order: 'desc'
          }
        })
        .then(readPage<Memory>),
    enabled: api.ready,
    placeholderData: keepPreviousData
  })

  const topics = useQuery({
    queryKey: [...listRoot, 'topics'],
    queryFn: ({ signal }) =>
      api
        .request<unknown>('/memory_topics', {
          signal,
          query: { user_id: userId }
        })
        .then((value) =>
          Array.isArray(value)
            ? value.filter(
                (item): item is string =>
                  typeof item === 'string' && item.trim() !== ''
              )
            : []
        ),
    enabled: api.ready
  })

  /* Editor ---------------------------------------------------------------- */

  const isNew = params.new === 'memory'
  const selectedId = isNew ? null : params.memory
  const editorKey = isNew ? 'new' : selectedId
  const items = memories.data?.items ?? []
  const listed = selectedId
    ? items.find((memory) => memory.memory_id === selectedId)
    : undefined

  // Deep links to a memory that is not on the current page.
  const single = useQuery({
    queryKey: [...listRoot, 'item', selectedId],
    queryFn: ({ signal }) =>
      api.request<Memory>(
        `/memories/${encodeURIComponent(String(selectedId))}`,
        {
          signal,
          query: { user_id: userId }
        }
      ),
    enabled: api.ready && Boolean(selectedId) && !listed && !memories.isPending
  })
  const target = listed ?? (selectedId ? single.data : undefined)

  const base = isNew
    ? { text: '', topics: [] as string[] }
    : target
      ? { text: target.memory, topics: target.topics ?? [] }
      : null
  const activeDraft = draft && draft.key === editorKey ? draft : null
  const values: MemoryDraft | null =
    activeDraft ??
    (base && editorKey ? { key: editorKey, ...base, topicInput: '' } : null)
  const dirty = Boolean(
    activeDraft &&
    base &&
    (activeDraft.text !== base.text ||
      !sameTopics(activeDraft.topics, base.topics) ||
      activeDraft.topicInput.trim())
  )
  useUnsavedChanges(dirty, 'this memory')

  const changeDraft = (patch: MemoryDraftPatch) => {
    if (values) setDraft({ ...values, ...patch })
  }

  const confirmDiscard = async () =>
    !dirty ||
    confirm({
      title: 'Leave without saving?',
      description: 'Your changes to this memory will be lost.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      tone: 'danger'
    })

  const openEditor = async (next: {
    memory: string | null
    new: string | null
  }) => {
    if (next.memory === selectedId && next.new === params.new) return
    if (!(await confirmDiscard())) return
    setDraft(null)
    void setParams(next)
  }

  const dismissEditor = () => {
    setDraft(null)
    void setParams({ memory: null, new: null }, { history: 'replace' })
  }

  const closeEditor = async () => {
    if (!(await confirmDiscard())) return
    dismissEditor()
  }

  /* Mutations ------------------------------------------------------------- */

  const save = useMutation({
    mutationFn: ({ id, memory, topics: memoryTopics }: SaveInput) => {
      const json = { memory, topics: memoryTopics, user_id: userId }
      return id
        ? api.request<Memory>(`/memories/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            json
          })
        : api.request<Memory>('/memories', { method: 'POST', json })
    },
    onSuccess: (_, input) => {
      toast.success(input.id ? 'Memory saved' : 'Memory added')
      dismissEditor()
      if (!input.id) setPage(1)
      return qc.invalidateQueries({ queryKey: listRoot })
    },
    onError: (error, input) =>
      toast.error(
        input.id ? "Couldn't save the memory" : "Couldn't add the memory",
        { description: getErrorMessage(error, api.ctx.endpoint) }
      )
  })

  const remove = useMutation({
    mutationFn: (memory: Memory) =>
      api.request(`/memories/${encodeURIComponent(memory.memory_id)}`, {
        method: 'DELETE',
        query: { user_id: userId }
      }),
    onSuccess: (_, memory) => {
      toast.success('Memory deleted')
      if (memory.memory_id === selectedId) dismissEditor()
      if (page > 1 && items.length === 1) setPage(page - 1)
      return qc.invalidateQueries({ queryKey: listRoot })
    },
    onError: (error) =>
      toast.error("Couldn't delete the memory", {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  const requestDelete = async (memory: Memory) => {
    const ok = await confirm({
      title: 'Delete memory?',
      description: (
        <>
          “{clip(memory.memory, 160)}” will be deleted. Agents will stop using
          it. This can’t be undone.
        </>
      ),
      confirmLabel: 'Delete memory',
      tone: 'danger'
    })
    if (ok) remove.mutate(memory)
  }

  const submit = () => {
    if (!values || save.isPending) return
    const text = values.text.trim()
    if (!text) return
    save.mutate({
      id: isNew ? null : selectedId,
      memory: text,
      topics: mergeTopics(values.topics, values.topicInput)
    })
  }

  /* Filters --------------------------------------------------------------- */

  const submitSearch = () => {
    const next = searchDraft.trim()
    if (next === search) {
      void memories.refetch()
      return
    }
    setSearch(next)
    setPage(1)
  }

  const chooseTopic = (next: string | null) => {
    setTopic(next)
    setPage(1)
  }

  const clearFilters = () => {
    setSearchDraft('')
    setSearch('')
    chooseTopic(null)
  }

  const topicOptions = topics.data ?? []
  const allTopics =
    topic && !topicOptions.includes(topic)
      ? [...topicOptions, topic]
      : topicOptions
  const filtered = Boolean(search || topic)
  const total = memories.data?.totalCount ?? 0

  /* Render ---------------------------------------------------------------- */

  let editor = null
  if (editorKey && values) {
    editor = (
      <MemoryEditor
        key={editorKey}
        memory={isNew ? undefined : target}
        values={values}
        onChange={changeDraft}
        dirty={dirty}
        saving={save.isPending}
        onSubmit={submit}
        onClose={() => void closeEditor()}
        userId={userId}
        source={target ? names.source(target.agent_id, target.team_id) : null}
      />
    )
  } else if (selectedId) {
    editor = (
      <DetailPanel
        title="Edit memory"
        backLabel="All memories"
        onClose={dismissEditor}
      >
        {single.isError ? (
          <ErrorState
            title="Couldn't load this memory"
            error={single.error}
            onRetry={() => void single.refetch()}
            retrying={single.isFetching}
          />
        ) : (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Loading memory…</span>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
      </DetailPanel>
    )
  }

  return (
    <>
      <KnowledgeHeader
        actions={
          <RefreshButton
            onRefresh={() => qc.refetchQueries({ queryKey: listRoot })}
          />
        }
      />
      <SplitLayout>
        <SplitMain>
          <PageBody className="gap-4">
            <UserScopeBar
              noun="memories"
              help="Memories are stored per user. Agents read them when they chat with this user."
            />

            <div className="flex flex-wrap items-center gap-2">
              <form
                role="search"
                aria-label="Search memories"
                className="flex min-w-[260px] flex-1 gap-2 md:max-w-[440px]"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitSearch()
                }}
              >
                <label htmlFor={`${ids}-q`} className="sr-only">
                  Search memory text
                </label>
                <SearchInput
                  id={`${ids}-q`}
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search memory text"
                  className="min-w-0 flex-1"
                />
                <Button
                  type="submit"
                  loading={
                    Boolean(search) &&
                    memories.isFetching &&
                    !memories.isPending
                  }
                >
                  Search
                </Button>
              </form>
              <div className="flex-1" />
              <Button
                variant="primary"
                size="sm"
                onClick={() => void openEditor({ memory: null, new: 'memory' })}
              >
                <Plus />
                Add memory
              </Button>
            </div>

            {allTopics.length ? (
              <div
                role="group"
                aria-label="Filter by topic"
                className="flex flex-wrap items-center gap-1.5"
              >
                <span className="mr-1 text-xs text-fg-3">Topics</span>
                <FilterChip
                  pressed={topic === null}
                  onClick={() => chooseTopic(null)}
                >
                  All
                </FilterChip>
                {allTopics.map((value) => (
                  <FilterChip
                    key={value}
                    pressed={topic === value}
                    onClick={() => chooseTopic(topic === value ? null : value)}
                  >
                    {value}
                  </FilterChip>
                ))}
              </div>
            ) : null}

            {memories.data && (items.length > 0 || filtered) ? (
              <p className="text-xs text-fg-3" aria-live="polite">
                {pluralize(total, 'memory', 'memories')}
                {search ? ` matching “${search}”` : ''}
                {topic ? ` in ${topic}` : ''}
              </p>
            ) : null}

            {memories.isPending ? (
              <LoadingRows rows={5} label="Loading memories" />
            ) : memories.isError && !memories.data ? (
              <ErrorState
                title="Couldn't load memories"
                error={memories.error}
                onRetry={() => void memories.refetch()}
                retrying={memories.isFetching}
              />
            ) : items.length === 0 ? (
              filtered ? (
                <EmptyState
                  title="No memories match these filters"
                  action={
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Brain />}
                  title="No memories yet"
                  description="Agents save facts and preferences about this user as they chat. You can add one yourself too."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        void openEditor({ memory: null, new: 'memory' })
                      }
                    >
                      <Plus />
                      Add memory
                    </Button>
                  }
                />
              )
            ) : (
              <>
                {memories.isError ? (
                  <ErrorState
                    compact
                    title="Couldn't refresh memories"
                    error={memories.error}
                    onRetry={() => void memories.refetch()}
                    retrying={memories.isFetching}
                  />
                ) : null}
                <ul
                  aria-label="Memories"
                  className={cn(
                    'flex flex-col gap-2.5 transition-opacity',
                    memories.isPlaceholderData && 'opacity-60'
                  )}
                >
                  {items.map((memory) => {
                    const selected = memory.memory_id === selectedId
                    const source = names.source(memory.agent_id, memory.team_id)
                    const short = clip(memory.memory, 48)
                    const deleting =
                      remove.isPending &&
                      remove.variables?.memory_id === memory.memory_id
                    return (
                      <li key={memory.memory_id}>
                        <article
                          aria-current={selected || undefined}
                          className={cn(
                            'flex flex-col gap-2.5 rounded-xl border bg-surface px-4 py-3.5',
                            selected
                              ? 'border-accent ring-1 ring-accent'
                              : 'border-line'
                          )}
                        >
                          <p className="text-sm break-words whitespace-pre-wrap text-fg">
                            {memory.memory}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {(memory.topics ?? []).map((value) => (
                              <Chip key={value}>{value}</Chip>
                            ))}
                            <span className="min-w-[180px] flex-1 text-[12.5px] text-fg-3">
                              {source ? `From ${source} · ` : ''}
                              Updated <RelativeTime value={memory.updated_at} />
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`${selected ? 'Editing' : 'Edit'} memory: ${short}`}
                                onClick={() =>
                                  void openEditor({
                                    memory: memory.memory_id,
                                    new: null
                                  })
                                }
                              >
                                {selected ? 'Editing' : 'Edit'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-bad hover:bg-bad-soft hover:text-bad"
                                aria-label={`Delete memory: ${short}`}
                                loading={deleting}
                                onClick={() => void requestDelete(memory)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </article>
                      </li>
                    )
                  })}
                </ul>
                <Pager
                  page={page}
                  totalPages={memories.data?.totalPages ?? 1}
                  onPageChange={setPage}
                  disabled={memories.isPlaceholderData}
                />
              </>
            )}
          </PageBody>
        </SplitMain>
        {editor}
      </SplitLayout>
    </>
  )
}
