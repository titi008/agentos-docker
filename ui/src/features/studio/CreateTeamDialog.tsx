'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Field, RequiredLegend } from '@/components/ui/field'
import { Input, SearchInput, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/utils'

import { SourceBadge } from './CatalogCard'
import { Checklist } from './Checklist'
import {
  ModelPicker,
  modelConfig,
  preventSubmitOnEnter
} from './CreateAgentDialog'
import { matchesQuery } from './lib'
import { useModelsQuery } from './queries'
import { useCreateComponent } from './useCreateComponent'
import type { CatalogItem } from './types'

interface CreateTeamDialogProps {
  /** Every agent (code-defined and Studio-managed), unaffected by page search. */
  agents: CatalogItem[]
  agentsLoading: boolean
  onClose: () => void
}

export function CreateTeamDialog({
  agents,
  agentsLoading,
  onClose
}: CreateTeamDialogProps) {
  const models = useModelsQuery()
  const create = useCreateComponent('team')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState<string | null>(null)
  const [instructions, setInstructions] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [touched, setTouched] = useState({
    name: false,
    instructions: false,
    members: false
  })

  const modelList = models.data?.models ?? []
  const modelId = model ?? modelList[0]?.id ?? ''
  const visibleAgents = agents.filter((agent) =>
    matchesQuery(agent.searchText, memberQuery)
  )

  const nameError = name.trim() ? null : 'Enter a name for the team.'
  const instructionsError = instructions.trim()
    ? null
    : 'Tell the leader how to coordinate the members.'
  const membersError = members.length ? null : 'Pick at least one member.'
  const valid =
    !nameError && !instructionsError && !membersError && Boolean(modelId)

  const close = () => {
    if (!create.isPending) onClose()
  }

  const submit = () => {
    setTouched({ name: true, instructions: true, members: true })
    if (!valid || create.isPending) return
    create.mutate(
      {
        name: name.trim(),
        component_type: 'team',
        description: description.trim() || undefined,
        stage: 'published',
        config: {
          name: name.trim(),
          instructions: instructions.trim(),
          model: modelConfig(modelList, modelId),
          members: members.map((agentId) => ({
            type: 'agent',
            agent_id: agentId
          }))
        }
      },
      { onSuccess: onClose }
    )
  }

  const showMembersError = touched.members && membersError

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title="New team"
      description="A leader coordinates the member agents you pick."
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
            {create.isPending ? 'Creating team…' : 'Create team'}
          </Button>
        </>
      }
    >
      <RequiredLegend />
      <Field
        label="Name"
        htmlFor="new-team-name"
        required
        error={touched.name ? nameError : null}
      >
        <Input
          id="new-team-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setTouched((state) => ({ ...state, name: true }))}
          placeholder="e.g. Growth Strategy Squad"
          autoComplete="off"
          required
          autoFocus
          aria-invalid={touched.name && nameError ? true : undefined}
          aria-describedby={
            touched.name && nameError ? 'new-team-name-help' : undefined
          }
        />
      </Field>
      <Field label="Description" htmlFor="new-team-description">
        <Input
          id="new-team-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Coordinated squad for marketing & SEO"
          autoComplete="off"
        />
      </Field>
      <ModelPicker
        id="new-team-model"
        label="Leader model"
        models={models}
        value={modelId}
        onChange={setModel}
        disabled={create.isPending}
      />
      <Field
        label="Leader instructions"
        htmlFor="new-team-instructions"
        required
        error={touched.instructions ? instructionsError : null}
      >
        <Textarea
          id="new-team-instructions"
          rows={3}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          onBlur={() =>
            setTouched((state) => ({ ...state, instructions: true }))
          }
          placeholder="Coordinate between member agents to achieve optimal growth..."
          required
          aria-invalid={
            touched.instructions && instructionsError ? true : undefined
          }
          aria-describedby={
            touched.instructions && instructionsError
              ? 'new-team-instructions-help'
              : undefined
          }
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span id="new-team-members" className="text-[13px] font-medium">
            Members
            <span className="ml-0.5 text-accent" aria-hidden>
              *
            </span>
          </span>
          <Badge tone={members.length ? 'accent' : 'neutral'}>
            {members.length} selected
          </Badge>
        </div>
        {agents.length > 6 ? (
          <SearchInput
            aria-label="Search agents"
            placeholder="Search agents"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            onKeyDown={preventSubmitOnEnter}
          />
        ) : null}
        {agentsLoading ? (
          <Skeleton className="h-40 w-full rounded-[10px]" />
        ) : (
          <Checklist
            labelledBy="new-team-members"
            describedBy="new-team-members-help"
            invalid={Boolean(showMembersError)}
            options={visibleAgents.map((agent) => ({
              value: agent.id,
              label: <span className="font-medium">{agent.name}</span>,
              description: <span className="font-mono">{agent.id}</span>,
              badge: <SourceBadge item={agent} />
            }))}
            selected={members}
            onToggle={(value, checked) => {
              setTouched((state) => ({ ...state, members: true }))
              setMembers((current) =>
                checked
                  ? [...current, value]
                  : current.filter((entry) => entry !== value)
              )
            }}
            emptyText={
              agents.length
                ? `No agents match “${memberQuery.trim()}”.`
                : 'There are no agents yet. Create an agent first.'
            }
          />
        )}
        <p
          id="new-team-members-help"
          className={cn(
            'text-[12.5px]',
            showMembersError ? 'text-bad' : 'text-fg-3'
          )}
        >
          Pick at least one member.
        </p>
      </div>
    </Modal>
  )
}
