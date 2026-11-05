'use client'

import { RefreshCw, ShieldCheck } from 'lucide-react'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader, SplitLayout, SplitMain } from '@/components/ui/page'
import { SegmentedControl } from '@/components/ui/segmented'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { useApprovalsCountQuery } from '@/features/workspace/queries'
import { cn } from '@/lib/utils'

import { ApprovalDetail } from './ApprovalDetail'
import { pendingActions, requesterName, shortId, statusMeta } from './model'
import {
  useApprovalList,
  useComponentNames,
  type ApprovalView
} from './queries'
import type { Approval } from './types'

const VIEWS = ['waiting', 'resolved'] as const

function ApprovalRow({
  approval,
  requester,
  selected,
  onSelect
}: {
  approval: Approval
  requester: string
  selected: boolean
  onSelect: (id: string) => void
}) {
  const status = statusMeta(approval.status)
  const actions = pendingActions(approval)
  const time =
    approval.status === 'pending'
      ? approval.created_at
      : (approval.resolved_at ?? approval.created_at)
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(approval.id)}
        className={cn(
          'flex w-full flex-col gap-1 rounded-[10px] border border-transparent p-3 text-left transition-colors hover:bg-hover',
          selected && 'border-line-strong bg-raised hover:bg-raised'
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-mono text-[13px] font-medium">
            {actions[0].toolName}
            {actions.length > 1 ? (
              <span className="font-sans font-normal text-fg-3">
                {' '}
                +{actions.length - 1}
              </span>
            ) : null}
          </span>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-fg-2">
          <span className="truncate">{requester}</span>
          {approval.session_id ? (
            <>
              <span aria-hidden className="text-fg-3">
                ·
              </span>
              <span
                className="shrink-0 font-mono text-xs text-fg-3"
                title={`Session ${approval.session_id}`}
              >
                <span className="sr-only">Session </span>
                {shortId(approval.session_id)}
              </span>
            </>
          ) : null}
        </span>
        <RelativeTime value={time} className="text-xs text-fg-3" />
      </button>
    </li>
  )
}

export function ApprovalsView() {
  const [view, setView] = useQueryState(
    'view',
    parseAsStringLiteral(VIEWS).withDefault('waiting')
  )
  const [selectedId, setSelectedId] = useQueryState(
    'approval',
    parseAsString.withOptions({ history: 'push' })
  )
  const list = useApprovalList(view)
  const waitingCount = useApprovalsCountQuery()
  const lookup = useComponentNames()

  const all = list.data?.pages.flatMap((page) => page.items) ?? []
  const items =
    view === 'waiting'
      ? all
      : all.filter((approval) => approval.status !== 'pending')
  const placeholder = selectedId
    ? all.find((approval) => approval.id === selectedId)
    : undefined

  const refreshing = list.isFetching || waitingCount.isFetching
  const refresh = () => {
    void list.refetch()
    void waitingCount.refetch()
  }

  /** After a decision, open the next waiting request (or close the panel). */
  const onResolved = (approvalId: string) => {
    if (view !== 'waiting') return
    const index = items.findIndex((approval) => approval.id === approvalId)
    if (index === -1) return
    const next = items[index + 1] ?? items[index - 1] ?? null
    void setSelectedId(next?.id ?? null, { history: 'replace' })
  }

  let content: ReactNode
  if (list.isPending) {
    content = <LoadingRows rows={4} label="Loading approvals" />
  } else if (list.isError) {
    content = (
      <ErrorState
        title="Couldn't load approvals"
        error={list.error}
        onRetry={() => list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (items.length === 0 && !list.hasNextPage) {
    content =
      view === 'waiting' ? (
        <EmptyState
          icon={<ShieldCheck />}
          title="All clear. Nothing needs your approval."
          description="When an agent wants to run a tool that needs your sign-off, the request shows up here."
        />
      ) : (
        <EmptyState
          title="No resolved requests yet"
          description="Requests you approve or reject are kept here."
        />
      )
  } else {
    content = (
      <>
        {items.length > 0 ? (
          <ul className="flex flex-col gap-1" aria-label="Approval requests">
            {items.map((approval) => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                requester={requesterName(approval, lookup)}
                selected={approval.id === selectedId}
                onSelect={(id) => void setSelectedId(id)}
              />
            ))}
          </ul>
        ) : null}
        {list.hasNextPage ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-center"
            loading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Load more
          </Button>
        ) : null}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Agents pause here when an action needs your sign-off."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            loading={refreshing}
          >
            {refreshing ? null : <RefreshCw />}
            Refresh
          </Button>
        }
      />
      <SplitLayout>
        <SplitMain className="flex flex-col gap-3 bg-panel px-3 py-4 md:w-[360px] md:max-w-[400px] md:flex-none md:border-r md:border-line lg:w-[400px]">
          <SegmentedControl
            aria-label="Show approvals"
            className="self-start"
            value={view}
            onChange={(next: ApprovalView) => void setView(next)}
            options={[
              {
                value: 'waiting',
                label: 'Waiting',
                count: waitingCount.data
              },
              { value: 'resolved', label: 'Resolved' }
            ]}
          />
          <div className="flex flex-col gap-2">{content}</div>
          <p className="mt-auto flex items-center gap-1.5 px-1 pt-2 text-xs text-fg-3">
            <RefreshCw aria-hidden className="size-3.5" />
            Checks for new requests every 30 seconds
          </p>
        </SplitMain>
        {selectedId ? (
          <ApprovalDetail
            key={selectedId}
            approvalId={selectedId}
            placeholder={placeholder}
            onClose={() => void setSelectedId(null)}
            onResolved={onResolved}
          />
        ) : (
          <div className="hidden min-w-0 flex-1 items-center justify-center p-8 md:flex">
            <EmptyState
              icon={<ShieldCheck />}
              title="Select a request"
              description="Choose a request on the left to see what the agent wants to do before you approve or reject it."
              className="w-full max-w-md"
            />
          </div>
        )}
      </SplitLayout>
    </>
  )
}
