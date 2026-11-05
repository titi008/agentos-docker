import { Boxes, Container, Users, Wrench } from 'lucide-react'

import { Badge, Chip } from '@/components/ui/badge'
import { ProviderIcon } from '@/components/ui/icon/ProviderIcon'

import { plural } from './lib'
import type { CatalogItem } from './types'

export function ModelChip({
  modelId,
  provider,
  prefix
}: {
  modelId?: string
  provider?: string
  prefix?: string
}) {
  if (!modelId) return null
  return (
    <Chip title={prefix ? `${prefix}: ${modelId}` : modelId}>
      <ProviderIcon provider={provider || modelId} className="size-3.5" />
      {prefix ? <span className="text-fg-3">{prefix}</span> : null}
      <span className="truncate font-mono">{modelId}</span>
    </Chip>
  )
}

export function SandboxedBadge() {
  return (
    <Badge tone="warn" dot>
      Sandboxed
    </Badge>
  )
}

/** Chips for an agent or team card. */
export function CatalogMeta({ item }: { item: CatalogItem }) {
  if (!item.hasDetails) {
    return <Chip>Not published yet</Chip>
  }
  return (
    <>
      <ModelChip
        modelId={item.modelId}
        provider={item.provider}
        prefix={item.kind === 'team' ? 'Leader' : undefined}
      />
      {item.kind === 'agent' ? (
        <Chip>
          <Wrench aria-hidden />
          {plural(item.toolNames.length, 'tool', 'tools')}
        </Chip>
      ) : null}
      {item.kind === 'team' ? (
        <Chip>
          <Users aria-hidden />
          {plural(item.members.length, 'member', 'members')}
        </Chip>
      ) : null}
      {item.isFactory ? (
        <Chip>
          <Boxes aria-hidden />
          Factory
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
