'use client'

import { Plus, SearchX, type LucideIcon } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states'

import { CatalogCard } from './CatalogCard'
import { KIND_LABEL, matchesQuery, plural } from './lib'
import type { CatalogItem, CatalogSource, StudioKind } from './types'
import type { useStudioCatalog } from './useStudioCatalog'

type Section = ReturnType<typeof useStudioCatalog>['sections'][StudioKind]
type SourceFilter = 'all' | CatalogSource

export const GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3 max-md:grid-cols-1'

/**
 * URL state of a catalog tab: the open detail panel (`?id=`) and the create
 * dialog (`?new=<kind>`, also used by the command palette).
 */
export function useCatalogUrlState(kind: StudioKind) {
  const [selectedId, setSelectedId] = useQueryState('id')
  const [newParam, setNewParam] = useQueryState('new')
  return {
    selectedId,
    select: (id: string) => void setSelectedId(id, { history: 'push' }),
    clearSelection: () => void setSelectedId(null),
    createOpen: newParam === kind,
    openCreate: () => void setNewParam(kind),
    closeCreate: () => void setNewParam(null)
  }
}

export function CardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div role="status" className={GRID_CLASS}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-[196px] rounded-xl" />
      ))}
    </div>
  )
}

interface CatalogBrowserProps {
  kind: StudioKind
  section: Section
  icon: LucideIcon
  selectedId: string | null
  onOpenDetails: (item: CatalogItem) => void
  renderMeta: (item: CatalogItem) => ReactNode
  onCreate: () => void
  /** What to do when there is nothing yet, besides the create button. */
  emptyHint: ReactNode
  chatLabel?: string
}

/** Search, source filter and the unified card grid of one Studio tab. */
export function CatalogBrowser({
  kind,
  section,
  icon,
  selectedId,
  onOpenDetails,
  renderMeta,
  onCreate,
  emptyHint,
  chatLabel
}: CatalogBrowserProps) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<SourceFilter>('all')
  const { one, many } = KIND_LABEL[kind]
  const items = section.items
  const studioCount = items.filter((item) => item.source === 'studio').length
  const filtered = items.filter(
    (item) =>
      (source === 'all' || item.source === source) &&
      matchesQuery(item.searchText, query)
  )
  const filtering = source !== 'all' || query.trim() !== ''
  const resetFilters = () => {
    setQuery('')
    setSource('all')
  }

  let content: ReactNode
  if (section.status.state === 'loading') {
    content = <CardSkeletons />
  } else if (section.status.state === 'error') {
    content = (
      <ErrorState
        title={`Couldn't load ${many}`}
        error={section.status.error}
        onRetry={section.status.retry}
        retrying={section.status.retrying}
      />
    )
  } else if (items.length === 0) {
    const Icon = icon
    content = (
      <EmptyState
        icon={<Icon />}
        title={`No ${many} yet`}
        description={emptyHint}
        action={
          <Button variant="primary" size="sm" onClick={onCreate}>
            <Plus aria-hidden />
            New {one}
          </Button>
        }
      />
    )
  } else if (filtered.length === 0) {
    const sourceLabel =
      source === 'studio'
        ? 'Studio-managed'
        : source === 'code'
          ? 'code-defined'
          : ''
    content = (
      <EmptyState
        icon={<SearchX />}
        title={
          query.trim()
            ? `No ${sourceLabel ? `${sourceLabel} ` : ''}${many} match “${query.trim()}”`
            : `No ${sourceLabel} ${many}`
        }
        description={
          source === 'studio' && !query.trim()
            ? `Studio-managed ${many} are created here and keep a version history.`
            : 'Try another search or show every source.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={resetFilters}>
              Clear search and filters
            </Button>
            {source === 'studio' ? (
              <Button variant="primary" size="sm" onClick={onCreate}>
                <Plus aria-hidden />
                New {one}
              </Button>
            ) : null}
          </div>
        }
      />
    )
  } else {
    content = (
      <div className={GRID_CLASS}>
        {filtered.map((item) => (
          <CatalogCard
            key={`${item.source}:${item.id}`}
            item={item}
            icon={icon}
            selected={item.source === 'code' && item.id === selectedId}
            meta={renderMeta(item)}
            onOpenDetails={() => onOpenDetails(item)}
            chatLabel={chatLabel}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput
          className="max-w-[400px] min-w-0 flex-[1_1_240px]"
          aria-label={`Search ${many}`}
          placeholder="Search by name, ID or description"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SegmentedControl
          aria-label="Filter by source"
          value={source}
          onChange={setSource}
          options={[
            { value: 'all', label: 'All', count: items.length },
            { value: 'studio', label: 'Studio-managed', count: studioCount },
            {
              value: 'code',
              label: 'Code-defined',
              count: items.length - studioCount
            }
          ]}
        />
        {section.status.state === 'ready' ? (
          <span
            className="ml-auto text-[13px] text-fg-3"
            role="status"
            aria-live="polite"
          >
            {filtering
              ? `${filtered.length} of ${plural(items.length, one, many)}`
              : plural(items.length, one, many)}
          </span>
        ) : null}
      </div>
      {section.componentsError && section.status.state === 'ready' ? (
        <ErrorState
          compact
          title={`Couldn't load Studio-managed ${many}`}
          error={section.componentsError}
          onRetry={section.retryComponents}
          retrying={section.retryingComponents}
        />
      ) : null}
      {content}
    </>
  )
}
