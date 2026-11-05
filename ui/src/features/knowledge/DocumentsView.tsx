'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { ApiError, getErrorMessage, useApi } from '@/api/client'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/data'
import { Select, SearchInput } from '@/components/ui/input'
import { PageBody, PageScroll } from '@/components/ui/page'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { formatBytes } from '@/lib/time'

import { AddDocumentDialog } from './AddDocumentDialog'
import {
  KNOWLEDGE_KEY,
  readPage,
  useKnowledgeBase,
  type KnowledgeBaseSelection
} from './queries'
import { RetrievalTest } from './RetrievalTest'
import { KnowledgeHeader, Pager, RefreshButton, pluralize } from './shared'
import type { KnowledgeDocument, PageResult } from './types'

const PAGE_SIZE = 25
const POLL_MS = 3000
/** How long to keep polling for an upload whose row has not appeared yet. */
const PENDING_WINDOW_MS = 60_000

interface PendingUpload {
  id: string
  until: number
}

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  completed: { tone: 'ok', label: 'Ready' },
  processing: { tone: 'info', label: 'Processing' },
  partial: { tone: 'warn', label: 'Partially indexed' },
  failed: { tone: 'bad', label: 'Failed' }
}

function statusOf(document: KnowledgeDocument) {
  const key = (document.status ?? '').toLowerCase()
  return (
    STATUS[key] ?? {
      tone: 'neutral' as const,
      label: key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown'
    }
  )
}

const isProcessing = (document: KnowledgeDocument) =>
  (document.status ?? '').toLowerCase() === 'processing'

const TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  md: 'Markdown',
  markdown: 'Markdown',
  mdx: 'Markdown',
  txt: 'Text',
  text: 'Text',
  plain: 'Text',
  manual: 'Text',
  csv: 'CSV',
  json: 'JSON',
  doc: 'Word',
  docx: 'Word',
  pptx: 'PowerPoint',
  xls: 'Excel',
  xlsx: 'Excel',
  html: 'HTML',
  htm: 'HTML',
  xml: 'XML',
  url: 'Web page'
}

const MIME_SUBTYPES: [string, string][] = [
  ['wordprocessingml', 'docx'],
  ['presentationml', 'pptx'],
  ['spreadsheetml', 'xlsx'],
  ['msword', 'doc'],
  ['ms-excel', 'xls']
]

function typeLabel(document: KnowledgeDocument): string {
  let raw = (document.type ?? '').trim().toLowerCase()
  if (raw.includes('/')) {
    const subtype = raw.split('/').pop() ?? ''
    raw =
      MIME_SUBTYPES.find(([needle]) => subtype.includes(needle))?.[1] ??
      subtype.replace(/^x-/, '')
  }
  raw = raw.replace(/^\./, '')
  if (!raw) {
    const match = /\.([a-z0-9]+)$/i.exec(document.name ?? '')
    raw = match?.[1]?.toLowerCase() ?? ''
  }
  if (!raw) return '—'
  return TYPE_LABELS[raw] ?? raw.toUpperCase()
}

function sizeLabel(document: KnowledgeDocument): string {
  const bytes = Number(document.size)
  return Number.isFinite(bytes) && bytes > 0 ? formatBytes(bytes) : '—'
}

const documentName = (document: KnowledgeDocument) =>
  document.name || document.id

function rangeLabel(page: number, shown: number, total = shown): string {
  const start = (page - 1) * PAGE_SIZE + 1
  const end = start + shown - 1
  return start === 1 && end === total
    ? `Showing all ${total.toLocaleString()}.`
    : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}.`
}

function KnowledgeBasePicker({
  selection,
  onChange
}: {
  selection: KnowledgeBaseSelection
  onChange: (id: string) => void
}) {
  const id = useId()
  if (selection.bases.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-fg">
        Knowledge base
      </label>
      <Select
        id={id}
        value={selection.id}
        onChange={(event) => onChange(event.target.value)}
        className="w-full max-w-xs"
      >
        {selection.bases.map((base) => (
          <option key={base.id} value={base.id}>
            {base.name}
          </option>
        ))}
      </Select>
    </div>
  )
}

export function DocumentsView() {
  const api = useApi()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const knowledgeBase = useKnowledgeBase()
  const [newParam, setNewParam] = useQueryState('new')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<PendingUpload[]>([])
  const searchId = useId()

  const knowledgeId = knowledgeBase.id
  const listRoot = api.key(KNOWLEDGE_KEY, 'documents')

  const documents = useQuery({
    queryKey: [...listRoot, knowledgeId ?? null, page],
    queryFn: ({ signal }): Promise<PageResult<KnowledgeDocument>> =>
      api
        .request<unknown>('/knowledge/content', {
          signal,
          query: {
            page,
            limit: PAGE_SIZE,
            sort_by: 'created_at',
            sort_order: 'desc',
            knowledge_id: knowledgeId
          }
        })
        .then(readPage<KnowledgeDocument>),
    enabled: api.ready && knowledgeBase.ready,
    placeholderData: keepPreviousData,
    // Poll while anything is indexing, or an upload's row has not appeared yet.
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      if (items.some(isProcessing)) return POLL_MS
      const now = Date.now()
      const waiting = pending.some(
        (upload) =>
          upload.until > now && !items.some((item) => item.id === upload.id)
      )
      return waiting ? POLL_MS : false
    }
  })

  const remove = useMutation({
    mutationFn: (document: KnowledgeDocument) =>
      api.request(`/knowledge/content/${encodeURIComponent(document.id)}`, {
        method: 'DELETE',
        query: { knowledge_id: knowledgeId }
      }),
    onSuccess: (_, document) => {
      toast.success(`Deleted ${documentName(document)}`)
      if (page > 1 && documents.data?.items.length === 1) {
        setPage(page - 1)
      }
      return qc.invalidateQueries({ queryKey: listRoot })
    },
    onError: (error, document) =>
      toast.error(`Couldn't delete ${documentName(document)}`, {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  const requestDelete = async (document: KnowledgeDocument) => {
    const ok = await confirm({
      title: 'Delete document?',
      description: (
        <>
          <span className="font-mono">{documentName(document)}</span> will be
          removed from the knowledge base. Agents will no longer retrieve it.
          This can’t be undone.
        </>
      ),
      confirmLabel: 'Delete document',
      tone: 'danger'
    })
    if (ok) remove.mutate(document)
  }

  const onAdded = (document: KnowledgeDocument) => {
    const now = Date.now()
    setPending((current) => [
      ...current.filter((upload) => upload.until > now),
      { id: document.id, until: now + PENDING_WINDOW_MS }
    ])
    setPage(1)
    void qc.invalidateQueries({ queryKey: listRoot })
  }

  const openAdd = () => void setNewParam('document')
  const closeAdd = () => void setNewParam(null)

  const data = documents.data
  const items = data?.items ?? []
  const needle = search.trim().toLowerCase()
  const visible = needle
    ? items.filter((document) =>
        [document.name, document.description, document.id].some((value) =>
          value?.toLowerCase().includes(needle)
        )
      )
    : items
  const anyProcessing = items.some(isProcessing)

  const noKnowledgeBase =
    documents.error instanceof ApiError && documents.error.status === 503

  return (
    <>
      <KnowledgeHeader
        actions={
          <>
            <RefreshButton
              onRefresh={() => qc.refetchQueries({ queryKey: listRoot })}
            />
            <Button variant="primary" size="sm" onClick={openAdd}>
              <Plus />
              Add document
            </Button>
          </>
        }
      />
      <PageScroll>
        <PageBody>
          <KnowledgeBasePicker
            selection={knowledgeBase}
            onChange={(id) => {
              knowledgeBase.setId(id)
              setPage(1)
            }}
          />

          <div className="flex flex-wrap items-start gap-5">
            <section
              aria-labelledby={`${searchId}-heading`}
              className="flex min-w-0 flex-[999_1_560px] flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2
                  id={`${searchId}-heading`}
                  className="flex-1 text-[15px] font-semibold"
                >
                  Documents{' '}
                  {data ? (
                    <span className="font-normal text-fg-3 tabular-nums">
                      {data.totalCount.toLocaleString()}
                    </span>
                  ) : null}
                </h2>
                <label htmlFor={searchId} className="sr-only">
                  Search documents
                </label>
                <SearchInput
                  id={searchId}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search documents"
                  className="w-[260px] max-w-full"
                />
              </div>

              {documents.isPending ? (
                <LoadingRows rows={5} label="Loading documents" />
              ) : noKnowledgeBase ? (
                <EmptyState
                  icon={<FileText />}
                  title="No knowledge base on this AgentOS"
                  description="Give AgentOS a Knowledge with a contents database to add and search documents here."
                />
              ) : documents.isError && !data ? (
                <ErrorState
                  title="Couldn't load documents"
                  error={documents.error}
                  onRetry={() => void documents.refetch()}
                  retrying={documents.isFetching}
                />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<FileText />}
                  title="No documents yet"
                  description="Upload files or paste notes so agents can retrieve them in their answers."
                  action={
                    <Button variant="primary" size="sm" onClick={openAdd}>
                      <Plus />
                      Add document
                    </Button>
                  }
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  title={`No documents match “${search.trim()}”`}
                  description={
                    data && data.totalPages > 1
                      ? 'Search covers the documents on this page.'
                      : undefined
                  }
                  action={
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSearch('')}
                    >
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <>
                  {documents.isError ? (
                    <ErrorState
                      compact
                      title="Couldn't refresh documents"
                      error={documents.error}
                      onRetry={() => void documents.refetch()}
                      retrying={documents.isFetching}
                    />
                  ) : null}
                  <TableWrap>
                    <Table className="min-w-[600px]">
                      <thead>
                        <tr>
                          <Th>Name</Th>
                          <Th>Type</Th>
                          <Th>Size</Th>
                          <Th>Status</Th>
                          <Th>Added</Th>
                          <Th className="w-12">
                            <span className="sr-only">Actions</span>
                          </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((document) => {
                          const status = statusOf(document)
                          const message = document.status_message?.trim()
                          const deleting =
                            remove.isPending &&
                            remove.variables?.id === document.id
                          return (
                            <Tr key={document.id}>
                              <Td className="max-w-[320px]">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <FileText
                                    aria-hidden
                                    className="size-4 shrink-0 text-fg-3"
                                  />
                                  <div className="flex min-w-0 flex-col">
                                    <span
                                      className="truncate font-mono text-fg"
                                      title={documentName(document)}
                                    >
                                      {documentName(document)}
                                    </span>
                                    {document.description ? (
                                      <span className="truncate text-xs text-fg-3">
                                        {document.description}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </Td>
                              <Td className="whitespace-nowrap text-fg-2">
                                {typeLabel(document)}
                              </Td>
                              <Td className="whitespace-nowrap text-fg-2 tabular-nums">
                                {sizeLabel(document)}
                              </Td>
                              <Td>
                                <div className="flex flex-col items-start gap-1">
                                  <Badge tone={status.tone} dot>
                                    {status.label}
                                  </Badge>
                                  {message ? (
                                    <span
                                      className={
                                        status.tone === 'bad'
                                          ? 'max-w-[280px] text-[12.5px] break-words text-bad'
                                          : 'max-w-[280px] text-[12.5px] break-words text-fg-3'
                                      }
                                    >
                                      {message}
                                    </span>
                                  ) : null}
                                </div>
                              </Td>
                              <Td className="whitespace-nowrap text-fg-2">
                                <RelativeTime value={document.created_at} />
                              </Td>
                              <Td className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${documentName(document)}`}
                                  loading={deleting}
                                  onClick={() => void requestDelete(document)}
                                >
                                  {deleting ? null : <Trash2 />}
                                </Button>
                              </Td>
                            </Tr>
                          )
                        })}
                      </tbody>
                    </Table>
                  </TableWrap>
                  <p className="text-xs text-fg-3">
                    {needle
                      ? `${pluralize(visible.length, 'match', 'matches')} on this page.`
                      : rangeLabel(page, items.length, data?.totalCount)}
                    {anyProcessing
                      ? ' Statuses refresh automatically while a document is processing.'
                      : null}
                  </p>
                  <Pager
                    page={page}
                    totalPages={data?.totalPages ?? 1}
                    onPageChange={setPage}
                    disabled={documents.isPlaceholderData}
                  />
                </>
              )}
            </section>

            <RetrievalTest
              knowledgeId={knowledgeId}
              className="min-w-0 flex-[1_1_340px]"
            />
          </div>
        </PageBody>
      </PageScroll>

      {newParam === 'document' ? (
        <AddDocumentDialog
          knowledgeId={knowledgeId}
          onClose={closeAdd}
          onAdded={onAdded}
        />
      ) : null}
    </>
  )
}
