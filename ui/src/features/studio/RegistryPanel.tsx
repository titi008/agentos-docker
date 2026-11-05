'use client'

import {
  Bot,
  BookOpen,
  Box,
  Boxes,
  Braces,
  Brain,
  Container,
  Copy,
  Cpu,
  Database,
  GraduationCap,
  Layers,
  Server,
  SquareFunction,
  Users,
  Workflow,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock, copyToClipboard, formatJson } from '@/components/ui/code'
import { KeyValueList, type KeyValueItem } from '@/components/ui/data'
import { DetailPanel } from '@/components/ui/detail-panel'
import { cn } from '@/lib/utils'

import { SandboxedBadge } from './chips'
import { IdentifierRow, PanelSection } from './CodeItemPanel'
import {
  capitalize,
  isRecord,
  isToolkit,
  registryFunctions,
  registryIdentifier,
  registryTypeLabel
} from './lib'
import type { RegistryResource } from './types'

const TYPE_ICONS: Record<string, LucideIcon> = {
  model: Cpu,
  tool: Wrench,
  toolkit: Boxes,
  function: SquareFunction,
  knowledge: BookOpen,
  learning: GraduationCap,
  db: Database,
  vector_db: Layers,
  schema: Braces,
  agent: Bot,
  team: Users,
  workflow: Workflow,
  memory_manager: Brain,
  session_summary_manager: Brain
}

export function RegistryIcon({
  resource,
  size = 'md'
}: {
  resource: RegistryResource
  size?: 'md' | 'lg'
}) {
  const Icon =
    TYPE_ICONS[isToolkit(resource) ? 'toolkit' : resource.type] ?? Box
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-hover text-fg-2',
        size === 'lg'
          ? 'size-9 rounded-[9px] [&_svg]:size-[18px]'
          : 'size-7 rounded-[7px] [&_svg]:size-4'
      )}
    >
      <Icon />
    </span>
  )
}

/** Names whose values read better as code. */
const MONO_KEYS = new Set([
  'class_path',
  'module',
  'qualname',
  'signature',
  'return_annotation',
  'model_id',
  'model_class',
  'db_class',
  'db_id',
  'vector_db_id',
  'vector_db_class',
  'contents_db_class',
  'table_name',
  'collection',
  'owner_id',
  'id'
])

/** Shown in their own sections instead of the metadata list. */
const OWN_SECTIONS = new Set(['functions', 'parameters', 'is_toolkit'])

function humanize(key: string): string {
  return capitalize(key.replace(/_/g, ' '))
}

function renderValue(key: string, value: unknown): ReactNode {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') {
    return MONO_KEYS.has(key) ? (
      <span className="font-mono text-[12.5px] break-all">{value}</span>
    ) : (
      value
    )
  }
  if (
    Array.isArray(value) &&
    value.every((entry) => ['string', 'number'].includes(typeof entry))
  ) {
    return value.length ? value.join(', ') : '—'
  }
  return (
    <CodeBlock code={formatJson(value)} copyable={false} maxHeight="12rem" />
  )
}

function metadataItems(resource: RegistryResource): KeyValueItem[] {
  const items: KeyValueItem[] = [
    {
      label: 'Type',
      value: (
        <span className="font-mono text-[12.5px]">
          {isToolkit(resource) ? 'toolkit' : resource.type}
        </span>
      )
    }
  ]
  for (const [key, value] of Object.entries(resource.metadata ?? {})) {
    if (OWN_SECTIONS.has(key) || value === null || value === undefined) continue
    items.push({ label: humanize(key), value: renderValue(key, value) })
  }
  items.push({ label: 'Sandboxed', value: resource.sandboxed ? 'Yes' : 'No' })
  return items
}

function hasParameters(parameters: Record<string, unknown>): boolean {
  return (
    isRecord(parameters.properties) &&
    Object.keys(parameters.properties).length > 0
  )
}

/** Details of one registry resource. */
export function RegistryPanel({
  resource,
  onClose
}: {
  resource: RegistryResource
  onClose: () => void
}) {
  const identifier = registryIdentifier(resource)
  const functions = registryFunctions(resource)
  const toolkit = isToolkit(resource)
  const single =
    !toolkit && ['tool', 'function'].includes(resource.type)
      ? functions[0]
      : undefined

  return (
    <DetailPanel
      aria-label={`Registry resource: ${resource.name}`}
      title={
        <span className="flex items-center gap-2.5">
          <RegistryIcon resource={resource} size="lg" />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-normal text-fg-3">
              Registry resource
            </span>
            <span className="break-words">{resource.name}</span>
          </span>
        </span>
      }
      subtitle={
        <>
          <Badge>{registryTypeLabel(resource)}</Badge>
          {resource.sandboxed ? <SandboxedBadge /> : null}
        </>
      }
      backLabel="Registry"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              void copyToClipboard(identifier, 'Resource ID copied')
            }
          >
            <Copy aria-hidden />
            Copy resource ID
          </Button>
        </div>
      }
    >
      <PanelSection title="Identifier">
        <IdentifierRow
          value={identifier}
          copyLabel="Copy ID"
          successMessage="Resource ID copied"
        />
      </PanelSection>
      <PanelSection title="Description">
        <p
          className={
            resource.description
              ? 'text-[13.5px] whitespace-pre-line text-fg-2'
              : 'text-[13px] text-fg-3'
          }
        >
          {resource.description || 'No description provided.'}
        </p>
      </PanelSection>
      <PanelSection title="Execution environment">
        {resource.sandboxed ? (
          <>
            <div className="flex items-start gap-2.5 rounded-[10px] bg-warn-soft p-3">
              <Container
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-warn"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold text-warn">
                  Runs in a sandbox
                </span>
                <span className="text-[13px] text-fg-2">
                  Work runs in an isolated container (Docker, or AgentCore when
                  configured) with its own repository checkout, not on the
                  AgentOS host.
                </span>
              </div>
            </div>
            <p className="text-[12.5px] text-fg-3">
              Resources without the Sandboxed badge run on the AgentOS host.
            </p>
          </>
        ) : (
          <div className="flex items-start gap-2.5 rounded-[10px] bg-muted-soft p-3">
            <Server aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-2" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[13.5px] font-semibold">
                Runs on the AgentOS host
              </span>
              <span className="text-[13px] text-fg-2">
                Calls run inside the AgentOS server process, with its access.
              </span>
            </div>
          </div>
        )}
      </PanelSection>
      {toolkit ? (
        <PanelSection title={`Functions (${functions.length})`}>
          {functions.length ? (
            <ul className="flex flex-col gap-1.5">
              {functions.map((fn) => (
                <li
                  key={fn.name}
                  className="flex flex-col gap-0.5 rounded-lg border border-line px-3 py-2"
                >
                  <span className="font-mono text-[12.5px] text-fg">
                    {fn.name}
                  </span>
                  {fn.description ? (
                    <span className="line-clamp-2 text-[12.5px] text-fg-3">
                      {fn.description}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-fg-3">
              No functions listed yet. MCP toolkits list theirs once connected.
            </p>
          )}
        </PanelSection>
      ) : null}
      {single && hasParameters(single.parameters) ? (
        <PanelSection title="Parameters">
          <CodeBlock
            code={formatJson(single.parameters)}
            label="JSON schema"
            maxHeight="16rem"
          />
        </PanelSection>
      ) : null}
      <PanelSection title="Metadata">
        <KeyValueList items={metadataItems(resource)} />
      </PanelSection>
    </DetailPanel>
  )
}
