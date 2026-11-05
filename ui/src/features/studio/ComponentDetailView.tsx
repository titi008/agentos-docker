'use client'

import {
  useMutation,
  useQueryClient,
  type UseQueryResult
} from '@tanstack/react-query'
import {
  Bot,
  ChevronRight,
  Copy,
  Ellipsis,
  FileQuestion,
  MessageSquare,
  Rocket,
  Trash2,
  Users,
  Workflow
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { ApiError, getErrorMessage, useApi } from '@/api/client'
import { Badge, Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton, copyToClipboard, formatJson } from '@/components/ui/code'
import { useConfirm } from '@/components/ui/confirm'
import { Card, KeyValueList, type KeyValueItem } from '@/components/ui/data'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { PageBody, PageScroll } from '@/components/ui/page'
import { ProviderIcon } from '@/components/ui/icon/ProviderIcon'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Skeleton
} from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { chatHref, SECTIONS } from '@/components/shell/nav'
import { useHealthQuery } from '@/features/workspace/queries'
import { formatDate, formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'

import { KindIcon } from './CatalogCard'
import { Divider } from './CodeItemPanel'
import {
  capitalize,
  configMemberIds,
  configModelId,
  configSteps,
  configToolLabels,
  draftToInstructions,
  instructionsToDraft,
  isRecord,
  KIND_LABEL,
  latestVersion,
  LIST_HREF,
  LIST_TITLE,
  plural
} from './lib'
import {
  isNotFound,
  STUDIO_KEY,
  useComponentConfigsQuery,
  useComponentQuery,
  useInvalidateStudio
} from './queries'
import { RefreshButton } from './StudioHeader'
import type { ConfigVersion, StudioComponent, StudioKind } from './types'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

const KIND_ICON = { agent: Bot, team: Users, workflow: Workflow }

/* Layout ------------------------------------------------------------------ */

function DetailHeader({
  kind,
  name,
  onRefresh,
  refreshing
}: {
  kind?: StudioKind
  name: string
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <header className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-3 md:px-6">
      <nav
        aria-label="Breadcrumb"
        className="min-w-0 flex-1 text-[13.5px] text-fg-3"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={SECTIONS.studio.tabs[0].href} className="hover:text-fg">
              {SECTIONS.studio.title}
            </Link>
          </li>
          {kind ? (
            <li className="flex items-center gap-2">
              <ChevronRight aria-hidden className="size-3.5" />
              <Link href={LIST_HREF[kind]} className="hover:text-fg">
                {LIST_TITLE[kind]}
              </Link>
            </li>
          ) : null}
          <li className="flex min-w-0 items-center gap-2">
            <ChevronRight aria-hidden className="size-3.5" />
            <span aria-current="page" className="truncate font-medium text-fg">
              {name}
            </span>
          </li>
        </ol>
      </nav>
      <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
    </header>
  )
}

function SectionCard({
  id,
  title,
  description,
  aside,
  className,
  children
}: {
  id: string
  title: string
  description: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card
      role="region"
      aria-labelledby={id}
      className={cn('flex min-w-0 flex-col', className)}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-[18px] py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="text-[15px] font-semibold">
            {title}
          </h2>
          <p className="text-[13px] text-fg-3">{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </Card>
  )
}

/* Summary ----------------------------------------------------------------- */

function summaryItems(
  component: StudioComponent,
  config: Record<string, unknown> | undefined
): KeyValueItem[] {
  const kind = component.component_type
  const modelId = configModelId(config)
  const provider =
    isRecord(config?.model) && typeof config.model.provider === 'string'
      ? config.model.provider
      : undefined
  const items: KeyValueItem[] = [
    {
      label: 'Component ID',
      value: (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-[12.5px]">
            {component.component_id}
          </span>
          <CopyButton
            value={component.component_id}
            aria-label="Copy component ID"
            successMessage="Component ID copied"
          />
        </span>
      )
    },
    { label: 'Type', value: capitalize(KIND_LABEL[kind].one) }
  ]

  if (kind !== 'workflow') {
    items.push({
      label: kind === 'team' ? 'Leader model' : 'Model',
      value: modelId ? (
        <span className="flex items-center gap-2">
          <ProviderIcon provider={provider || modelId} className="size-3.5" />
          <span className="font-mono text-[12.5px]">{modelId}</span>
        </span>
      ) : (
        <span className="text-fg-3">Default model</span>
      )
    })
  }

  if (kind === 'agent') {
    const tools = configToolLabels(config)
    items.push({
      label: 'Tools',
      value: tools.length ? (
        <span className="flex flex-wrap gap-1.5">
          {tools.map((tool) => (
            <Chip key={tool} className="font-mono">
              {tool}
            </Chip>
          ))}
        </span>
      ) : (
        <span className="text-fg-3">No tools</span>
      )
    })
  }

  if (kind === 'team') {
    const members = configMemberIds(config)
    items.push({
      label: 'Members',
      value: members.length ? (
        <span className="flex flex-wrap gap-1.5">
          {members.map((member) => (
            <Chip key={member} className="font-mono">
              {member}
            </Chip>
          ))}
        </span>
      ) : (
        <span className="text-fg-3">No members</span>
      )
    })
  }

  if (kind === 'workflow') {
    const steps = configSteps(config)
    items.push({
      label: 'Steps',
      value: steps.length ? (
        <ol className="flex flex-col gap-1">
          {steps.map((step, index) => (
            <li
              key={`${step.name}-${index}`}
              className="flex flex-wrap items-center gap-x-2"
            >
              <span className="text-fg-3 tabular-nums">{index + 1}.</span>
              <span className="font-medium">{step.name}</span>
              <Badge>{step.executor}</Badge>
              {step.target ? (
                <span className="font-mono text-xs text-fg-3">
                  {step.target}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <span className="text-fg-3">No steps</span>
      )
    })
  }

  items.push(
    {
      label: 'Created',
      value: (
        <span>
          {formatDate(component.created_at)}
          {component.user_id ? (
            <>
              {' '}
              by{' '}
              <span className="font-mono text-[12.5px]">
                {component.user_id}
              </span>
            </>
          ) : null}
        </span>
      )
    },
    {
      label: 'Updated',
      value: component.updated_at ? (
        <span>
          {formatDateTime(component.updated_at)} ·{' '}
          <RelativeTime value={component.updated_at} />
        </span>
      ) : (
        <span className="text-fg-3">Never</span>
      )
    }
  )
  return items
}

/* Detail ------------------------------------------------------------------ */

interface Draft {
  name?: string
  description?: string
  instructions?: string
  notes?: string
}

interface PublishInput {
  config: Record<string, unknown>
  notes?: string
  /** Row-only description to PATCH after publishing, when it changed. */
  description?: string
}

function ComponentDetail({
  component,
  configs
}: {
  component: StudioComponent
  configs: UseQueryResult<ConfigVersion[]>
}) {
  const api = useApi()
  const queryClient = useQueryClient()
  const router = useRouter()
  const confirm = useConfirm()
  const invalidate = useInvalidateStudio()

  const id = component.component_id
  const path = `/components/${encodeURIComponent(id)}`
  const kind = component.component_type
  const noun = KIND_LABEL[kind].one
  const name = component.name || id
  const liveVersion = component.current_version ?? undefined
  const versions = configs.data ?? []
  const liveConfig =
    versions.find((version) => version.version === liveVersion) ?? versions[0]
  const base = liveConfig?.config ?? {}
  const configOwnsDescription = 'description' in base
  const hasInstructions = kind !== 'workflow'
  const nextVersion = latestVersion(versions) + 1

  const baseName = typeof base.name === 'string' && base.name ? base.name : name
  const baseDescription = configOwnsDescription
    ? typeof base.description === 'string'
      ? base.description
      : ''
    : (component.description ?? '')
  const baseInstructions = instructionsToDraft(base.instructions)

  const [draft, setDraft] = useState<Draft>({})
  const values = {
    name: draft.name ?? baseName,
    description: draft.description ?? baseDescription,
    instructions: draft.instructions ?? baseInstructions.text,
    notes: draft.notes ?? ''
  }
  const changed =
    values.name !== baseName ||
    values.description !== baseDescription ||
    (hasInstructions && values.instructions !== baseInstructions.text)
  const dirty = changed || values.notes.trim() !== ''
  const parsed = draftToInstructions(
    { text: values.instructions, format: baseInstructions.format },
    base.instructions
  )
  const nameError = values.name.trim() ? null : 'Enter a name.'
  const instructionsError =
    hasInstructions &&
    !parsed.ok &&
    values.instructions !== baseInstructions.text
      ? parsed.error
      : null

  const confirmDiscard = useUnsavedChanges(dirty, name)

  const componentKey = api.key(STUDIO_KEY, 'component', id)
  const configsKey = api.key(STUDIO_KEY, 'component', id, 'configs')

  const publish = useMutation({
    mutationFn: async (input: PublishInput) => {
      const created = await api.request<ConfigVersion>(`${path}/configs`, {
        method: 'POST',
        json: {
          config: input.config,
          stage: 'published',
          notes: input.notes,
          set_current: true
        }
      })
      let descriptionError: unknown = null
      if (input.description !== undefined) {
        try {
          await api.request<StudioComponent>(path, {
            method: 'PATCH',
            json: { description: input.description }
          })
        } catch (error) {
          descriptionError = error
        }
      }
      return { created, descriptionError, input }
    },
    onSuccess: ({ created, descriptionError, input }) => {
      // Publishing makes the new version live; show that right away.
      queryClient.setQueryData<StudioComponent>(componentKey, (old) =>
        old
          ? {
              ...old,
              current_version: created.version,
              name:
                typeof input.config.name === 'string'
                  ? input.config.name
                  : old.name,
              description:
                input.description ??
                (typeof input.config.description === 'string'
                  ? input.config.description
                  : old.description)
            }
          : old
      )
      queryClient.setQueryData<ConfigVersion[]>(configsKey, (old) => [
        created,
        ...(old ?? []).filter((version) => version.version !== created.version)
      ])
      setDraft({})
      if (descriptionError) {
        toast.error(
          `Published v${created.version}, but the description wasn't saved`,
          {
            description: getErrorMessage(descriptionError, api.ctx.endpoint)
          }
        )
      } else {
        toast.success(`Published v${created.version}`)
      }
      return invalidate(id)
    },
    onError: (error) =>
      toast.error("Couldn't publish the new version", {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  const activate = useMutation({
    mutationFn: (version: number) =>
      api.request<StudioComponent>(`${path}/configs/${version}/set-current`, {
        method: 'POST',
        json:
          liveVersion !== undefined
            ? { guard: { current_version: liveVersion } }
            : {}
      }),
    onSuccess: (updated, version) => {
      queryClient.setQueryData<StudioComponent>(componentKey, (old) => ({
        ...old,
        ...updated,
        current_version: updated?.current_version ?? version
      }))
      setDraft({})
      toast.success(`v${version} is live`)
      return invalidate(id)
    },
    onError: (error) =>
      toast.error("Couldn't change the live version", {
        description:
          error instanceof ApiError && error.status === 409
            ? `${getErrorMessage(error, api.ctx.endpoint)} Refresh to see the current live version.`
            : getErrorMessage(error, api.ctx.endpoint)
      })
  })

  const remove = useMutation({
    mutationFn: () => api.request<void>(path, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(`${capitalize(noun)} deleted`, { description: name })
      router.push(LIST_HREF[kind])
      // Mark the page's data stale without refetching it while it unmounts.
      void queryClient.invalidateQueries({
        queryKey: componentKey,
        refetchType: 'none'
      })
      return invalidate()
    },
    onError: (error) =>
      toast.error(`Couldn't delete the ${noun}`, {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  const busy = publish.isPending || activate.isPending || remove.isPending

  const submitPublish = () => {
    if (!changed || nameError || instructionsError || busy) return
    if (hasInstructions && !parsed.ok) return
    const config: Record<string, unknown> = {
      ...base,
      name: values.name.trim()
    }
    if (hasInstructions && parsed.ok) config.instructions = parsed.value
    if (configOwnsDescription) config.description = values.description.trim()
    publish.mutate({
      config,
      notes: values.notes.trim() || undefined,
      description:
        !configOwnsDescription && values.description !== baseDescription
          ? values.description.trim()
          : undefined
    })
  }

  const makeLive = async (version: number) => {
    const ok = await confirm({
      title: `Make v${version} live?`,
      description: (
        <>
          Chats will use the v{version}{' '}
          {hasInstructions ? 'instructions' : 'configuration'} right away.
          {liveVersion !== undefined
            ? ` v${liveVersion} stays in the history.`
            : ''}
          {dirty ? ' Your unsaved changes will be discarded.' : ''}
        </>
      ),
      confirmLabel: `Make v${version} live`
    })
    if (ok) activate.mutate(version)
  }

  const deleteComponent = async () => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description: `${name} is archived on the server: it disappears from Studio and chat, schedules that run it are turned off, and its ID stays reserved.${dirty ? ' Your unsaved changes will be lost.' : ''}`,
      confirmLabel: `Delete ${noun}`,
      tone: 'danger'
    })
    if (ok) remove.mutate()
  }

  const discard = async () => {
    if (!dirty || (await confirmDiscard())) setDraft({})
  }

  const set = (field: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }))

  return (
    <PageBody>
      <div className="flex flex-wrap items-start gap-3.5">
        <KindIcon icon={KIND_ICON[kind]} size="lg" />
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-[-0.01em] break-words">
              {name}
            </h1>
            <Badge tone="accent">Studio-managed</Badge>
            {liveVersion !== undefined ? (
              <Badge tone="ok" dot>
                v{liveVersion} live
              </Badge>
            ) : (
              <Badge tone="warn" dot>
                Not published
              </Badge>
            )}
          </div>
          <p className="text-[13.5px] text-fg-3">
            {component.description || 'No description.'}
          </p>
        </div>
        <div className="flex gap-2">
          {liveVersion !== undefined ? (
            <Button variant="primary" asChild>
              <Link href={chatHref(kind, id)}>
                <MessageSquare aria-hidden />
                {kind === 'workflow' ? 'Run in chat' : 'Chat'}
              </Link>
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled
              title="Publish a version to chat with it"
            >
              <MessageSquare aria-hidden />
              {kind === 'workflow' ? 'Run in chat' : 'Chat'}
            </Button>
          )}
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" aria-label="More actions">
                <Ellipsis />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                onSelect={() => void copyToClipboard(id, 'Component ID copied')}
              >
                <Copy aria-hidden />
                Copy component ID
              </MenuItem>
              <MenuItem
                disabled={!liveConfig}
                onSelect={() =>
                  void copyToClipboard(
                    formatJson(liveConfig?.config ?? {}),
                    'Configuration copied'
                  )
                }
              >
                <Copy aria-hidden />
                Copy configuration as JSON
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <SectionCard
          id="component-configuration"
          title="Configuration"
          description={
            hasInstructions
              ? 'Edit the system instructions and publish them as a new version.'
              : 'Edit the details and publish them as a new version.'
          }
          className="flex-[3_1_480px]"
        >
          <div className="flex flex-col gap-[18px] p-[18px]">
            <KeyValueList items={summaryItems(component, liveConfig?.config)} />
            <Divider />
            {configs.isPending ? (
              <div role="status" className="flex flex-col gap-3">
                <span className="sr-only">Loading the configuration…</span>
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-56 w-full rounded-lg" />
              </div>
            ) : configs.isError ? (
              <ErrorState
                compact
                title="Couldn't load the configuration"
                error={configs.error}
                onRetry={() => void configs.refetch()}
                retrying={configs.isFetching}
              />
            ) : (
              <form
                className="flex flex-col gap-[18px]"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault()
                  submitPublish()
                }}
              >
                <Field
                  label="Name"
                  htmlFor="component-name"
                  required
                  error={nameError}
                >
                  <Input
                    id="component-name"
                    value={values.name}
                    onChange={(event) => set('name')(event.target.value)}
                    autoComplete="off"
                    required
                    disabled={busy}
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={
                      nameError ? 'component-name-help' : undefined
                    }
                  />
                </Field>
                <Field
                  label="Description"
                  htmlFor="component-description"
                  help={
                    configOwnsDescription
                      ? 'Part of the version, so it is published with it.'
                      : 'Shown in Studio. Saved when you publish.'
                  }
                >
                  <Input
                    id="component-description"
                    value={values.description}
                    onChange={(event) => set('description')(event.target.value)}
                    autoComplete="off"
                    disabled={busy}
                    aria-describedby="component-description-help"
                  />
                </Field>
                {hasInstructions ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="component-instructions"
                        className="text-[13px] font-medium"
                      >
                        {kind === 'team'
                          ? 'Leader instructions'
                          : 'System instructions'}
                      </label>
                      {changed ? (
                        <Badge tone="warn" dot>
                          Unsaved changes
                        </Badge>
                      ) : null}
                    </div>
                    <Textarea
                      id="component-instructions"
                      rows={12}
                      value={values.instructions}
                      onChange={(event) =>
                        set('instructions')(event.target.value)
                      }
                      spellCheck={baseInstructions.format === 'text'}
                      disabled={busy}
                      className="font-mono text-[13px] leading-relaxed"
                      aria-invalid={instructionsError ? true : undefined}
                      aria-describedby="component-instructions-help"
                    />
                    <p
                      id="component-instructions-help"
                      className={cn(
                        'text-[12.5px]',
                        instructionsError ? 'text-bad' : 'text-fg-3'
                      )}
                    >
                      {instructionsError ??
                        (baseInstructions.format === 'json'
                          ? 'Stored as JSON, so it stays JSON in the new version. Other settings stay the same.'
                          : changed && liveConfig
                            ? `Edited since v${liveConfig.version}. Other settings stay the same in the new version.`
                            : 'Other settings stay the same in the new version.')}
                    </p>
                  </div>
                ) : null}
                <Field
                  label="Release notes"
                  htmlFor="component-notes"
                  help="Optional. Shown in the version history."
                >
                  <Input
                    id="component-notes"
                    value={values.notes}
                    onChange={(event) => set('notes')(event.target.value)}
                    placeholder="What changed? e.g. Updated financial compliance instructions"
                    autoComplete="off"
                    disabled={busy}
                    aria-describedby="component-notes-help"
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <p className="min-w-[200px] flex-1 text-[12.5px] text-fg-3">
                    Publishing makes v{nextVersion} live for new messages right
                    away.
                  </p>
                  <Button
                    variant="ghost"
                    disabled={!dirty || busy}
                    onClick={() => void discard()}
                  >
                    Discard changes
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      !changed ||
                      Boolean(nameError) ||
                      Boolean(instructionsError)
                    }
                    loading={publish.isPending}
                  >
                    {publish.isPending ? null : <Rocket aria-hidden />}
                    {publish.isPending
                      ? `Publishing v${nextVersion}…`
                      : `Publish v${nextVersion}`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </SectionCard>

        <SectionCard
          id="component-versions"
          title="Version history"
          description="Make an earlier version live again. Nothing is deleted."
          aside={
            configs.isSuccess ? (
              <Badge>{plural(versions.length, 'version', 'versions')}</Badge>
            ) : null
          }
          className="flex-[2_1_340px]"
        >
          <div className="flex flex-col gap-2.5 p-3.5">
            {configs.isPending ? (
              <LoadingRows rows={3} label="Loading versions" />
            ) : configs.isError ? (
              <ErrorState
                compact
                title="Couldn't load the version history"
                error={configs.error}
                onRetry={() => void configs.refetch()}
                retrying={configs.isFetching}
              />
            ) : versions.length === 0 ? (
              <p className="px-1 py-4 text-center text-[13px] text-fg-3">
                No versions you can see yet.
              </p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {versions.map((version) => {
                  const live = version.version === liveVersion
                  const published = version.stage === 'published'
                  const activating =
                    activate.isPending && activate.variables === version.version
                  return (
                    <li
                      key={version.version}
                      aria-current={live ? 'true' : undefined}
                      className={cn(
                        'flex flex-col gap-2 rounded-[10px] border px-3.5 py-3',
                        live ? 'border-ok bg-ok-soft' : 'border-line bg-surface'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] font-medium">
                          v{version.version}
                        </span>
                        {live ? (
                          <Badge tone="ok" dot>
                            Live
                          </Badge>
                        ) : null}
                        <Badge tone={published ? 'neutral' : 'warn'}>
                          {published ? 'Published' : capitalize(version.stage)}
                        </Badge>
                        {version.label ? (
                          <Badge className="font-mono">{version.label}</Badge>
                        ) : null}
                        <RelativeTime
                          value={version.created_at}
                          className="ml-auto text-[12.5px] text-fg-3"
                        />
                      </div>
                      <p
                        className={cn(
                          'text-[13.5px] break-words',
                          version.notes ? 'text-fg' : 'text-fg-3'
                        )}
                      >
                        {version.notes || 'No release notes.'}
                      </p>
                      {!live && published ? (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => void makeLive(version.version)}
                            disabled={busy && !activating}
                            loading={activating}
                          >
                            Make live
                          </Button>
                        </div>
                      ) : null}
                      {!published ? (
                        <p className="text-[12.5px] text-fg-3">
                          {"Drafts can't be made live from here."}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </SectionCard>
      </div>

      <Card
        role="region"
        aria-labelledby="component-danger"
        className="border-bad/40"
      >
        <div className="flex flex-wrap items-center gap-4 px-[18px] py-4">
          <div className="flex min-w-60 flex-1 flex-col gap-0.5">
            <h2
              id="component-danger"
              className="text-[15px] font-semibold text-bad"
            >
              Danger zone
            </h2>
            <p className="text-[13px] text-fg-3">
              Delete {name}. It stops running everywhere and its ID stays
              reserved.
            </p>
          </div>
          <Button
            variant="danger"
            onClick={() => void deleteComponent()}
            loading={remove.isPending}
            disabled={busy && !remove.isPending}
          >
            {remove.isPending ? null : <Trash2 aria-hidden />}
            Delete {noun}
          </Button>
        </div>
      </Card>
    </PageBody>
  )
}

/** Full page for one Studio-managed agent, team or workflow. */
export function ComponentDetailView({ componentId }: { componentId: string }) {
  const health = useHealthQuery()
  const component = useComponentQuery(componentId)
  const configs = useComponentConfigsQuery(componentId)
  const kind = component.data?.component_type

  const refresh = async () => {
    const status = await health.refetch()
    if (status.isSuccess)
      await Promise.all([component.refetch(), configs.refetch()])
  }

  let content: ReactNode
  if (health.isError && !component.data) {
    content = (
      <PageBody>
        <ErrorState
          title="Couldn't load this component"
          error={health.error}
          onRetry={() => void refresh()}
          retrying={health.isFetching}
        />
      </PageBody>
    )
  } else if (component.isPending) {
    content = (
      <PageBody>
        <div role="status" className="flex flex-col gap-5">
          <span className="sr-only">Loading…</span>
          <div className="flex items-center gap-3.5">
            <Skeleton className="size-11 rounded-[10px]" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-60" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <Skeleton className="h-[480px] flex-[3_1_480px] rounded-xl" />
            <Skeleton className="h-[320px] flex-[2_1_340px] rounded-xl" />
          </div>
        </div>
      </PageBody>
    )
  } else if (component.isError && isNotFound(component.error)) {
    content = (
      <PageBody>
        <EmptyState
          icon={<FileQuestion />}
          title="Component not found"
          description={
            <>
              Nothing called <span className="font-mono">{componentId}</span>{' '}
              exists, or it was deleted.
            </>
          }
          action={
            <Button size="sm" asChild>
              <Link href={SECTIONS.studio.tabs[0].href}>Back to Studio</Link>
            </Button>
          }
        />
      </PageBody>
    )
  } else if (component.isError) {
    content = (
      <PageBody>
        <ErrorState
          title="Couldn't load this component"
          error={component.error}
          onRetry={() => void component.refetch()}
          retrying={component.isFetching}
        />
      </PageBody>
    )
  } else {
    content = (
      <ComponentDetail
        key={componentId}
        component={component.data}
        configs={configs}
      />
    )
  }

  return (
    <>
      <DetailHeader
        kind={kind}
        name={component.data?.name || componentId}
        onRefresh={() => void refresh()}
        refreshing={component.isFetching || configs.isFetching}
      />
      <PageScroll>{content}</PageScroll>
    </>
  )
}
