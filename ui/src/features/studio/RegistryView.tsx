'use client'

import { Boxes, SearchX } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/input'
import { PageBody, SplitLayout, SplitMain } from '@/components/ui/page'
import { SegmentedControl } from '@/components/ui/segmented'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/utils'

import { SandboxedBadge } from './chips'
import {
  matchesQuery,
  plural,
  REGISTRY_FILTERS,
  registryCategory,
  registryKey,
  registryTypeLabel,
  type RegistryFilter
} from './lib'
import { RegistryIcon, RegistryPanel } from './RegistryPanel'
import { StudioHeader } from './StudioHeader'
import type { RegistryResource } from './types'
import { useStudioCatalog } from './useStudioCatalog'

const GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-3 max-md:grid-cols-1'

function searchText(resource: RegistryResource): string {
  return [resource.name, resource.id ?? '', resource.description ?? '']
    .join('\n')
    .toLowerCase()
}

function RegistryCard({
  resource,
  selected,
  onSelect
}: {
  resource: RegistryResource
  selected: boolean
  onSelect: () => void
}) {
  const monoName = ['model', 'function'].includes(resource.type)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-32 min-w-0 flex-col items-stretch gap-2 rounded-xl border bg-surface p-3.5 text-left transition-colors hover:bg-hover',
        selected ? 'border-accent ring-1 ring-accent' : 'border-line'
      )}
    >
      <span className="flex items-center gap-2">
        <RegistryIcon resource={resource} />
        <Badge>{registryTypeLabel(resource)}</Badge>
        {resource.sandboxed ? (
          <span className="ml-auto">
            <SandboxedBadge />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'truncate text-fg',
          monoName
            ? 'font-mono text-[13.5px] font-medium'
            : 'text-sm font-semibold'
        )}
      >
        {resource.name}
      </span>
      <span
        className={cn(
          'line-clamp-2 text-[12.5px]',
          resource.description ? 'text-fg-2' : 'text-fg-3'
        )}
      >
        {resource.description || 'No description.'}
      </span>
      <span className="mt-auto truncate font-mono text-xs text-fg-3">
        {resource.id || 'Built-in'}
      </span>
    </button>
  )
}

/** Registry tab: the building blocks the Studio create forms pick from. */
export function RegistryView() {
  const catalog = useStudioCatalog()
  const resources = catalog.registry.data ?? []
  const status = catalog.registryStatus
  const [selectedKey, setSelectedKey] = useQueryState('resource')
  const [filter, setFilter] = useState<RegistryFilter>('all')
  const [query, setQuery] = useState('')

  const counts = new Map<RegistryFilter, number>([['all', resources.length]])
  for (const resource of resources) {
    const category = registryCategory(resource)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  const filtered = resources.filter(
    (resource) =>
      (filter === 'all' || registryCategory(resource) === filter) &&
      matchesQuery(searchText(resource), query)
  )
  const selected = selectedKey
    ? resources.find((resource) => registryKey(resource) === selectedKey)
    : undefined
  const filtering = filter !== 'all' || query.trim() !== ''

  let content: ReactNode
  if (status.state === 'loading') {
    content = (
      <div role="status" className={GRID}>
        <span className="sr-only">Loading the registry…</span>
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  } else if (status.state === 'error') {
    content = (
      <ErrorState
        title="Couldn't load the registry"
        error={status.error}
        onRetry={status.retry}
        retrying={status.retrying}
      />
    )
  } else if (resources.length === 0) {
    content = (
      <EmptyState
        icon={<Boxes />}
        title="The registry is empty"
        description="Add tools, models, functions and knowledge to the Registry in app/registry.py so Studio can build with them."
      />
    )
  } else if (filtered.length === 0) {
    const label = REGISTRY_FILTERS.find((entry) => entry.value === filter)
    content = (
      <EmptyState
        icon={<SearchX />}
        title={
          query.trim()
            ? `Nothing matches “${query.trim()}”`
            : `No ${label?.label.toLowerCase() ?? 'resources'} in the registry`
        }
        description="Try another search or show every type."
        action={
          <Button
            size="sm"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Clear search and filters
          </Button>
        }
      />
    )
  } else {
    content = (
      <div className={GRID}>
        {filtered.map((resource) => {
          const key = registryKey(resource)
          return (
            <RegistryCard
              key={key}
              resource={resource}
              selected={key === selectedKey}
              onSelect={() => void setSelectedKey(key, { history: 'push' })}
            />
          )
        })}
      </div>
    )
  }

  return (
    <>
      <StudioHeader
        counts={catalog.counts}
        onRefresh={() => void catalog.refetchAll()}
        refreshing={catalog.isFetching}
      />
      <SplitLayout>
        <SplitMain>
          <PageBody>
            <p className="text-[13.5px] text-fg-2">
              Building blocks that agents, teams and workflows can use. The
              Studio create forms pick from this list.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <SegmentedControl
                aria-label="Filter by type"
                value={filter}
                onChange={setFilter}
                options={REGISTRY_FILTERS.map((entry) => ({
                  value: entry.value,
                  label: entry.label,
                  count:
                    status.state === 'ready'
                      ? (counts.get(entry.value) ?? 0)
                      : undefined
                }))}
              />
              <SearchInput
                className="min-w-0 flex-[1_1_200px]"
                aria-label="Search the registry"
                placeholder="Search by name, ID or description"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {status.state === 'ready' && filtering ? (
                <span
                  className="text-[13px] text-fg-3"
                  role="status"
                  aria-live="polite"
                >
                  {filtered.length} of{' '}
                  {plural(resources.length, 'resource', 'resources')}
                </span>
              ) : null}
            </div>
            {content}
          </PageBody>
        </SplitMain>
        {selected ? (
          <RegistryPanel
            key={selectedKey}
            resource={selected}
            onClose={() => void setSelectedKey(null)}
          />
        ) : null}
      </SplitLayout>
    </>
  )
}
