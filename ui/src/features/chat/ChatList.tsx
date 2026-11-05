'use client'

import type { UseInfiniteQueryResult } from '@tanstack/react-query'
import {
  Ellipsis,
  MessagesSquare,
  Pencil,
  SquarePen,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useId, useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { ErrorState, Skeleton, Spinner } from '@/components/ui/states'
import { formatDateTime, toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { SessionEntry } from '@/types/os'

import { chatTimeLabel, chatTitle, groupChats, type ChatGroup } from './format'
import type { SessionsData } from './queries'
import { KIND_LABEL, type ChatTarget } from './targets'
import type { ChatTargetStatus } from './useChatTarget'

function ListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-1 px-1 pt-2">
      <span className="sr-only">Loading chats…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="flex flex-col gap-1.5 px-2.5 py-2"
        >
          <Skeleton className={cn('h-3.5', index % 2 ? 'w-3/5' : 'w-4/5')} />
          <Skeleton className="h-2.5 w-14" />
        </div>
      ))}
    </div>
  )
}

function ListNote({
  title,
  children,
  action
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center">
      <MessagesSquare aria-hidden className="size-5 text-fg-3" />
      <p className="text-[13.5px] font-medium text-fg">{title}</p>
      {children ? (
        <div className="text-[13px] text-fg-3">{children}</div>
      ) : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  )
}

interface ChatListItemProps {
  session: SessionEntry
  group: ChatGroup
  href: string
  active: boolean
  deleting: boolean
  onNavigate?: () => void
  onRename: (session: SessionEntry) => void
  onDelete: (session: SessionEntry) => void
}

function ChatListItem({
  session,
  group,
  href,
  active,
  deleting,
  onNavigate,
  onRename,
  onDelete
}: ChatListItemProps) {
  const title = chatTitle(session)
  const date = toDate(session.created_at)
  return (
    <li
      className={cn(
        'flex items-start gap-1 rounded-lg py-1 pr-1 pl-2.5 transition-colors hover:bg-hover max-md:min-h-14',
        active &&
          'bg-raised shadow-[inset_0_0_0_1px_var(--line)] hover:bg-raised',
        deleting && 'opacity-60'
      )}
    >
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'true' : undefined}
        className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md py-1 outline-offset-0"
      >
        <span className="line-clamp-2 text-[13.5px] font-medium break-words text-fg max-md:text-sm">
          {title}
        </span>
        {date ? (
          <time
            dateTime={date.toISOString()}
            title={formatDateTime(date)}
            className="text-xs text-fg-3"
            suppressHydrationWarning
          >
            {chatTimeLabel(date, group)}
          </time>
        ) : null}
      </Link>
      {deleting ? (
        <span className="grid size-8 shrink-0 place-items-center max-md:size-11">
          <Spinner />
          <span className="sr-only">Deleting {title}</span>
        </span>
      ) : (
        <Menu modal={false}>
          <MenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Chat options for “${title}”: rename or delete`}
            >
              <Ellipsis />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => onRename(session)}>
              <Pencil />
              Rename
            </MenuItem>
            <MenuItem tone="danger" onSelect={() => onDelete(session)}>
              <Trash2 />
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </li>
  )
}

interface ChatListProps {
  target: ChatTarget | null
  targetStatus: ChatTargetStatus
  sessions: UseInfiniteQueryResult<SessionsData>
  activeSessionId: string | null
  deletingSessionId: string | null
  hrefFor: (sessionId: string) => string
  onNewChat: () => void
  onRename: (session: SessionEntry) => void
  onDelete: (session: SessionEntry) => void
  /** Called after opening a chat or starting a new one (closes the sheet). */
  onNavigate?: () => void
  /** Close button when the list is shown in a sheet. */
  closeButton?: ReactNode
}

/** Chats with the current target: search, day groups, rename and delete. */
export function ChatList({
  target,
  targetStatus,
  sessions,
  activeSessionId,
  deletingSessionId,
  hrefFor,
  onNewChat,
  onRename,
  onDelete,
  onNavigate,
  closeButton
}: ChatListProps) {
  const [search, setSearch] = useState('')
  const headingId = useId()
  const all = useMemo(() => {
    const seen = new Set<string>()
    return (sessions.data?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((session) => {
        if (seen.has(session.session_id)) return false
        seen.add(session.session_id)
        return true
      })
  }, [sessions.data])
  const query = search.trim().toLowerCase()
  const filtered = query
    ? all.filter((session) => chatTitle(session).toLowerCase().includes(query))
    : all
  const groups = groupChats(filtered)
  const noun = target?.kind === 'workflow' ? 'runs' : 'chats'

  const newChatButton = (
    <Button
      variant="primary"
      size="sm"
      onClick={() => {
        onNewChat()
        onNavigate?.()
      }}
      disabled={!target}
      className={closeButton ? 'w-full max-md:min-h-11' : undefined}
    >
      <SquarePen />
      New chat
    </Button>
  )

  let body: ReactNode
  if (!target) {
    body =
      targetStatus === 'connecting' || targetStatus === 'loading' ? (
        <ListSkeleton />
      ) : (
        <ListNote
          title={
            targetStatus === 'offline' ? 'Not connected' : 'No chats to show'
          }
        >
          {targetStatus === 'offline'
            ? 'Your chats appear once AgentOS is reachable.'
            : targetStatus === 'empty'
              ? 'Create an agent, team or workflow in Studio to start chatting.'
              : 'Choose an agent, team or workflow to see its chats.'}
        </ListNote>
      )
  } else if (sessions.isPending) {
    body = <ListSkeleton />
  } else if (sessions.isError && !all.length) {
    body = (
      <ErrorState
        compact
        title="Couldn't load chats"
        error={sessions.error}
        onRetry={() => void sessions.refetch()}
        retrying={sessions.isFetching}
      />
    )
  } else if (!all.length) {
    body = (
      <ListNote
        title={target.kind === 'workflow' ? 'No runs yet' : 'No chats yet'}
      >
        {target.kind === 'agent'
          ? `Your chats with ${target.name} appear here.`
          : target.kind === 'team'
            ? `Your chats with the ${target.name} team appear here.`
            : `Each time you run ${target.name} from here, it appears in this list.`}
      </ListNote>
    )
  } else if (!filtered.length) {
    body = (
      <ListNote
        title={`No ${noun} match “${search.trim()}”`}
        action={
          <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
            Clear search
          </Button>
        }
      >
        {sessions.hasNextPage
          ? `Only loaded ${noun} are searched. Load older ones below.`
          : null}
      </ListNote>
    )
  } else {
    body = groups.map((group) => (
      <section key={group.label} aria-label={group.label}>
        <h3 className="px-2.5 pt-2.5 pb-1 text-xs font-medium text-fg-3">
          {group.label}
        </h3>
        <ul className="flex flex-col gap-0.5">
          {group.items.map((session) => (
            <ChatListItem
              key={session.session_id}
              session={session}
              group={group.label}
              href={hrefFor(session.session_id)}
              active={session.session_id === activeSessionId}
              deleting={session.session_id === deletingSessionId}
              onNavigate={onNavigate}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </section>
    ))
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex h-full min-h-0 flex-col gap-3 px-3 pt-4 pb-3"
    >
      <div className="flex items-center gap-2 px-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id={headingId} className="text-[15px] font-semibold">
            Chats
          </h2>
          {target ? (
            <span className="truncate text-xs text-fg-3">
              with {target.name}
              <span className="sr-only">, {KIND_LABEL[target.kind]}</span>
            </span>
          ) : null}
        </div>
        {closeButton ? closeButton : newChatButton}
      </div>
      {closeButton ? newChatButton : null}
      <SearchInput
        aria-label={`Search ${noun}`}
        placeholder={`Search ${noun}`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={!target || !all.length}
        className="max-md:[&_input]:text-base"
      />
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {body}
        {target && sessions.hasNextPage && all.length ? (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void sessions.fetchNextPage()}
              loading={sessions.isFetchingNextPage}
            >
              Load older {noun}
            </Button>
          </div>
        ) : null}
        {sessions.isError && all.length ? (
          <ErrorState
            compact
            className="mt-2"
            title="Couldn't refresh chats"
            error={sessions.error}
            onRetry={() => void sessions.refetch()}
            retrying={sessions.isFetching}
          />
        ) : null}
      </div>
    </section>
  )
}
