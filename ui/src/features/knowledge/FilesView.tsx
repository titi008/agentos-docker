'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { FileText, FolderOpen } from 'lucide-react'
import { parseAsString, useQueryStates } from 'nuqs'
import { useId, useState } from 'react'

import { useApi } from '@/api/client'
import { Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput, Select } from '@/components/ui/input'
import { PageBody, SplitLayout, SplitMain } from '@/components/ui/page'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { formatBytes } from '@/lib/time'
import { cn } from '@/lib/utils'

import { FilePreview, type FileTarget } from './FilePreview'
import {
  KNOWLEDGE_KEY,
  readPage,
  useComponentNames,
  useOsConfigQuery
} from './queries'
import {
  Highlight,
  KnowledgeHeader,
  Pager,
  RefreshButton,
  pluralize
} from './shared'
import type { FileEntry, FileListResponse } from './types'

const BROWSE_PAGE_SIZE = 50
/** Largest page the filesystem router serves. */
const MAX_PAGE_SIZE = 100
/** Pages read per request when searching (path matching is done here). */
const MAX_SEARCH_PAGES = 10
const MAX_QUERY_LENGTH = 200

interface FileRow extends FileEntry {
  /** Found by its path only; the contents did not match. */
  pathOnly: boolean
}

interface FileListResult {
  rows: FileRow[]
  totalCount: number
  totalPages: number
  /** The search stopped before reading every file. */
  truncated: boolean
}

interface FileFilters {
  namespace?: string
  agent_id?: string
}

type Request = ReturnType<typeof useApi>['request']

const fileKey = (entry: Pick<FileEntry, 'namespace' | 'path' | 'user_id'>) =>
  [entry.namespace, entry.user_id ?? '', entry.path].join('\u0000')

async function readAllFiles(
  request: Request,
  query: FileFilters & { query?: string },
  signal: AbortSignal
): Promise<{ entries: FileEntry[]; truncated: boolean }> {
  const entries: FileEntry[] = []
  let page = 1
  let totalPages = 1
  do {
    const response = await request<FileListResponse>('/filesystem/files', {
      signal,
      query: { ...query, page, limit: MAX_PAGE_SIZE }
    })
    entries.push(...(response.entries ?? []))
    totalPages = response.meta?.total_pages ?? 1
    page += 1
  } while (page <= totalPages && page <= MAX_SEARCH_PAGES)
  return { entries, truncated: totalPages > MAX_SEARCH_PAGES }
}

/**
 * The router searches file contents only, so path matches come from the
 * plain listing with the same filters; content matches are listed first.
 */
async function searchFiles(
  request: Request,
  filters: FileFilters,
  term: string,
  signal: AbortSignal
): Promise<FileListResult> {
  const [contentMatches, listing] = await Promise.all([
    readAllFiles(request, { ...filters, query: term }, signal),
    readAllFiles(request, filters, signal)
  ])
  const found = new Set(contentMatches.entries.map(fileKey))
  const needle = term.toLowerCase()
  const rows: FileRow[] = [
    ...contentMatches.entries.map((entry) => ({ ...entry, pathOnly: false })),
    ...listing.entries
      .filter(
        (entry) =>
          !found.has(fileKey(entry)) &&
          entry.path.toLowerCase().includes(needle)
      )
      .map((entry) => ({ ...entry, pathOnly: true }))
  ]
  return {
    rows,
    totalCount: rows.length,
    totalPages: 1,
    truncated: contentMatches.truncated || listing.truncated
  }
}

async function browseFiles(
  request: Request,
  filters: FileFilters,
  page: number,
  signal: AbortSignal
): Promise<FileListResult> {
  const response = await request<FileListResponse>('/filesystem/files', {
    signal,
    query: { ...filters, page, limit: BROWSE_PAGE_SIZE }
  })
  const result = readPage<FileEntry>(response, 'entries')
  return {
    rows: result.items.map((entry) => ({ ...entry, pathOnly: false })),
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    truncated: false
  }
}

const sortedUnique = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    (a, b) => a.localeCompare(b)
  )

const SELECTION = {
  file: parseAsString,
  ns: parseAsString,
  holder: parseAsString,
  owner: parseAsString
}

export function FilesView() {
  const api = useApi()
  const qc = useQueryClient()
  const names = useComponentNames()
  const config = useOsConfigQuery()
  const ids = useId()

  const [selection, setSelection] = useQueryStates(SELECTION, {
    history: 'push'
  })
  const [draft, setDraft] = useState('')
  const [term, setTerm] = useState('')
  const [namespace, setNamespace] = useState('')
  const [agentId, setAgentId] = useState('')
  const [page, setPage] = useState(1)

  const filters: FileFilters = {
    namespace: namespace || undefined,
    agent_id: agentId || undefined
  }
  const listRoot = api.key(KNOWLEDGE_KEY, 'files')

  const files = useQuery({
    queryKey: [
      ...listRoot,
      { term, namespace, agentId, page: term ? 0 : page }
    ],
    queryFn: ({ signal }) =>
      term
        ? searchFiles(api.request, filters, term, signal)
        : browseFiles(api.request, filters, page, signal),
    enabled: api.ready,
    placeholderData: keepPreviousData
  })

  const rows = files.data?.rows ?? []
  const configNamespaces = config.data?.filesystem?.namespaces ?? []
  const namespaceOptions = sortedUnique([
    ...configNamespaces.map((entry) => entry.namespace),
    ...rows.map((row) => row.namespace),
    namespace
  ]).filter((value) => !value.includes('{'))
  const agentOptions = sortedUnique([
    ...configNamespaces.flatMap((entry) => entry.agents.map((a) => a.id)),
    ...rows.flatMap((row) => row.agent_ids),
    agentId
  ]).sort((a, b) => names.agent(a).localeCompare(names.agent(b)))

  const target: FileTarget | null =
    selection.file && selection.ns
      ? {
          path: selection.file,
          namespace: selection.ns,
          agentId: selection.holder,
          userId: selection.owner
        }
      : null

  const select = (row: FileRow) =>
    void setSelection({
      file: row.path,
      ns: row.namespace,
      holder: row.agent_ids[0] ?? null,
      owner: row.user_id || null
    })
  const closePreview = () =>
    void setSelection(
      { file: null, ns: null, holder: null, owner: null },
      { history: 'replace' }
    )

  const submitSearch = () => {
    const next = draft.trim()
    if (next === term) {
      void files.refetch()
      return
    }
    setTerm(next)
    setPage(1)
  }
  const clearFilters = () => {
    setDraft('')
    setTerm('')
    setNamespace('')
    setAgentId('')
    setPage(1)
  }

  const filtered = Boolean(term || namespace || agentId)
  const stale = draft.trim() !== term
  const searching = files.isFetching && files.isPlaceholderData

  const holdersOf = (row: FileEntry) =>
    row.agent_ids.length ? row.agent_ids.map(names.agent).join(', ') : 'Shared'

  return (
    <>
      <KnowledgeHeader
        actions={
          <RefreshButton
            onRefresh={() =>
              Promise.all([
                qc.refetchQueries({ queryKey: listRoot }),
                qc.refetchQueries({
                  queryKey: api.key(KNOWLEDGE_KEY, 'file-content')
                })
              ])
            }
          />
        }
      />
      <SplitLayout>
        <SplitMain>
          <PageBody className="gap-3 md:pt-5">
            <h2 className="sr-only">Notes and files</h2>
            <form
              role="search"
              aria-label="Search notes and files"
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                submitSearch()
              }}
            >
              <label htmlFor={`${ids}-q`} className="sr-only">
                Search paths and contents
              </label>
              <SearchInput
                id={`${ids}-q`}
                value={draft}
                maxLength={MAX_QUERY_LENGTH}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Search paths and contents"
                className="min-w-0 flex-1"
              />
              <Button
                type="submit"
                loading={Boolean(term) && files.isFetching && !files.isPending}
              >
                Search
              </Button>
            </form>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-2">
              <div>
                <label htmlFor={`${ids}-ns`} className="sr-only">
                  Namespace
                </label>
                <Select
                  id={`${ids}-ns`}
                  value={namespace}
                  onChange={(event) => {
                    setNamespace(event.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">All namespaces</option>
                  {namespaceOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor={`${ids}-agent`} className="sr-only">
                  Agent
                </label>
                <Select
                  id={`${ids}-agent`}
                  value={agentId}
                  onChange={(event) => {
                    setAgentId(event.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">All agents</option>
                  {agentOptions.map((value) => (
                    <option key={value} value={value}>
                      {names.agent(value)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {files.data ? (
              <div
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs text-fg-3"
                aria-live="polite"
              >
                <span>
                  {term
                    ? `${pluralize(files.data.totalCount, 'file')} match “${term}”`
                    : pluralize(files.data.totalCount, 'file')}
                  {files.data.truncated
                    ? `. Searched the first ${(MAX_PAGE_SIZE * MAX_SEARCH_PAGES).toLocaleString()} files; narrow the filters to search the rest.`
                    : null}
                </span>
                {stale ? (
                  <span>Press Enter or Search to update</span>
                ) : term ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraft('')
                      setTerm('')
                      setPage(1)
                    }}
                  >
                    Clear search
                  </Button>
                ) : null}
              </div>
            ) : null}

            {files.isPending ? (
              <LoadingRows rows={6} label="Loading files" />
            ) : files.isError && !files.data ? (
              <ErrorState
                title="Couldn't load notes and files"
                error={files.error}
                onRetry={() => void files.refetch()}
                retrying={files.isFetching}
              />
            ) : rows.length === 0 ? (
              filtered ? (
                <EmptyState
                  title={
                    term
                      ? `No files match “${term}”`
                      : 'No files match these filters'
                  }
                  action={
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<FolderOpen />}
                  title="No notes or files yet"
                  description="When agents save notes, reports or data to a shared filesystem, they appear here."
                />
              )
            ) : (
              <>
                {files.isError ? (
                  <ErrorState
                    compact
                    title="Couldn't refresh notes and files"
                    error={files.error}
                    onRetry={() => void files.refetch()}
                    retrying={files.isFetching}
                  />
                ) : null}
                <ul
                  aria-label="Files"
                  className={cn(
                    'flex flex-col gap-1 transition-opacity',
                    searching && 'opacity-60'
                  )}
                >
                  {rows.map((row) => {
                    const selected =
                      target !== null &&
                      target.path === row.path &&
                      target.namespace === row.namespace &&
                      (target.userId ?? '') === (row.user_id ?? '')
                    return (
                      <li
                        key={`${fileKey(row)}\u0000${row.agent_ids.join(',')}`}
                      >
                        <button
                          type="button"
                          onClick={() => select(row)}
                          aria-current={selected || undefined}
                          className={cn(
                            'flex w-full flex-col gap-1.5 rounded-[10px] border p-3 text-left transition-colors',
                            selected
                              ? 'border-line bg-raised'
                              : 'border-transparent hover:bg-hover'
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText
                              aria-hidden
                              className="size-4 shrink-0 text-fg-3"
                            />
                            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">
                              <Highlight text={row.path} query={term} />
                            </span>
                            <Chip className="h-[22px]">{row.namespace}</Chip>
                          </span>
                          <span className="text-xs text-fg-3">
                            {holdersOf(row)}
                            {row.user_id ? ` · User ${row.user_id}` : ''} ·{' '}
                            {formatBytes(row.size_bytes)}
                            {row.updated_at ? (
                              <>
                                {' · '}
                                <RelativeTime value={row.updated_at} />
                              </>
                            ) : null}
                            {row.pathOnly ? ' · Matched in path' : ''}
                          </span>
                          {row.snippet ? (
                            <>
                              <span className="line-clamp-4 rounded-lg border border-line bg-canvas px-2.5 py-2 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-fg-2">
                                <Highlight text={row.snippet} query={term} />
                              </span>
                              {row.line || row.match_count ? (
                                <span className="text-xs text-fg-3">
                                  {[
                                    row.line ? `Line ${row.line}` : null,
                                    row.match_count
                                      ? pluralize(
                                          row.match_count,
                                          'match',
                                          'matches'
                                        )
                                      : null
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {term ? null : (
                  <Pager
                    page={page}
                    totalPages={files.data?.totalPages ?? 1}
                    onPageChange={setPage}
                    disabled={files.isPlaceholderData}
                  />
                )}
              </>
            )}
          </PageBody>
        </SplitMain>

        {target ? (
          <FilePreview
            key={`${fileKey({
              namespace: target.namespace,
              path: target.path,
              user_id: target.userId
            })}\u0000${target.agentId ?? ''}`}
            target={target}
            onClose={closePreview}
          />
        ) : (
          <div className="hidden min-h-0 shrink-0 items-center justify-center border-l border-line p-8 md:flex md:w-[55%] lg:w-[60%]">
            <EmptyState
              icon={<FileText />}
              title="Select a file to preview it"
              description="Markdown notes render with formatting; other files show as plain text."
              className="w-full max-w-sm border-none"
            />
          </div>
        )}
      </SplitLayout>
    </>
  )
}
