'use client'

import { Command } from 'cmdk'
import {
  ArrowRight,
  Bot,
  FilePlus2,
  FolderPlus,
  GitBranch,
  MessageSquare,
  PackagePlus,
  Plus,
  SlidersHorizontal,
  Upload,
  Users
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

import { useStore } from '@/store'

import {
  chatHref,
  CREATE_LINKS,
  NAV_GROUPS,
  SECTIONS,
  SETTINGS_NAV
} from './nav'

const itemClass =
  'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13.5px] text-fg-2 outline-none select-none data-[selected=true]:bg-hover data-[selected=true]:text-fg max-md:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-3'

const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3'

function Item({
  value,
  icon,
  children,
  hint,
  onSelect
}: {
  value: string
  icon: ReactNode
  children: ReactNode
  hint?: ReactNode
  onSelect: () => void
}) {
  return (
    <Command.Item value={value} onSelect={onSelect} className={itemClass}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <span className="shrink-0 text-xs text-fg-3">{hint}</span> : null}
    </Command.Item>
  )
}

/** ⌘K / Ctrl+K: jump to any page, start a chat or run a create action. */
export function CommandPalette() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const open = useStore((state) => state.isCommandPaletteOpen)
  const setOpen = useStore((state) => state.setIsCommandPaletteOpen)
  const agents = useStore((state) => state.agents)
  const teams = useStore((state) => state.teams)
  const workflows = useStore((state) => state.workflows)
  const sessions = useStore((state) => state.sessionsData)
  const pending = useStore((state) => state.pendingApprovalsCount)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(!useStore.getState().isCommandPaletteOpen)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const chatTarget = (['agent', 'team', 'workflow'] as const)
    .map((kind) => ({ kind, id: searchParams.get(kind) }))
    .find((target) => target.id)
  const recentChats = chatTarget ? (sessions ?? []).slice(0, 5) : []
  const visibleAgents = agents.filter(
    (agent) => !agent.id?.endsWith('-internal')
  )

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search or jump to"
      loop
      overlayClassName="fixed inset-0 z-50 bg-scrim animate-fade-in"
      contentClassName="fixed inset-x-3 top-[12dvh] z-50 mx-auto max-w-[640px] animate-pop-in overflow-hidden rounded-[14px] border border-line bg-raised text-fg shadow-pop"
    >
      <div className="border-b border-line px-4">
        <Command.Input
          placeholder="Search pages, agents, chats and actions…"
          className="h-13 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-3"
        />
      </div>
      <Command.List className="max-h-[min(60dvh,440px)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-[13px] text-fg-3">
          No matches. Try a page name, an agent or an action.
        </Command.Empty>

        <Command.Group heading="Jump to" className={groupClass}>
          {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
            <Item
              key={item.href}
              value={`go ${item.label}`}
              icon={<item.icon />}
              hint={
                item.badge === 'approvals' && pending
                  ? `${pending} waiting`
                  : undefined
              }
              onSelect={() => go(item.href)}
            >
              {item.label}
            </Item>
          ))}
          {Object.values(SECTIONS).flatMap((section) =>
            section.tabs.map((tab) => (
              <Item
                key={tab.href}
                value={`go ${section.title} ${tab.label}`}
                icon={<ArrowRight />}
                onSelect={() => go(tab.href)}
              >
                {section.title} · {tab.label}
              </Item>
            ))
          )}
          <Item
            value="go settings connection token theme"
            icon={<SETTINGS_NAV.icon />}
            onSelect={() => go(SETTINGS_NAV.href)}
          >
            Settings
          </Item>
        </Command.Group>

        {visibleAgents.length + teams.length + workflows.length > 0 ? (
          <Command.Group heading="Start a chat with" className={groupClass}>
            {teams.map((team) => (
              <Item
                key={`team-${team.id}`}
                value={`chat team ${team.name ?? ''} ${team.id}`}
                icon={<Users />}
                hint="Team"
                onSelect={() => go(chatHref('team', team.id))}
              >
                {team.name || team.id}
              </Item>
            ))}
            {visibleAgents.map((agent) => (
              <Item
                key={`agent-${agent.id}`}
                value={`chat agent ${agent.name ?? ''} ${agent.id}`}
                icon={<Bot />}
                hint="Agent"
                onSelect={() => go(chatHref('agent', agent.id))}
              >
                {agent.name || agent.id}
              </Item>
            ))}
            {workflows.map((workflow) => (
              <Item
                key={`workflow-${workflow.id}`}
                value={`chat workflow ${workflow.name ?? ''} ${workflow.id}`}
                icon={<GitBranch />}
                hint="Workflow"
                onSelect={() => go(chatHref('workflow', workflow.id))}
              >
                {workflow.name || workflow.id}
              </Item>
            ))}
          </Command.Group>
        ) : null}

        {chatTarget && recentChats.length > 0 ? (
          <Command.Group heading="Recent chats" className={groupClass}>
            {recentChats.map((session) => (
              <Item
                key={session.session_id}
                value={`recent chat ${session.session_name ?? ''} ${session.session_id}`}
                icon={<MessageSquare />}
                onSelect={() =>
                  go(
                    chatHref(
                      chatTarget.kind,
                      chatTarget.id as string,
                      session.session_id
                    )
                  )
                }
              >
                {session.session_name || 'Untitled chat'}
              </Item>
            ))}
          </Command.Group>
        ) : null}

        <Command.Group heading="Actions" className={groupClass}>
          <Item
            value="new task"
            icon={<Plus />}
            onSelect={() => go(CREATE_LINKS.task)}
          >
            New task
          </Item>
          <Item
            value="new product"
            icon={<PackagePlus />}
            onSelect={() => go(CREATE_LINKS.product)}
          >
            New product
          </Item>
          <Item
            value="new project"
            icon={<FolderPlus />}
            onSelect={() => go(CREATE_LINKS.project)}
          >
            New project
          </Item>
          <Item
            value="new wiki page"
            icon={<FilePlus2 />}
            onSelect={() => go(CREATE_LINKS.wikiPage)}
          >
            New wiki page
          </Item>
          <Item
            value="new agent"
            icon={<Bot />}
            onSelect={() => go(CREATE_LINKS.agent)}
          >
            New agent
          </Item>
          <Item
            value="new team"
            icon={<Users />}
            onSelect={() => go(CREATE_LINKS.team)}
          >
            New team
          </Item>
          <Item
            value="new workflow"
            icon={<GitBranch />}
            onSelect={() => go(CREATE_LINKS.workflow)}
          >
            New workflow
          </Item>
          <Item
            value="add document knowledge upload"
            icon={<Upload />}
            onSelect={() => go(CREATE_LINKS.document)}
          >
            Add document
          </Item>
          <Item
            value="add memory"
            icon={<Plus />}
            onSelect={() => go(CREATE_LINKS.memory)}
          >
            Add memory
          </Item>
          <Item
            value="connection settings host token"
            icon={<SlidersHorizontal />}
            onSelect={() => go('/settings')}
          >
            Connection settings
          </Item>
        </Command.Group>
      </Command.List>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-fg-3 max-md:hidden">
        <span>↑↓ to move</span>
        <span>↵ to open</span>
        <span>esc to close</span>
      </div>
    </Command.Dialog>
  )
}
