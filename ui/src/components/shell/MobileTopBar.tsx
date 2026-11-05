'use client'

import { Menu, Plus, ShieldCheck, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetClose } from '@/components/ui/dialog'
import { AgnoLogo } from '@/components/ui/icon/ProviderIcon'
import { useNewChat } from '@/features/chat/useNewChat'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'

import { SidebarContent } from './SidebarContent'

/** Phone top bar: menu, logo, approvals count and new chat. */
export function MobileTopBar() {
  const open = useStore((state) => state.isMobileMenuOpen)
  const setOpen = useStore((state) => state.setIsMobileMenuOpen)
  const pending = useStore((state) => state.pendingApprovalsCount)
  const active = useStore((state) => state.isEndpointActive)
  const pathname = usePathname()
  const newChat = useNewChat()

  // Close the menu whenever the route changes.
  useEffect(() => setOpen(false), [pathname, setOpen])

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-0.5 border-b border-line bg-panel px-1.5 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="!size-5" />
      </Button>
      <Link
        href="/"
        className="flex min-w-0 flex-1 items-center gap-2 px-1"
        aria-label="AgentOS chat"
      >
        <AgnoLogo className="size-5" />
        <span className="font-semibold">AgentOS</span>
        <span
          aria-hidden
          className={cn('size-[7px] rounded-full', active ? 'bg-ok' : 'bg-bad')}
        />
        <span className="sr-only">{active ? 'Connected' : 'Offline'}</span>
      </Link>
      <Button variant="ghost" size="icon" asChild className="relative">
        <Link
          href="/approvals"
          aria-label={`Approvals${pending ? `, ${pending} waiting` : ''}`}
        >
          <ShieldCheck className="!size-5" />
          {pending > 0 ? (
            <span
              aria-hidden
              className="absolute top-1 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-fill px-1 text-[11px] font-semibold text-white"
            >
              {pending}
            </span>
          ) : null}
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="New chat"
        onClick={newChat}
      >
        <Plus className="!size-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen} title="Menu">
        <div className="flex h-full flex-col p-3">
          <SidebarContent
            onNavigate={() => setOpen(false)}
            headerAction={
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close menu">
                  <X />
                </Button>
              </SheetClose>
            }
          />
        </div>
      </Sheet>
    </header>
  )
}
