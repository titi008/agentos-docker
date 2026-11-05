'use client'

import { Badge, Chip } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/states'

import { useWorkflowSteps } from './queries'
import { KIND_ICON, KIND_LABEL, type ChatTarget } from './targets'

const MAX_CHIPS = 12

const CAPABILITY_LABEL = {
  agent: 'Can use',
  team: 'Team members',
  workflow: 'Steps'
} as const

const HINT = {
  agent: 'Ask a question, or attach a file to get started.',
  team: 'Describe what you need and the team will split up the work.',
  workflow: 'Describe what the workflow should work on, then send it.'
} as const

/** Introduces the target of a new chat: who it is and what it can use. */
export function BlankState({ target }: { target: ChatTarget }) {
  const Icon = KIND_ICON[target.kind]
  const workflowSteps = useWorkflowSteps(
    target.kind === 'workflow' ? target.id : null
  )
  const capabilities =
    target.kind === 'workflow'
      ? (workflowSteps.data ?? target.capabilities)
      : target.capabilities
  const shown = capabilities.slice(0, MAX_CHIPS)
  const hidden = capabilities.length - shown.length
  const loadingSteps = target.kind === 'workflow' && workflowSteps.isPending

  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-2.5 py-6 text-center">
      <span
        aria-hidden
        className="grid size-[52px] place-items-center rounded-[14px] bg-accent-soft text-accent"
      >
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col items-center gap-1">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h2 className="text-lg font-semibold">{target.name}</h2>
          <Badge>{KIND_LABEL[target.kind]}</Badge>
          {target.studioVersion !== null ? (
            <Badge tone="accent">Studio v{target.studioVersion}</Badge>
          ) : null}
        </div>
        <p className="text-sm text-pretty text-fg-2">
          {target.description ||
            `This ${KIND_LABEL[target.kind].toLowerCase()} has no description yet.`}
        </p>
      </div>
      {loadingSteps ? (
        <div className="flex gap-1.5" aria-hidden>
          <Skeleton className="h-[26px] w-24" />
          <Skeleton className="h-[26px] w-20" />
          <Skeleton className="h-[26px] w-28" />
        </div>
      ) : shown.length ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-[12.5px] text-fg-3">
            {CAPABILITY_LABEL[target.kind]}
          </span>
          {shown.map((name) => (
            <Chip
              key={name}
              className={
                target.kind === 'agent' ? 'font-mono text-xs' : undefined
              }
            >
              {name}
            </Chip>
          ))}
          {hidden > 0 ? (
            <span className="text-[12.5px] text-fg-3">and {hidden} more</span>
          ) : null}
        </div>
      ) : null}
      <p className="text-[12.5px] text-fg-3">{HINT[target.kind]}</p>
    </div>
  )
}
