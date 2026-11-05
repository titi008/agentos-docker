'use client'

import { WifiOff } from 'lucide-react'
import Link from 'next/link'

import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useHealthQuery } from '@/features/workspace/queries'
import { useStore } from '@/store'

/** Shown above every page while the AgentOS server can't be reached. */
export function ConnectionBanner() {
  const health = useHealthQuery()
  const endpoint = useStore((state) => state.selectedEndpoint)

  if (health.status !== 'error') return null

  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-bad/40 bg-bad-soft px-4 py-2.5 text-[13px] md:px-6"
    >
      <WifiOff aria-hidden className="size-4 shrink-0 text-bad" />
      <p className="min-w-0 flex-1 text-fg">
        {getErrorMessage(health.error, endpoint)}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => health.refetch()}
          loading={health.isFetching}
        >
          Retry
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/settings">Settings</Link>
        </Button>
      </div>
    </div>
  )
}
