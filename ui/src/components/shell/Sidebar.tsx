'use client'

import { cn } from '@/lib/utils'
import { useStore } from '@/store'

import { SidebarContent } from './SidebarContent'

/** Desktop sidebar; hidden on phones, where MobileTopBar + MobileMenu take over. */
export function Sidebar() {
  const collapsed = useStore((state) => state.sidebarCollapsed)
  const setCollapsed = useStore((state) => state.setSidebarCollapsed)

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        'hidden shrink-0 flex-col border-r border-line bg-panel py-3.5 transition-[width] duration-200 md:flex',
        collapsed ? 'w-16 px-2' : 'w-62 px-3'
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
      />
    </aside>
  )
}
