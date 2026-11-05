'use client'

import { Suspense, type ReactNode } from 'react'

import { Spinner } from '@/components/ui/states'
import { useWorkspaceBootstrap } from '@/features/workspace/queries'

import { CommandPalette } from './CommandPalette'
import { ConnectionBanner } from './ConnectionBanner'
import { MobileTopBar } from './MobileTopBar'
import { Sidebar } from './Sidebar'

function PageFallback() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-fg-3">
      <Spinner />
      Loading…
    </div>
  )
}

/**
 * Sidebar (desktop) or top bar + menu (phones), the connection banner and
 * the command palette around every page. <main> fills the viewport and does
 * not scroll; pages scroll inside PageScroll / SplitMain.
 */
export function AppShell({ children }: { children: ReactNode }) {
  useWorkspaceBootstrap()

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-accent-fill px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileTopBar />
      <main
        id="main"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <ConnectionBanner />
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </main>
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
    </div>
  )
}
