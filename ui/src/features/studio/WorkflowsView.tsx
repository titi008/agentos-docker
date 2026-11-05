'use client'

import { Container, ListOrdered, Workflow } from 'lucide-react'

import { Badge, Chip } from '@/components/ui/badge'
import { PageBody, SplitLayout, SplitMain } from '@/components/ui/page'

import { CatalogBrowser, useCatalogUrlState } from './CatalogBrowser'
import { CreateWorkflowDialog } from './CreateWorkflowDialog'
import { capitalize, plural } from './lib'
import { useWorkflowDetailQueries } from './queries'
import { StudioHeader } from './StudioHeader'
import type { CatalogItem } from './types'
import { useStudioCatalog } from './useStudioCatalog'
import { WorkflowPanel } from './WorkflowPanel'

function WorkflowMeta({
  item,
  stepCount
}: {
  item: CatalogItem
  stepCount: number | undefined
}) {
  if (!item.hasDetails) return <Chip>Not published yet</Chip>
  return (
    <>
      <Badge tone="info">{item.isFactory ? 'Factory' : 'Pipeline'}</Badge>
      {item.stage ? <Badge>{capitalize(item.stage)}</Badge> : null}
      {stepCount !== undefined ? (
        <Chip>
          <ListOrdered aria-hidden />
          {plural(stepCount, 'step', 'steps')}
        </Chip>
      ) : null}
      {item.sandboxed ? (
        <Chip>
          <Container aria-hidden />
          Sandboxed
        </Chip>
      ) : null}
    </>
  )
}

/** Workflows tab: code-defined and Studio-managed workflows in one grid. */
export function WorkflowsView() {
  const catalog = useStudioCatalog()
  const section = catalog.sections.workflow
  const url = useCatalogUrlState('workflow')

  // Step counts come from the detail route; the list route has no steps.
  const withSteps = section.items.filter(
    (item) => item.hasDetails && !item.isFactory
  )
  const details = useWorkflowDetailQueries(withSteps.map((item) => item.id))
  const stepCounts = new Map<string, number>()
  withSteps.forEach((item, index) => {
    const steps = details[index]?.data?.steps
    if (details[index]?.isSuccess) stepCounts.set(item.id, steps?.length ?? 0)
  })

  const selected = url.selectedId
    ? section.items.find(
        (item) => item.source === 'code' && item.id === url.selectedId
      )
    : undefined

  return (
    <>
      <StudioHeader
        counts={catalog.counts}
        onRefresh={() => void catalog.refetchAll()}
        refreshing={catalog.isFetching}
        create={{ label: 'New workflow', onClick: url.openCreate }}
      />
      <SplitLayout>
        <SplitMain>
          <PageBody>
            <CatalogBrowser
              kind="workflow"
              section={section}
              icon={Workflow}
              selectedId={selected?.id ?? null}
              onOpenDetails={(item) => url.select(item.id)}
              renderMeta={(item) => (
                <WorkflowMeta item={item} stepCount={stepCounts.get(item.id)} />
              )}
              onCreate={url.openCreate}
              chatLabel="Run in chat"
              emptyHint="Build a multi-step pipeline from agents, teams and registry functions, or define one in code and register it in app/main.py."
            />
          </PageBody>
        </SplitMain>
        {selected ? (
          <WorkflowPanel
            key={selected.id}
            item={selected}
            onClose={url.clearSelection}
          />
        ) : null}
      </SplitLayout>
      {url.createOpen ? (
        <CreateWorkflowDialog
          agents={catalog.sections.agent.items}
          teams={catalog.sections.team.items}
          onClose={url.closeCreate}
        />
      ) : null}
    </>
  )
}
