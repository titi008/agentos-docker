'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, MessageSquare, Users } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'
import { Badge, Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/code'
import { DetailPanel } from '@/components/ui/detail-panel'
import { Label } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/states'
import { chatHref } from '@/components/shell/nav'
import { WORKSPACE_KEY } from '@/features/workspace/queries'

import { KindIcon } from './CatalogCard'
import { SandboxedBadge } from './chips'
import { capitalize } from './lib'
import { ModelSelect } from './ModelSelect'
import { useModelsQuery } from './queries'
import type {
  AgentInfo,
  CatalogItem,
  MemberRef,
  ModelUpdateResult,
  TeamInfo
} from './types'

export function PanelSection({
  title,
  children
}: {
  title: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[12.5px] font-medium text-fg-3">{title}</h3>
      {children}
    </section>
  )
}

/** Monospace identifier box with a copy button. */
export function IdentifierRow({
  value,
  copyLabel = 'Copy',
  successMessage
}: {
  value: string
  copyLabel?: string
  successMessage?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate rounded-lg border border-line bg-canvas px-2.5 py-1.5 font-mono text-[12.5px] text-fg">
        {value}
      </span>
      <CopyButton
        value={value}
        label={copyLabel}
        variant="secondary"
        successMessage={successMessage}
      />
    </div>
  )
}

export function Divider() {
  return <div aria-hidden className="h-px bg-line" />
}

interface ModelFieldProps {
  item: CatalogItem & { kind: 'agent' | 'team' }
  /** Unsaved selection, or null when the saved model is shown. */
  draft: string | null
  onDraftChange: (draft: string | null) => void
}

function ModelField({ item, draft, onDraftChange }: ModelFieldProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const models = useModelsQuery()
  const current = item.modelId
  const value = draft ?? current ?? ''
  const dirty = draft !== null && draft !== current
  const fieldId = `model-${item.kind}`
  const route = item.kind === 'agent' ? 'agents' : 'teams'

  const update = useMutation({
    mutationFn: (modelId: string) => {
      const id = encodeURIComponent(item.id)
      return api.request<ModelUpdateResult>(`/api/${route}/${id}/model`, {
        method: 'POST',
        json: { model_id: modelId },
        fallbackPaths: [`/${route}/${id}/model`]
      })
    },
    onSuccess: (result, modelId) => {
      const provider =
        result?.provider ??
        models.data?.models.find((model) => model.id === modelId)?.provider
      queryClient.setQueryData<(AgentInfo | TeamInfo)[]>(
        api.key(WORKSPACE_KEY, route),
        (list) =>
          list?.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  model: { ...entry.model, model: modelId, provider }
                }
              : entry
          )
      )
      onDraftChange(null)
      toast.success(`Model updated to ${modelId}`)
      return queryClient.invalidateQueries({
        queryKey: api.key(WORKSPACE_KEY, route)
      })
    },
    onError: (error) =>
      toast.error("Couldn't update the model", {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>
          {item.kind === 'team' ? 'Leader model' : 'Model'}
        </Label>
        {dirty ? (
          <Badge tone="warn" dot>
            Unsaved change
          </Badge>
        ) : null}
      </div>
      {models.isPending ? (
        <Skeleton className="h-9 w-full rounded-lg" />
      ) : (
        <ModelSelect
          id={fieldId}
          models={models.data?.models ?? []}
          value={value}
          current={current}
          currentProvider={item.provider}
          onValueChange={(next) =>
            onDraftChange(next === current ? null : next)
          }
          disabled={update.isPending}
          aria-describedby={`${fieldId}-help`}
        />
      )}
      <p id={`${fieldId}-help`} className="text-[12.5px] text-fg-3">
        {current ? (
          <>
            Current model: <span className="font-mono">{current}</span>.{' '}
          </>
        ) : null}
        Saved on the server and kept after restarts.
        {models.data && !models.data.fromServer
          ? " The server's model list couldn't be loaded, so default models are shown."
          : null}
      </p>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty || update.isPending}
          onClick={() => onDraftChange(null)}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty}
          loading={update.isPending}
          onClick={() => {
            if (draft) update.mutate(draft)
          }}
        >
          Update model
        </Button>
      </div>
    </div>
  )
}

interface CodeItemPanelProps extends ModelFieldProps {
  onClose: () => void
  /** Where a team member links to (its panel or its Studio page). */
  memberHref: (member: MemberRef) => string
}

/** Details of a code-defined agent or team, with its model override. */
export function CodeItemPanel({
  item,
  draft,
  onDraftChange,
  onClose,
  memberHref
}: CodeItemPanelProps) {
  const noun = item.kind === 'team' ? 'team' : 'agent'
  return (
    <DetailPanel
      aria-label={`${capitalize(noun)} details: ${item.name}`}
      title={
        <span className="flex items-center gap-2.5">
          <KindIcon icon={item.kind === 'team' ? Users : Bot} />
          <span className="min-w-0">{item.name}</span>
        </span>
      }
      subtitle={
        <>
          <Badge>Code-defined</Badge>
          {item.sandboxed ? <SandboxedBadge /> : null}
          {item.isFactory ? <Badge>Factory</Badge> : null}
        </>
      }
      backLabel={item.kind === 'team' ? 'All teams' : 'All agents'}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" asChild>
            <Link href={chatHref(item.kind, item.id)}>
              <MessageSquare aria-hidden />
              Chat with {noun}
            </Link>
          </Button>
        </div>
      }
    >
      <PanelSection title={`${capitalize(noun)} ID`}>
        <IdentifierRow
          value={item.id}
          successMessage={`${capitalize(noun)} ID copied`}
        />
      </PanelSection>
      <PanelSection title={item.kind === 'agent' ? 'Description' : 'About'}>
        <p
          className={
            item.description
              ? 'text-[13.5px] text-fg-2'
              : 'text-[13px] text-fg-3'
          }
        >
          {item.description || 'No description provided.'}
        </p>
      </PanelSection>
      <Divider />
      {item.isFactory ? (
        <p className="text-[13px] text-fg-3">
          This {noun} is built per request by a factory, so its model is set in
          code.
        </p>
      ) : (
        <ModelField item={item} draft={draft} onDraftChange={onDraftChange} />
      )}
      <Divider />
      {item.kind === 'agent' ? (
        <PanelSection title={`Attached tools (${item.toolNames.length})`}>
          {item.toolNames.length ? (
            <div className="flex flex-wrap gap-1.5">
              {item.toolNames.map((name, index) => (
                <Chip key={`${name}-${index}`} className="font-mono">
                  {name}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-fg-3">
              No tools attached. The agent answers from the model alone.
            </p>
          )}
        </PanelSection>
      ) : (
        <PanelSection title={`Members (${item.members.length})`}>
          {item.members.length ? (
            <ul className="flex flex-col gap-1.5">
              {item.members.map((member) => (
                <li key={member.id}>
                  <Link
                    href={memberHref(member)}
                    className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 transition-colors hover:bg-hover"
                  >
                    {member.kind === 'team' ? (
                      <Users aria-hidden className="size-4 text-fg-3" />
                    ) : (
                      <Bot aria-hidden className="size-4 text-fg-3" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] font-medium">
                        {member.name}
                      </span>
                      <span className="truncate font-mono text-xs text-fg-3">
                        {member.id}
                      </span>
                    </span>
                    <Badge>{member.kind === 'team' ? 'Team' : 'Agent'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-fg-3">
              No members listed. The team picks its specialists at run time.
            </p>
          )}
        </PanelSection>
      )}
    </DetailPanel>
  )
}
