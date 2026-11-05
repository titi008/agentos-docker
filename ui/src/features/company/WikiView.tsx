'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  RefreshCw,
  SquarePen
} from 'lucide-react'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { ApiError, getErrorMessage, useApi } from '@/api/client'
import { SECTIONS } from '@/components/shell/nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Field } from '@/components/ui/field'
import { SearchInput, Select } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { PageHeader, RouteTabs } from '@/components/ui/page'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Skeleton
} from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { formatBytes } from '@/lib/time'
import { cn } from '@/lib/utils'

import {
  encodePath,
  fetchWikiPage,
  useCompanyKeys,
  useProductsQuery,
  useWikiPageQuery,
  useWikiPagesQuery,
  wikiBase
} from './api'
import type { WikiPage, WikiPageMeta } from './types'
import { NewWikiPageDialog, WikiConflictDialog } from './WikiDialogs'
import { EditorModeSwitch, WikiEditor, type EditorMode } from './WikiEditor'
import { WikiTree } from './WikiTree'

const DEFAULT_PAGE = 'brief.md'
const NEW_KINDS = ['page'] as const

interface EditState {
  /** Product id, or '' for the company wiki. */
  scope: string
  path: string
  draft: string
  baseContent: string
  baseVersion: number
  /** The user's draft, kept after reviewing a conflicting save. */
  previousDraft?: string
}

interface SaveVariables {
  scope: string | null
  path: string
  content: string
  expectedVersion: number
}

const isDirty = (edit: EditState | null) =>
  Boolean(
    edit &&
    (edit.draft !== edit.baseContent || edit.previousDraft !== undefined)
  )

function PageMetaLine({
  meta,
  nextVersion
}: {
  meta: WikiPageMeta
  nextVersion?: number
}) {
  const parts: ReactNode[] = []
  if (meta.version !== null && meta.version !== undefined) {
    parts.push(<span key="v">v{meta.version}</span>)
  }
  parts.push(<span key="size">{formatBytes(meta.size_bytes)}</span>)
  if (meta.updated_at) {
    parts.push(
      <span key="updated">
        updated <RelativeTime value={meta.updated_at} />
        {meta.user_id ? ` by ${meta.user_id}` : ''}
      </span>
    )
  }
  if (nextVersion !== undefined) {
    parts.push(<span key="next">saving creates v{nextVersion}</span>)
  }
  return (
    <p className="text-[12.5px] text-fg-3">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? ' · ' : ''}
          {part}
        </span>
      ))}
    </p>
  )
}

export function WikiView() {
  const section = SECTIONS.company
  const api = useApi()
  const queryClient = useQueryClient()
  const keys = useCompanyKeys()
  const confirm = useConfirm()

  const [scopeParam, setScopeParam] = useQueryState('scope')
  const [pageParam, setPageParam] = useQueryState(
    'page',
    parseAsString.withOptions({ history: 'push' })
  )
  const [newKind, setNewKind] = useQueryState(
    'new',
    parseAsStringLiteral(NEW_KINDS)
  )
  const [search, setSearch] = useState('')
  const [treeOpen, setTreeOpen] = useState(false)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [mode, setMode] = useState<EditorMode>('split')
  const [conflict, setConflict] = useState<WikiPage | null>(null)

  const products = useProductsQuery()
  const productList = useMemo(() => products.data ?? [], [products.data])
  // An unknown product id falls back to the company wiki.
  const productId =
    scopeParam &&
    (products.isPending || productList.some((p) => p.id === scopeParam))
      ? scopeParam
      : null
  const product = productList.find((p) => p.id === productId)
  const scopeKey = productId ?? ''
  const scopeLabel = productId ? (product?.name ?? productId) : 'Company-wide'

  const pages = useWikiPagesQuery(productId)
  const pageList = useMemo(() => pages.data ?? [], [pages.data])
  const existingPaths = useMemo(
    () => new Set(pageList.map((page) => page.path)),
    [pageList]
  )
  const selectedPath: string | null = pages.isSuccess
    ? pageParam && existingPaths.has(pageParam)
      ? pageParam
      : existingPaths.has(DEFAULT_PAGE)
        ? DEFAULT_PAGE
        : (pageList[0]?.path ?? null)
    : pageParam
  const page = useWikiPageQuery(productId, selectedPath)

  const editing =
    edit && edit.scope === scopeKey && edit.path === selectedPath ? edit : null
  const dirty = isDirty(editing)
  const anyDirty = isDirty(edit)

  // Warns on tab close and on in-app link clicks (sidebar, tabs) while edits are unsaved.
  useUnsavedChanges(anyDirty, 'this wiki page')

  /** Resolves true when it is fine to leave the current edit. */
  const confirmDiscard = async (): Promise<boolean> => {
    if (!editing || !dirty) {
      setEdit(null)
      return true
    }
    const ok = await confirm({
      title: 'Leave without saving?',
      description: (
        <>
          You have unsaved changes to{' '}
          <span className="font-mono">{editing.path}</span>.
        </>
      ),
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      tone: 'danger'
    })
    if (ok) setEdit(null)
    return ok
  }

  const selectPage = async (path: string) => {
    if (path === selectedPath) {
      setTreeOpen(false)
      return
    }
    if (!(await confirmDiscard())) return
    setTreeOpen(false)
    void setPageParam(path)
  }

  const changeScope = async (value: string) => {
    if ((value || null) === productId) return
    if (!(await confirmDiscard())) return
    void setScopeParam(value || null)
    void setPageParam(null)
  }

  const refresh = async () => {
    if (!(await confirmDiscard())) return
    void products.refetch()
    void pages.refetch()
    if (selectedPath) void page.refetch()
  }

  const save = useMutation({
    mutationFn: (variables: SaveVariables) =>
      api.request<WikiPageMeta>(
        `${wikiBase(variables.scope)}/${encodePath(variables.path)}`,
        {
          method: 'PUT',
          json: {
            content: variables.content,
            expected_version: variables.expectedVersion
          }
        }
      ),
    onSuccess: (metadata, variables) => {
      queryClient.setQueryData<WikiPage>(
        keys.wikiPage(variables.scope, variables.path),
        { content: variables.content, metadata }
      )
      void queryClient.invalidateQueries({
        queryKey: keys.wikiPages(variables.scope)
      })
      setEdit(null)
      setConflict(null)
      toast.success(`Saved ${variables.path}`)
    },
    onError: async (error, variables) => {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await queryClient.fetchQuery({
            queryKey: keys.wikiPage(variables.scope, variables.path),
            queryFn: ({ signal }) =>
              fetchWikiPage(
                api.request,
                variables.scope,
                variables.path,
                signal
              ),
            staleTime: 0
          })
          setConflict(latest)
        } catch (reloadError) {
          toast.error(`Couldn't save ${variables.path}`, {
            description: `Someone else changed this page and the latest version couldn't be loaded. ${getErrorMessage(reloadError)}`
          })
        }
        return
      }
      setConflict(null)
      toast.error(`Couldn't save ${variables.path}`, {
        description: getErrorMessage(error)
      })
    }
  })

  const startEdit = () => {
    if (!page.data || !selectedPath) return
    setEdit({
      scope: scopeKey,
      path: selectedPath,
      draft: page.data.content,
      baseContent: page.data.content,
      baseVersion: page.data.metadata.version ?? 0
    })
  }

  const cancelEdit = async () => {
    if (!dirty) {
      setEdit(null)
      return
    }
    await confirmDiscard()
  }

  const saveDraft = () => {
    if (!editing || save.isPending) return
    if (!dirty) {
      setEdit(null)
      return
    }
    save.mutate({
      scope: productId,
      path: editing.path,
      content: editing.draft,
      expectedVersion: editing.baseVersion
    })
  }

  const openNewPage = () => void setNewKind('page')
  const closeNewPage = () => void setNewKind(null)

  /* Left column ------------------------------------------------------------ */

  const query = search.trim().toLowerCase()
  const filteredPages = query
    ? pageList.filter((item) => item.path.toLowerCase().includes(query))
    : pageList

  let tree: ReactNode
  if (pages.isPending) {
    tree = <LoadingRows rows={5} label="Loading pages" />
  } else if (pages.isError) {
    tree = <p className="px-1 text-[13px] text-fg-3">Pages couldn’t load.</p>
  } else if (pageList.length === 0) {
    tree = (
      <p className="px-1 text-[13px] text-fg-3">No pages in this scope yet.</p>
    )
  } else if (filteredPages.length === 0) {
    tree = (
      <div className="flex flex-col items-start gap-2 px-1 text-[13px] text-fg-3">
        No pages match “{search.trim()}”.
        <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
          Clear search
        </Button>
      </div>
    )
  } else {
    tree = (
      <WikiTree
        key={scopeKey}
        pages={filteredPages}
        selectedPath={selectedPath}
        onSelect={(path) => void selectPage(path)}
        forceExpanded={Boolean(query)}
      />
    )
  }

  /* Right column ----------------------------------------------------------- */

  let body: ReactNode
  if (pages.isError) {
    body = (
      <div className="p-4 md:p-8">
        <ErrorState
          title={`Couldn't load the ${scopeLabel === 'Company-wide' ? 'company' : scopeLabel} wiki`}
          error={pages.error}
          onRetry={() => pages.refetch()}
          retrying={pages.isFetching}
        />
      </div>
    )
  } else if (pages.isSuccess && pageList.length === 0) {
    body = (
      <div className="p-4 md:p-8">
        <EmptyState
          icon={<BookOpen />}
          title="No pages yet"
          description={`Pages here are read by your agents and Company Manager before they plan work for ${scopeLabel === 'Company-wide' ? 'the company' : scopeLabel}.`}
          action={
            <Button variant="primary" onClick={openNewPage}>
              <Plus />
              New page
            </Button>
          }
        />
      </div>
    )
  } else if (!selectedPath || (page.isPending && !page.isError)) {
    body = (
      <div className="flex flex-col gap-3 p-4 md:p-8" role="status">
        <span className="sr-only">Loading page…</span>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  } else if (page.isError || !page.data) {
    body = (
      <div className="p-4 md:p-8">
        <ErrorState
          title={`Couldn't load ${selectedPath}`}
          error={page.error}
          onRetry={() => page.refetch()}
          retrying={page.isFetching}
        />
      </div>
    )
  } else if (editing) {
    body = (
      <WikiEditor
        mode={mode}
        draft={editing.draft}
        onDraftChange={(draft) => setEdit({ ...editing, draft })}
        onSave={saveDraft}
        previousDraft={editing.previousDraft}
        onDismissPrevious={() =>
          setEdit({ ...editing, previousDraft: undefined })
        }
      />
    )
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="max-w-3xl px-4 py-5 md:px-8 md:py-6">
          {page.data.content.trim() ? (
            <Markdown content={page.data.content} />
          ) : (
            <EmptyState
              icon={<FileText />}
              title="This page is empty"
              description="Add what your agents should know."
              action={
                <Button onClick={startEdit}>
                  <SquarePen />
                  Edit page
                </Button>
              }
            />
          )}
        </div>
      </div>
    )
  }

  const meta = page.data?.metadata

  return (
    <>
      <PageHeader
        title={section.title}
        description={section.description}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh()}
              loading={pages.isFetching || page.isFetching}
            >
              {pages.isFetching || page.isFetching ? null : <RefreshCw />}
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={openNewPage}>
              <Plus />
              New page
            </Button>
          </>
        }
      />
      <RouteTabs tabs={section.tabs} aria-label="Company sections" />
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <aside
          aria-label="Wiki pages"
          className="flex shrink-0 flex-col gap-3.5 border-line bg-panel px-3.5 py-4 max-md:border-b md:w-[280px] md:overflow-y-auto md:border-r lg:w-[300px]"
        >
          <Field label="Scope" htmlFor="wiki-scope">
            <Select
              id="wiki-scope"
              value={scopeKey}
              onChange={(event) => void changeScope(event.target.value)}
            >
              <option value="">Company-wide</option>
              {productList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.id} (product)
                </option>
              ))}
            </Select>
          </Field>
          <Button
            variant="secondary"
            className="justify-between md:hidden"
            aria-expanded={treeOpen}
            aria-controls="wiki-tree"
            onClick={() => setTreeOpen(!treeOpen)}
          >
            <span className="flex min-w-0 items-center gap-2">
              Pages
              {selectedPath ? (
                <span className="truncate font-mono text-[12.5px] text-fg-3">
                  {selectedPath}
                </span>
              ) : null}
            </span>
            {treeOpen ? <ChevronDown /> : <ChevronRight />}
          </Button>
          <div
            id="wiki-tree"
            className={cn(
              'flex flex-col gap-3 max-md:max-h-[45dvh] max-md:overflow-y-auto',
              !treeOpen && 'max-md:hidden'
            )}
          >
            <SearchInput
              aria-label="Search pages"
              placeholder="Search pages"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="flex items-center justify-between px-1 text-xs font-medium text-fg-3">
              <span>Pages</span>
              {pages.isSuccess ? (
                <span className="tabular-nums">{pageList.length}</span>
              ) : null}
            </div>
            {tree}
          </div>
        </aside>

        <section
          aria-label={selectedPath ? `Wiki page ${selectedPath}` : 'Wiki page'}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {selectedPath && meta && !page.isError ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-line px-4 py-3.5 md:px-6">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] text-fg-3">{scopeLabel} /</span>
                  <h2 className="font-mono text-[15px] font-medium break-all">
                    {selectedPath}
                  </h2>
                  {dirty ? (
                    <Badge tone="warn" dot>
                      Unsaved changes
                    </Badge>
                  ) : null}
                </div>
                <PageMetaLine
                  meta={meta}
                  nextVersion={editing ? editing.baseVersion + 1 : undefined}
                />
              </div>
              {editing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <EditorModeSwitch mode={mode} onChange={setMode} />
                  <Button
                    size="sm"
                    onClick={() => void cancelEdit()}
                    disabled={save.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveDraft}
                    loading={save.isPending}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={startEdit}>
                  <SquarePen />
                  Edit
                </Button>
              )}
            </div>
          ) : null}
          {body}
        </section>
      </div>

      {newKind === 'page' ? (
        <NewWikiPageDialog
          productId={productId}
          scopeLabel={scopeLabel}
          existingPaths={existingPaths}
          onClose={closeNewPage}
          onCreated={(path) => {
            closeNewPage()
            if (dirty) {
              toast.success(`Created ${path}`, {
                description: 'Your unsaved edits are still open.',
                action: { label: 'Open', onClick: () => void selectPage(path) }
              })
              return
            }
            toast.success(`Created ${path}`)
            setEdit(null)
            void setPageParam(path)
          }}
        />
      ) : null}
      {conflict && editing ? (
        <WikiConflictDialog
          path={editing.path}
          latest={conflict}
          baseVersion={editing.baseVersion}
          overwriting={save.isPending}
          onKeepEditing={() => setConflict(null)}
          onReview={() => {
            setEdit({
              ...editing,
              draft: conflict.content,
              baseContent: conflict.content,
              baseVersion: conflict.metadata.version ?? 0,
              previousDraft: editing.draft
            })
            setConflict(null)
          }}
          onOverwrite={() =>
            save.mutate({
              scope: productId,
              path: editing.path,
              content: editing.draft,
              expectedVersion: conflict.metadata.version ?? 0
            })
          }
        />
      ) : null}
    </>
  )
}
