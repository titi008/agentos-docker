'use client'

import { Command } from 'cmdk'
import { Check, ChevronDown, GitBranch, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { ProviderIcon } from '@/components/ui/icon/ProviderIcon'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import type { AvailableModel } from '@/types/os'

import { FALLBACK_MODELS, useModelsQuery } from './queries'
import { KIND_LABEL, type ChatTarget } from './targets'

const itemClass =
  'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-fg-2 outline-none select-none data-[selected=true]:bg-hover data-[selected=true]:text-fg max-md:min-h-11'

const groupClass =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3'

/**
 * The model this chat's runs use: the chosen override, else the target's
 * own. `overridden` is true when it differs from the target's model.
 */
export function useChatModel(target: ChatTarget | null) {
  const selected = useStore((state) => state.selectedModel)
  const current = selected || target?.modelId || null
  return {
    current,
    overridden: Boolean(selected) && selected !== target?.modelId
  }
}

function ModelItem({
  model,
  note,
  checked,
  onSelect
}: {
  model: AvailableModel
  note: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <Command.Item
      value={`${model.id} ${model.provider}`}
      onSelect={onSelect}
      className={cn(itemClass, checked && 'text-fg')}
    >
      <ProviderIcon provider={`${model.provider} ${model.id}`} />
      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
        {model.id}
      </span>
      <span className="shrink-0 text-xs text-fg-3">{note}</span>
      <Check
        aria-hidden
        className={cn('size-4 shrink-0 text-accent', !checked && 'invisible')}
      />
    </Command.Item>
  )
}

/** Searchable model list; picking one sets the X-Model-Override for this chat. */
function ModelOptions({
  target,
  onDone
}: {
  target: ChatTarget
  onDone: () => void
}) {
  const models = useModelsQuery()
  const { current } = useChatModel(target)
  const inSession = useStore((state) => Boolean(state.activeChat?.sessionId))
  const setSelectedModel = useStore((state) => state.setSelectedModel)
  const available = models.data?.length ? models.data : FALLBACK_MODELS
  const defaultModel: AvailableModel | null = target.modelId
    ? {
        id: target.modelId,
        provider:
          target.modelProvider ??
          available.find((model) => model.id === target.modelId)?.provider ??
          ''
      }
    : null
  const others = available.filter((model) => model.id !== target.modelId)
  const kindLabel = KIND_LABEL[target.kind].toLowerCase()

  const pick = (id: string) => {
    onDone()
    if (id === current) return
    if (id === target.modelId) {
      // A saved chat remembers its override, so replace it explicitly;
      // a new chat simply sends no override.
      setSelectedModel(inSession ? id : '')
      toast.success(`Model for this chat reset to the ${kindLabel}'s default`)
      return
    }
    setSelectedModel(id)
    toast.success(`Model for this chat set to ${id}`, {
      description: `Used for the messages you send in this chat from now on. The ${kindLabel}'s saved model doesn't change.`
    })
  }

  return (
    <Command loop className="flex min-h-0 flex-col">
      <div className="relative p-2 pb-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-fg-3"
        />
        <Command.Input
          placeholder="Search models"
          aria-label="Search models"
          className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm text-fg outline-none placeholder:text-fg-3 focus-visible:border-accent max-md:min-h-11"
        />
      </div>
      <Command.List className="max-h-[min(320px,50dvh)] overflow-y-auto px-1.5 pb-1.5 max-md:max-h-none">
        <Command.Empty className="px-3 py-6 text-center text-[13px] text-fg-3">
          No models match.
        </Command.Empty>
        {defaultModel ? (
          <Command.Group heading="Default" className={groupClass}>
            <ModelItem
              model={defaultModel}
              note={`${KIND_LABEL[target.kind]} default`}
              checked={current === defaultModel.id}
              onSelect={() => pick(defaultModel.id)}
            />
          </Command.Group>
        ) : null}
        <Command.Group heading="Available models" className={groupClass}>
          {others.map((model) => (
            <ModelItem
              key={model.id}
              model={model}
              note={model.provider}
              checked={current === model.id}
              onSelect={() => pick(model.id)}
            />
          ))}
        </Command.Group>
      </Command.List>
      <div className="flex flex-col gap-1 border-t border-line px-3.5 py-2.5 text-xs text-fg-3">
        <p>
          Sent as a model override with your messages and remembered by this
          chat. The {kindLabel}&apos;s saved model doesn&apos;t change, and
          agents without override support keep their own model.
        </p>
        {models.isError ? (
          <p>
            The server&apos;s model list couldn&apos;t be loaded, so common
            models are shown.
          </p>
        ) : null}
      </div>
    </Command>
  )
}

/** Header control ("Model for this chat"); workflows show their pipeline instead. */
export function ModelPicker({ target }: { target: ChatTarget }) {
  const [open, setOpen] = useState(false)
  const { current, overridden } = useChatModel(target)

  if (target.kind === 'workflow') {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-2.5 text-[12.5px] text-fg-2 [&_svg]:size-3.5">
        <GitBranch aria-hidden />
        Workflow pipeline
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          aria-label={`Model for this chat: ${current ?? 'default'}${overridden ? ' (override)' : ''}`}
        >
          <ProviderIcon provider={current} className="size-3.5" />
          <span className="max-w-[200px] truncate font-mono text-xs">
            {current ?? 'Default model'}
          </span>
          {overridden ? (
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          ) : null}
          <ChevronDown aria-hidden className="text-fg-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Model for this chat"
        className="flex w-[min(380px,calc(100vw-24px))] flex-col p-0"
      >
        <ModelOptions target={target} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

/** Phone variant, opened from the chat options menu. */
export function ModelDialog({
  target,
  open,
  onOpenChange
}: {
  target: ChatTarget
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Model for this chat"
      size="sm"
    >
      <div className="-m-5">
        <ModelOptions target={target} onDone={() => onOpenChange(false)} />
      </div>
    </Modal>
  )
}
