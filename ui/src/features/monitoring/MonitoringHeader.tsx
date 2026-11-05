'use client'

import { RefreshCw } from 'lucide-react'

import { SECTIONS } from '@/components/shell/nav'
import { Button } from '@/components/ui/button'
import { PageHeader, RouteTabs } from '@/components/ui/page'

/** Section header and tabs shared by the three monitoring pages. */
export function MonitoringHeader({
  onRefresh,
  refreshing
}: {
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <>
      <PageHeader
        title={SECTIONS.monitoring.title}
        description={SECTIONS.monitoring.description}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            loading={refreshing}
          >
            {refreshing ? null : <RefreshCw aria-hidden />}
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />
      <RouteTabs
        tabs={SECTIONS.monitoring.tabs}
        aria-label="Monitoring sections"
      />
    </>
  )
}
