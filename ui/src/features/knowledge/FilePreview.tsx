'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError, getErrorMessage, useApi } from '@/api/client'
import { Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/code'
import { Card } from '@/components/ui/data'
import { DetailPanel } from '@/components/ui/detail-panel'
import { Markdown } from '@/components/ui/markdown'
import { SegmentedControl } from '@/components/ui/segmented'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { formatBytes } from '@/lib/time'

import { KNOWLEDGE_KEY, useComponentNames } from './queries'
import { pluralize } from './shared'
import type { FileContent } from './types'

export interface FileTarget {
  path: string
  namespace: string
  /** Agent holding the filesystem, to disambiguate shared namespaces. */
  agentId: string | null
  /** User partition the file lives in; null for the shared partition. */
  userId: string | null
}

type View = 'rendered' | 'plain'

const isMarkdownPath = (path: string) => /\.(md|markdown|mdx)$/i.test(path)

/** Lines started in `text` (a trailing newline does not start a new line). */
function countLines(text: string): number {
  if (!text) return 0
  const newlines = text.split('\n').length - 1
  return text.endsWith('\n') ? newlines : newlines + 1
}

const Dot = () => <span aria-hidden>·</span>

/**
 * Preview of one filesystem file. Reads `GET /filesystem/content` in
 * character-offset pages and appends the next page on "Load more".
 */
export function FilePreview({
  target,
  onClose
}: {
  target: FileTarget
  onClose: () => void
}) {
  const api = useApi()
  const names = useComponentNames()
  const markdown = isMarkdownPath(target.path)
  const [view, setView] = useState<View>('rendered')

  const content = useInfiniteQuery({
    queryKey: api.key(KNOWLEDGE_KEY, 'file-content', target),
    queryFn: ({ pageParam, signal }) =>
      api.request<FileContent>('/filesystem/content', {
        signal,
        query: {
          path: target.path,
          namespace: target.namespace,
          agent_id: target.agentId,
          user_id: target.userId,
          offset: pageParam
        }
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next_offset ?? undefined,
    enabled: api.ready
  })

  const pages = content.data?.pages ?? []
  const first = pages[0]
  const text = pages.map((page) => page.content).join('')
  const totalLines = first?.line_count ?? 0
  const shownLines = Math.min(countLines(text), totalLines)
  const holders = first?.agent_ids.length
    ? first.agent_ids.map(names.agent).join(', ')
    : target.agentId
      ? names.agent(target.agentId)
      : 'Shared'
  const renderMarkdown = markdown && view === 'rendered'

  const subtitle = (
    <>
      <Chip className="h-[22px]">{first?.namespace ?? target.namespace}</Chip>
      <span>{holders}</span>
      {target.userId ? (
        <>
          <Dot />
          <span>
            User <span className="font-mono">{target.userId}</span>
          </span>
        </>
      ) : null}
      {first?.version !== undefined && first?.version !== null ? (
        <>
          <Dot />
          <span>Version {first.version}</span>
        </>
      ) : null}
      {first?.updated_at ? (
        <>
          <Dot />
          <span>
            Updated <RelativeTime value={first.updated_at} />
          </span>
        </>
      ) : null}
      {first ? (
        <>
          <Dot />
          <span>
            {formatBytes(first.size_bytes)} · {pluralize(totalLines, 'line')}
          </span>
        </>
      ) : null}
    </>
  )

  return (
    <DetailPanel
      aria-label={`Preview of ${target.path}`}
      title={
        <span className="font-mono text-[15px] font-medium break-all">
          {target.path}
        </span>
      }
      subtitle={subtitle}
      backLabel="All files"
      onClose={onClose}
      className="md:w-[55%] lg:w-[60%] xl:w-[60%]"
      actions={
        text ? (
          <CopyButton
            value={text}
            label="Copy"
            variant="secondary"
            successMessage={
              content.hasNextPage
                ? 'Copied the loaded part of the file'
                : 'Copied file contents'
            }
          />
        ) : null
      }
    >
      {content.isPending ? (
        <div role="status" className="flex flex-col gap-2.5">
          <span className="sr-only">Loading file…</span>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : content.isError && !first ? (
        <ErrorState
          title={
            content.error instanceof ApiError && content.error.status === 404
              ? 'File not found'
              : "Couldn't load this file"
          }
          error={content.error}
          onRetry={() => void content.refetch()}
          retrying={content.isFetching}
        />
      ) : (
        <>
          {content.isError && !content.isFetchNextPageError ? (
            <ErrorState
              compact
              title="Couldn't refresh this file"
              error={content.error}
              onRetry={() => void content.refetch()}
              retrying={content.isFetching}
            />
          ) : null}

          {markdown && text ? (
            <SegmentedControl<View>
              aria-label="Preview format"
              value={view}
              onChange={setView}
              className="self-start"
              options={[
                { value: 'rendered', label: 'Rendered' },
                { value: 'plain', label: 'Plain text' }
              ]}
            />
          ) : null}

          {text ? (
            <Card className="min-w-0 px-5 py-4">
              {renderMarkdown ? (
                <Markdown content={text} />
              ) : (
                <pre className="font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-fg-2">
                  {text}
                </pre>
              )}
            </Card>
          ) : (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-[13px] text-fg-3">
              This file is empty.
            </p>
          )}

          {content.hasNextPage ? (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-[10px] bg-hover px-3 py-2.5 text-[13px] text-fg-2"
            >
              <span className="min-w-[200px] flex-1">
                Showing the first {shownLines.toLocaleString()} of{' '}
                {totalLines.toLocaleString()} lines.
                {content.isFetchNextPageError ? (
                  <span className="mt-1 block text-bad">
                    Couldn’t load more:{' '}
                    {getErrorMessage(content.error, api.ctx.endpoint)}
                  </span>
                ) : null}
              </span>
              <Button
                size="sm"
                loading={content.isFetchingNextPage}
                onClick={() => void content.fetchNextPage()}
              >
                {content.isFetchNextPageError ? 'Try again' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </DetailPanel>
  )
}
