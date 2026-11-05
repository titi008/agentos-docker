'use client'

import { useState, type KeyboardEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Field, RequiredLegend } from '@/components/ui/field'
import { Input, SearchInput, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/states'

import { Checklist } from './Checklist'
import {
  isAttachableTool,
  matchesQuery,
  registryFunctions,
  registryKey,
  registryTypeLabel,
  toolConfigEntries
} from './lib'
import { ModelSelect } from './ModelSelect'
import { useModelsQuery, useRegistryQuery } from './queries'
import { useCreateComponent } from './useCreateComponent'
import type { ModelList, ModelOption } from './types'

/** Model field shared by the agent and team dialogs. */
export function ModelPicker({
  id,
  label,
  models,
  value,
  onChange,
  disabled
}: {
  id: string
  label: string
  models: { isPending: boolean; data?: ModelList }
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      help={
        models.data && !models.data.fromServer
          ? "The server's model list couldn't be loaded, so default models are shown."
          : 'Models come from your AgentOS server.'
      }
    >
      {models.isPending ? (
        <Skeleton className="h-9 w-full rounded-lg" />
      ) : (
        <ModelSelect
          id={id}
          models={models.data?.models ?? []}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          aria-describedby={`${id}-help`}
        />
      )}
    </Field>
  )
}

/** Keeps Enter in a filter box from submitting the surrounding dialog form. */
export function preventSubmitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.preventDefault()
}

/** `{ id, provider }` as stored in a config; the registry resolves it by id. */
export function modelConfig(models: ModelOption[], modelId: string) {
  const provider = models.find((model) => model.id === modelId)?.provider
  return provider ? { id: modelId, provider } : { id: modelId }
}

export function CreateAgentDialog({ onClose }: { onClose: () => void }) {
  const models = useModelsQuery()
  const registry = useRegistryQuery()
  const create = useCreateComponent('agent')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState<string | null>(null)
  const [instructions, setInstructions] = useState('')
  const [tools, setTools] = useState<string[]>([])
  const [toolQuery, setToolQuery] = useState('')
  const [touched, setTouched] = useState({ name: false, instructions: false })

  const modelList = models.data?.models ?? []
  const modelId = model ?? modelList[0]?.id ?? ''
  const toolResources = (registry.data ?? []).filter(isAttachableTool)
  const visibleTools = toolResources.filter((resource) =>
    matchesQuery(
      `${resource.name}\n${resource.description ?? ''}`.toLowerCase(),
      toolQuery
    )
  )

  const nameError = name.trim() ? null : 'Enter a name for the agent.'
  const instructionsError = instructions.trim()
    ? null
    : 'Tell the agent what to do.'
  const valid = !nameError && !instructionsError && Boolean(modelId)

  const close = () => {
    if (!create.isPending) onClose()
  }

  const submit = () => {
    setTouched({ name: true, instructions: true })
    if (!valid || create.isPending) return
    const selected = toolResources.filter((resource) =>
      tools.includes(registryKey(resource))
    )
    create.mutate(
      {
        name: name.trim(),
        component_type: 'agent',
        description: description.trim() || undefined,
        stage: 'published',
        config: {
          name: name.trim(),
          instructions: instructions.trim(),
          model: modelConfig(modelList, modelId),
          tools: selected.flatMap(toolConfigEntries)
        }
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title="New agent"
      description="Studio-managed agents are versioned and editable here."
      onSubmit={submit}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={close}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={create.isPending}
            disabled={!valid}
          >
            {create.isPending ? 'Creating agent…' : 'Create agent'}
          </Button>
        </>
      }
    >
      <RequiredLegend />
      <Field
        label="Name"
        htmlFor="new-agent-name"
        required
        error={touched.name ? nameError : null}
      >
        <Input
          id="new-agent-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setTouched((state) => ({ ...state, name: true }))}
          placeholder="e.g. Compliance Auditor"
          autoComplete="off"
          required
          autoFocus
          aria-invalid={touched.name && nameError ? true : undefined}
          aria-describedby={
            touched.name && nameError ? 'new-agent-name-help' : undefined
          }
        />
      </Field>
      <Field label="Description" htmlFor="new-agent-description">
        <Input
          id="new-agent-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Audits agreements against regulations"
          autoComplete="off"
        />
      </Field>
      <ModelPicker
        id="new-agent-model"
        label="Model"
        models={models}
        value={modelId}
        onChange={setModel}
        disabled={create.isPending}
      />
      <Field
        label="System instructions"
        htmlFor="new-agent-instructions"
        required
        error={touched.instructions ? instructionsError : null}
      >
        <Textarea
          id="new-agent-instructions"
          rows={4}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          onBlur={() =>
            setTouched((state) => ({ ...state, instructions: true }))
          }
          placeholder="You are an expert compliance agent..."
          required
          aria-invalid={
            touched.instructions && instructionsError ? true : undefined
          }
          aria-describedby={
            touched.instructions && instructionsError
              ? 'new-agent-instructions-help'
              : undefined
          }
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span id="new-agent-tools" className="text-[13px] font-medium">
            Tools from the registry
          </span>
          <Badge tone={tools.length ? 'accent' : 'neutral'}>
            {tools.length} selected
          </Badge>
        </div>
        <SearchInput
          aria-label="Search tools"
          placeholder="Search tools and toolkits"
          value={toolQuery}
          onChange={(event) => setToolQuery(event.target.value)}
          onKeyDown={preventSubmitOnEnter}
        />
        {registry.isPending ? (
          <Skeleton className="h-40 w-full rounded-[10px]" />
        ) : (
          <Checklist
            labelledBy="new-agent-tools"
            options={visibleTools.map((resource) => {
              const functions = registryFunctions(resource)
              return {
                value: registryKey(resource),
                label: <span className="font-mono">{resource.name}</span>,
                description: functions.length
                  ? resource.description ||
                    functions.map((fn) => fn.name).join(', ')
                  : 'No functions available yet, so it cannot be attached.',
                badge: <Badge>{registryTypeLabel(resource)}</Badge>,
                disabled: functions.length === 0
              }
            })}
            selected={tools}
            onToggle={(value, checked) =>
              setTools((current) =>
                checked
                  ? [...current, value]
                  : current.filter((entry) => entry !== value)
              )
            }
            emptyText={
              registry.isError
                ? "Couldn't load the registry. Close this dialog and try again."
                : toolResources.length
                  ? `No tools match “${toolQuery.trim()}”.`
                  : 'The registry has no tools yet.'
            }
          />
        )}
      </div>
    </Modal>
  )
}
