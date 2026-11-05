'use client'

import { Plus, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageHeader, RouteTabs } from '@/components/ui/page'
import { SECTIONS } from '@/components/shell/nav'
import { cn } from '@/lib/utils'

export function RefreshButton({
  onRefresh,
  refreshing
}: {
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onRefresh}
      aria-busy={refreshing || undefined}
    >
      <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden />
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </Button>
  )
}

interface StudioHeaderProps {
  counts: Record<string, number | undefined>
  onRefresh: () => void
  refreshing: boolean
  /** Primary create action of the tab, e.g. "New agent". */
  create?: { label: string; onClick: () => void }
}

/** Studio title, purpose, actions and the section tabs with totals. */
export function StudioHeader({
  counts,
  onRefresh,
  refreshing,
  create
}: StudioHeaderProps) {
  const tabs = SECTIONS.studio.tabs.map((tab) => ({
    ...tab,
    count: counts[tab.href]
  }))
  return (
    <>
      <PageHeader
        title={SECTIONS.studio.title}
        description={SECTIONS.studio.description}
        actions={
          <>
            <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
            {create ? (
              <Button variant="primary" size="sm" onClick={create.onClick}>
                <Plus aria-hidden />
                {create.label}
              </Button>
            ) : null}
          </>
        }
      />
      <RouteTabs tabs={tabs} aria-label="Studio sections" />
    </>
  )
}
