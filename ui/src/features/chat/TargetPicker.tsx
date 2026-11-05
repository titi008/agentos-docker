'use client'

import { Command } from 'cmdk'
import { Check, ChevronDown, Info, Search } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { SegmentedControl } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/states'
import { CREATE_LINKS } from '@/components/shell/nav'
import { cn } from '@/lib/utils'
import type { ChatMode } from '@/store'

import {
  capabilitySummary,
  KIND_ICON,
  KIND_LABEL,
  kindBadge,
  type ChatTarget
} from './targets'
import type { ChatTargetStatus } from './useChatTarget'

type Filter = 'all' | ChatMode

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'agent', label: 'Agents' },
  { value: 'team', label: 'Teams' },
  { value: 'workflow', label: 'Workflows' }
]

const itemClass =
  'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none select-none data-[selected=true]:bg-hover'

const groupClass =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3'

function TargetItem({
  target,
  current,
  onSelect
}: {
  target: ChatTarget
  current: boolean
  onSelect: () => void
}) {
  const Icon = KIND_ICON[target.kind]
  return (
    <Command.Item
      value={`${target.kind}:${target.id}`}
      keywords={[target.name, target.id, target.description]}
      onSelect={onSelect}
      aria-current={current || undefined}
      className={cn(itemClass, current && 'bg-accent-soft')}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-[30px] shrink-0 place-items-center rounded-lg',
          current ? 'bg-accent-soft text-accent' : 'bg-hover text-fg-2'
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] font-medium text-fg">
          {target.name}
        </span>
        {target.description ? (
          <span className="truncate text-xs text-fg-3">
            {target.description}
          </span>
        ) : null}
      </span>
      {target.studioVersion !== null ? (
        <Badge tone="accent">Studio v{target.studioVersion}</Badge>
      ) : (
        <Badge className="max-md:hidden">{kindBadge(target)}</Badge>
      )}
      <Check
        aria-hidden
        className={cn('size-4 shrink-0 text-accent', !current && 'invisible')}
      />
    </Command.Item>
  )
}

function TriggerContent({
  target,
  status,
  requested
}: {
  target: ChatTarget | null
  status: ChatTargetStatus
  requested: { kind: ChatMode; id: string } | null
}) {
  if (target) {
    const Icon = KIND_ICON[target.kind]
    const summary = capabilitySummary(target)
    const line = [target.description, summary].filter(Boolean).join(' · ')
    return (
      <>
        <span
          aria-hidden
          className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
        >
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{target.name}</span>
            <Badge className="max-md:hidden">{KIND_LABEL[target.kind]}</Badge>
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-fg-3 md:hidden">
            <Badge className="h-5">{KIND_LABEL[target.kind]}</Badge>
            {summary ? <span className="truncate">{summary}</span> : null}
          </span>
          {line ? (
            <span className="truncate text-xs text-fg-3 max-md:hidden">
              {line}
            </span>
          ) : null}
        </span>
      </>
    )
  }

  if (status === 'connecting' || status === 'loading') {
    return (
      <>
        <Skeleton className="size-[30px] shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5" aria-hidden>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-40 max-w-full" />
        </span>
        <span className="sr-only">Loading agents, teams and workflows</span>
      </>
    )
  }

  const label =
    status === 'missing' && requested
      ? requested.id
      : status === 'offline'
        ? 'Not connected'
        : status === 'empty'
          ? 'Nothing to chat with yet'
          : 'Choose who to talk to'
  return (
    <span className="flex min-w-0 flex-1 flex-col px-1.5">
      <span className="truncate font-semibold">{label}</span>
      <span className="truncate text-xs text-fg-3">
        {status === 'missing' && requested
          ? `${KIND_LABEL[requested.kind]} not found`
          : 'Pick an agent, team or workflow'}
      </span>
    </span>
  )
}

interface TargetPickerProps {
  target: ChatTarget | null
  targets: ChatTarget[]
  status: ChatTargetStatus
  requested: { kind: ChatMode; id: string } | null
  onSelect: (target: ChatTarget) => void
  className?: string
}

/**
 * Who the chat talks to. Lists agents, teams and workflows with a type
 * filter and search; internal platform agents come last.
 */
export function TargetPicker({
  target,
  targets,
  status,
  requested,
  onSelect,
  className
}: TargetPickerProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  const visible = (kind: ChatMode) => filter === 'all' || filter === kind
  const groups: { heading: string; items: ChatTarget[] }[] = [
    {
      heading: 'Teams',
      items: visible('team')
        ? targets.filter((item) => item.kind === 'team')
        : []
    },
    {
      heading: 'Agents',
      items: visible('agent')
        ? targets.filter((item) => item.kind === 'agent' && !item.internal)
        : []
    },
    {
      heading: 'Workflows',
      items: visible('workflow')
        ? targets.filter((item) => item.kind === 'workflow')
        : []
    },
    {
      heading: 'Internal',
      items: visible('agent')
        ? targets.filter((item) => item.kind === 'agent' && item.internal)
        : []
    }
  ].filter((group) => group.items.length > 0)

  const counts = {
    all: targets.length,
    agent: targets.filter((item) => item.kind === 'agent').length,
    team: targets.filter((item) => item.kind === 'team').length,
    workflow: targets.filter((item) => item.kind === 'workflow').length
  }

  const ariaLabel = target
    ? `Talking to ${target.name}, ${KIND_LABEL[target.kind].toLowerCase()}. Change who you are talking to`
    : 'Choose who to talk to'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={status === 'connecting' || status === 'loading'}
          className={cn(
            'flex min-w-0 items-center gap-2.5 rounded-[10px] border border-line bg-surface py-1.5 pr-2.5 pl-1.5 text-left transition-colors hover:bg-hover disabled:cursor-default disabled:hover:bg-surface',
            'data-[state=open]:border-accent data-[state=open]:ring-[3px] data-[state=open]:ring-accent-soft',
            'max-md:min-h-12 max-md:rounded-xl',
            className
          )}
        >
          <TriggerContent
            target={target}
            status={status}
            requested={requested}
          />
          <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Choose who to talk to"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
        className="flex w-[min(440px,calc(100vw-24px))] flex-col p-0"
      >
        {targets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="font-medium">Nothing to chat with yet</p>
            <p className="text-[13px] text-fg-3">
              {status === 'offline'
                ? 'AgentOS can’t be reached. Check the host in Settings.'
                : 'This AgentOS has no agents, teams or workflows. Create one in Studio.'}
            </p>
            <div className="mt-1 flex gap-2">
              {status === 'offline' ? null : (
                <Button size="sm" variant="primary" asChild>
                  <Link
                    href={CREATE_LINKS.agent}
                    onClick={() => setOpen(false)}
                  >
                    Create an agent
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="ghost" asChild>
                <Link href="/settings" onClick={() => setOpen(false)}>
                  Settings
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-3 pt-3">
              <SegmentedControl
                aria-label="Filter by type"
                value={filter}
                onChange={setFilter}
                options={FILTERS.map((option) => ({
                  value: option.value,
                  label: option.label,
                  count: counts[option.value]
                }))}
              />
            </div>
            <Command loop className="flex min-h-0 flex-col">
              <div className="relative px-3 pt-2.5 pb-2">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-fg-3"
                />
                <Command.Input
                  ref={searchRef}
                  placeholder="Search agents, teams and workflows"
                  aria-label="Search agents, teams and workflows"
                  className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm text-fg outline-none placeholder:text-fg-3 focus-visible:border-accent max-md:min-h-11 max-md:text-base"
                />
              </div>
              <Command.List className="max-h-[min(360px,50dvh)] overflow-y-auto px-1.5 pb-1.5">
                <Command.Empty className="px-3 py-6 text-center text-[13px] text-fg-3">
                  Nothing matches. Try another name or type.
                </Command.Empty>
                {groups.map((group) => (
                  <Command.Group
                    key={group.heading}
                    heading={group.heading}
                    className={groupClass}
                  >
                    {group.items.map((item) => (
                      <TargetItem
                        key={`${item.kind}:${item.id}`}
                        target={item}
                        current={
                          target?.kind === item.kind && target.id === item.id
                        }
                        onSelect={() => {
                          setOpen(false)
                          if (
                            target?.kind !== item.kind ||
                            target.id !== item.id
                          ) {
                            onSelect(item)
                          }
                        }}
                      />
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
            <p className="flex items-center gap-2 border-t border-line px-3.5 py-2.5 text-[12.5px] text-fg-3">
              <Info aria-hidden className="size-4 shrink-0" />
              Switching starts a new chat. Your current chat stays in the list.
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
