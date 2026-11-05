'use client'

import { Bot, Users } from 'lucide-react'
import { useState } from 'react'

import { PageBody, SplitLayout, SplitMain } from '@/components/ui/page'

import { CatalogBrowser, useCatalogUrlState } from './CatalogBrowser'
import { CatalogMeta } from './chips'
import { CodeItemPanel } from './CodeItemPanel'
import { CreateAgentDialog } from './CreateAgentDialog'
import { CreateTeamDialog } from './CreateTeamDialog'
import { componentHref, KIND_LABEL, LIST_HREF } from './lib'
import { StudioHeader } from './StudioHeader'
import type { CatalogItem, MemberRef } from './types'
import { useStudioCatalog } from './useStudioCatalog'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

type EntityKind = 'agent' | 'team'

function isEntity(
  item: CatalogItem | undefined
): item is CatalogItem & { kind: EntityKind } {
  return item?.kind === 'agent' || item?.kind === 'team'
}

/** Agents or Teams tab: code-defined and Studio-managed items in one grid. */
export function EntityCatalogView({ kind }: { kind: EntityKind }) {
  const catalog = useStudioCatalog()
  const section = catalog.sections[kind]
  const url = useCatalogUrlState(kind)
  const { one } = KIND_LABEL[kind]

  // Unsaved model choice, tied to the item it was made for.
  const [modelDraft, setModelDraft] = useState<{
    id: string
    value: string
  } | null>(null)

  const found = url.selectedId
    ? section.items.find(
        (item) => item.source === 'code' && item.id === url.selectedId
      )
    : undefined
  const selected = isEntity(found) ? found : undefined
  const draft =
    selected && modelDraft?.id === selected.id ? modelDraft.value : null
  const dirty = draft !== null && draft !== selected?.modelId
  const confirmDiscard = useUnsavedChanges(dirty, `the ${one} model`)

  const leaveSelection = async () => {
    if (dirty && !(await confirmDiscard())) return false
    setModelDraft(null)
    return true
  }

  const memberHref = (member: MemberRef) => {
    const target = catalog.sections[member.kind].items.find(
      (item) => item.id === member.id
    )
    return target?.source === 'studio'
      ? componentHref(member.id)
      : `${LIST_HREF[member.kind]}?id=${encodeURIComponent(member.id)}`
  }

  return (
    <>
      <StudioHeader
        counts={catalog.counts}
        onRefresh={() => void catalog.refetchAll()}
        refreshing={catalog.isFetching}
        create={{ label: `New ${one}`, onClick: url.openCreate }}
      />
      <SplitLayout>
        <SplitMain>
          <PageBody>
            <CatalogBrowser
              kind={kind}
              section={section}
              icon={kind === 'team' ? Users : Bot}
              selectedId={selected?.id ?? null}
              onOpenDetails={async (item) => {
                if (item.id === selected?.id) return
                if (await leaveSelection()) url.select(item.id)
              }}
              renderMeta={(item) => <CatalogMeta item={item} />}
              onCreate={url.openCreate}
              emptyHint={
                kind === 'team'
                  ? 'Create a Studio-managed team from your agents, or define one in code under teams/ and register it in app/main.py.'
                  : 'Create a Studio-managed agent here, or define one in code under agents/ and register it in app/main.py.'
              }
            />
          </PageBody>
        </SplitMain>
        {selected ? (
          <CodeItemPanel
            key={selected.id}
            item={selected}
            draft={draft}
            onDraftChange={(value) =>
              setModelDraft(value === null ? null : { id: selected.id, value })
            }
            onClose={async () => {
              if (await leaveSelection()) url.clearSelection()
            }}
            memberHref={memberHref}
          />
        ) : null}
      </SplitLayout>
      {url.createOpen && kind === 'agent' ? (
        <CreateAgentDialog onClose={url.closeCreate} />
      ) : null}
      {url.createOpen && kind === 'team' ? (
        <CreateTeamDialog
          agents={catalog.sections.agent.items}
          agentsLoading={catalog.sections.agent.status.state === 'loading'}
          onClose={url.closeCreate}
        />
      ) : null}
    </>
  )
}
