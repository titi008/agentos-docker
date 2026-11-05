'use client'

import { PanelLeft, Search, ShieldCheck, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { normalizeEndpoint } from '@/api/client'
import { AgnoLogo } from '@/components/ui/icon/ProviderIcon'
import { Tooltip } from '@/components/ui/menu'
import { useIdentityQuery } from '@/features/workspace/queries'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'

import { isNavActive, NAV_GROUPS, SETTINGS_NAV, type NavItem } from './nav'

function hostLabel(endpoint: string): string {
  try {
    return new URL(normalizeEndpoint(endpoint)).host
  } catch {
    return endpoint || 'No host set'
  }
}

export function ConnectionLine({ className }: { className?: string }) {
  const endpoint = useStore((state) => state.selectedEndpoint)
  const active = useStore((state) => state.isEndpointActive)
  const loading = useStore((state) => state.isEndpointLoading)
  const status = loading ? 'Connecting' : active ? 'Connected' : 'Offline'
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1.5 text-xs text-fg-3',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-[7px] shrink-0 rounded-full',
          loading ? 'bg-warn' : active ? 'bg-ok' : 'bg-bad'
        )}
      />
      <span className="truncate">
        {status} · {hostLabel(endpoint)}
      </span>
    </span>
  )
}

function NavLink({
  item,
  collapsed,
  onNavigate
}: {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const pending = useStore((state) => state.pendingApprovalsCount)
  const active = isNavActive(item, pathname)
  const count = item.badge === 'approvals' ? pending : 0
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={
        collapsed || count
          ? `${item.label}${count ? `, ${count} waiting` : ''}`
          : undefined
      }
      className={cn(
        'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 font-medium transition-colors max-md:min-h-11',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-raised text-fg shadow-[inset_0_0_0_1px_var(--line)]'
          : 'text-fg-2 hover:bg-hover hover:text-fg'
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-4 shrink-0', active && 'text-accent')}
      />
      {collapsed ? null : <span className="truncate">{item.label}</span>}
      {count > 0 ? (
        collapsed ? (
          <span
            aria-hidden
            className="absolute top-1.5 right-2 size-2 rounded-full bg-accent-fill"
          />
        ) : (
          <span
            aria-hidden
            className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent-fill px-1.5 text-[11.5px] font-semibold text-white"
          >
            {count}
          </span>
        )
      ) : null}
    </Link>
  )

  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

interface SidebarContentProps {
  collapsed?: boolean
  onToggleCollapsed?: () => void
  /** Called after any navigation (closes the phone menu). */
  onNavigate?: () => void
  /** Extra control in the header row, e.g. the phone menu's close button. */
  headerAction?: React.ReactNode
}

export function SidebarContent({
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  headerAction
}: SidebarContentProps) {
  const setPaletteOpen = useStore((state) => state.setIsCommandPaletteOpen)
  const userId = useStore((state) => state.userId)
  const identity = useIdentityQuery()
  const zeroTrust = identity.data?.is_authenticated ?? false

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5">
      <div
        className={cn('flex items-center gap-1', collapsed && 'flex-col gap-2')}
      >
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-1.5 hover:bg-hover',
            collapsed && 'flex-none'
          )}
          aria-label="AgentOS connection settings"
        >
          <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-surface ring-1 ring-line">
            <AgnoLogo className="size-[18px]" />
          </span>
          {collapsed ? null : (
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">AgentOS</span>
              <ConnectionLine />
            </span>
          )}
        </Link>
        {onToggleCollapsed ? (
          <Tooltip
            content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            side="right"
          >
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-3 hover:bg-hover hover:text-fg"
            >
              <PanelLeft aria-hidden className="size-4" />
            </button>
          </Tooltip>
        ) : null}
        {headerAction}
      </div>

      <button
        type="button"
        onClick={() => {
          onNavigate?.()
          setPaletteOpen(true)
        }}
        aria-label="Search or jump to (Command K)"
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2 max-md:min-h-11',
          collapsed && 'justify-center px-0'
        )}
      >
        <Search aria-hidden className="size-4 shrink-0" />
        {collapsed ? null : (
          <>
            <span className="truncate">Search or jump to…</span>
            <kbd className="ml-auto rounded-[5px] border border-line-strong px-1.5 font-mono text-[11px] leading-[18px] text-fg-3 max-md:hidden">
              ⌘K
            </kbd>
          </>
        )}
      </button>

      <nav
        aria-label="Main"
        className="flex min-h-0 flex-col gap-0.5 overflow-y-auto"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {collapsed ? (
              <div className="mx-2 my-2 h-px bg-line" aria-hidden />
            ) : (
              <div className="px-2.5 pt-2 pb-1 text-xs font-medium text-fg-3">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      <nav aria-label="Account" className="flex flex-col gap-0.5">
        <NavLink
          item={SETTINGS_NAV}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </nav>

      <div
        className={cn(
          'flex items-center gap-2.5 rounded-[10px] border border-line bg-surface p-2',
          collapsed && 'justify-center border-transparent bg-transparent p-0'
        )}
        title={collapsed ? userId : undefined}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-xs font-semibold uppercase">
          {userId ? userId.charAt(0) : <User className="size-3.5" />}
        </span>
        {collapsed ? null : (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium">{userId}</span>
            <span className="flex items-center gap-1 text-xs text-fg-3">
              {zeroTrust ? (
                <>
                  <ShieldCheck aria-hidden className="size-3 text-ok" />
                  Zero Trust
                </>
              ) : (
                'Local user'
              )}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
