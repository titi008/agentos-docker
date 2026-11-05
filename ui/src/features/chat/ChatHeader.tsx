'use client'

import { Ellipsis, PanelLeft, Pencil, SquarePen, Trash2 } from 'lucide-react'

import { ProviderIcon } from '@/components/ui/icon/ProviderIcon'
import { Button } from '@/components/ui/button'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger
} from '@/components/ui/menu'
import type { ChatMode } from '@/store'

import { ModelPicker, useChatModel } from './ModelPicker'
import type { ChatTarget } from './targets'
import { TargetPicker } from './TargetPicker'
import type { ChatTargetStatus } from './useChatTarget'

interface ChatHeaderProps {
  target: ChatTarget | null
  targets: ChatTarget[]
  status: ChatTargetStatus
  requested: { kind: ChatMode; id: string } | null
  chatsOpen: boolean
  hasSession: boolean
  onOpenChats: () => void
  onSelectTarget: (target: ChatTarget) => void
  onNewChat: () => void
  onRename: () => void
  onDelete: () => void
  onOpenModel: () => void
}

/**
 * Chat top bar: the chat list toggle (below 1280px), who you're talking to,
 * the model for this chat (in the options menu on phones) and chat options.
 */
export function ChatHeader({
  target,
  targets,
  status,
  requested,
  chatsOpen,
  hasSession,
  onOpenChats,
  onSelectTarget,
  onNewChat,
  onRename,
  onDelete,
  onOpenModel
}: ChatHeaderProps) {
  const { current } = useChatModel(target)

  return (
    <header className="flex min-h-[60px] shrink-0 items-center gap-3 border-b border-line px-6 py-2.5 max-md:min-h-0 max-md:gap-1.5 max-md:bg-canvas max-md:px-2 max-md:py-1.5">
      <h1 className="sr-only">
        {target ? `Chat with ${target.name}` : 'Chat'}
      </h1>
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenChats}
        aria-expanded={chatsOpen}
        aria-haspopup="dialog"
        className="max-md:h-11 max-md:px-2.5 xl:hidden"
      >
        <PanelLeft />
        Chats
      </Button>
      <TargetPicker
        target={target}
        targets={targets}
        status={status}
        requested={requested}
        onSelect={onSelectTarget}
        className="max-md:flex-1 md:max-w-[min(440px,45vw)]"
      />
      <div className="flex-1 max-md:hidden" />
      {target ? (
        <div className="flex items-center gap-2 max-md:hidden">
          <span className="text-[12.5px] text-fg-3 max-lg:hidden">
            Model for this chat
          </span>
          <ModelPicker target={target} />
        </div>
      ) : null}
      <Menu modal={false}>
        <MenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Chat options"
            className="max-md:size-11"
          >
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent align="end" className="w-60">
          {target ? (
            <div className="md:hidden">
              <MenuLabel>Model for this chat</MenuLabel>
              <MenuItem
                onSelect={onOpenModel}
                disabled={target.kind === 'workflow'}
              >
                <ProviderIcon provider={current} />
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
                  {target.kind === 'workflow'
                    ? 'Workflow pipeline'
                    : (current ?? 'Default model')}
                </span>
              </MenuItem>
              <MenuSeparator />
            </div>
          ) : null}
          <MenuItem onSelect={onNewChat} disabled={!target}>
            <SquarePen />
            New chat
          </MenuItem>
          <MenuItem onSelect={onRename} disabled={!hasSession}>
            <Pencil />
            Rename chat
          </MenuItem>
          <MenuItem tone="danger" onSelect={onDelete} disabled={!hasSession}>
            <Trash2 />
            Delete chat
          </MenuItem>
        </MenuContent>
      </Menu>
    </header>
  )
}
