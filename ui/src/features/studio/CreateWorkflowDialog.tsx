'use client'

import { ArrowDown, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Field, RequiredLegend } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { useRegistryQuery } from './queries'
import { useCreateComponent } from './useCreateComponent'
import type { CatalogItem } from './types'

type StepType = 'agent' | 'team' | 'function'

interface StepDraft {
  key: number
  type: StepType
  target: string
  name: string
  /** False while the name still follows the chosen target. */
  nameEdited: boolean
}

interface TargetOption {
  value: string
  label: string
}

const TYPE_LABEL: Record<StepType, string> = {
  agent: 'Agent',
  team: 'Team',
  function: 'Function'
}

let lastStepKey = 0
const nextStepKey = () => {
  lastStepKey += 1
  return lastStepKey
}

function focusLater(id: string, fallbackId?: string) {
  window.requestAnimationFrame(() => {
    const element = document.getElementById(id)
    if (
      element instanceof HTMLButtonElement &&
      element.disabled &&
      fallbackId
    ) {
      document.getElementById(fallbackId)?.focus()
    } else {
      element?.focus()
    }
  })
}

interface CreateWorkflowDialogProps {
  agents: CatalogItem[]
  teams: CatalogItem[]
  onClose: () => void
}

export function CreateWorkflowDialog({
  agents,
  teams,
  onClose
}: CreateWorkflowDialogProps) {
  const registry = useRegistryQuery()
  const create = useCreateComponent('workflow')

  const targets: Record<StepType, TargetOption[]> = {
    agent: agents.map((agent) => ({ value: agent.id, label: agent.name })),
    team: teams.map((team) => ({ value: team.id, label: team.name })),
    function: (registry.data ?? [])
      .filter((resource) => resource.type === 'function')
      .map((resource) => ({ value: resource.name, label: resource.name }))
  }
  const labelOf = (type: StepType, value: string) =>
    targets[type].find((option) => option.value === value)?.label ?? ''

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([])
  const [nameTouched, setNameTouched] = useState(false)

  const makeStep = (type: StepType, target?: string): StepDraft => {
    const value = target ?? targets[type][0]?.value ?? ''
    return {
      key: nextStepKey(),
      type,
      target: value,
      name: value ? labelOf(type, value) : '',
      nameEdited: false
    }
  }

  const updateStep = (key: number, patch: (step: StepDraft) => StepDraft) =>
    setSteps((current) =>
      current.map((step) => (step.key === key ? patch(step) : step))
    )

  const addStep = () => {
    const type: StepType = targets.agent.length
      ? 'agent'
      : targets.team.length
        ? 'team'
        : targets.function.length
          ? 'function'
          : 'agent'
    const step = makeStep(type)
    setSteps((current) => [...current, step])
    focusLater(`step-${step.key}-type`)
  }

  const moveStep = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= steps.length) return
    const moved = steps[index]
    setSteps((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    const direction = delta < 0 ? 'up' : 'down'
    focusLater(
      `step-${moved.key}-${direction}`,
      `step-${moved.key}-${direction === 'up' ? 'down' : 'up'}`
    )
  }

  const removeStep = (key: number) => {
    setSteps((current) => current.filter((step) => step.key !== key))
    focusLater('workflow-add-step')
  }

  const names = steps.map((step) => step.name.trim().toLowerCase())
  const stepErrors = steps.map((step, index) => {
    if (!step.target)
      return `Pick ${step.type === 'agent' ? 'an' : 'a'} ${step.type} for this step.`
    if (!step.name.trim()) return 'Name this step.'
    if (names.indexOf(names[index]) !== index)
      return 'Each step needs a unique name.'
    return null
  })
  const nameError = name.trim() ? null : 'Enter a name for the workflow.'
  const stepsError = steps.length ? null : 'Add at least one step.'
  const valid =
    !nameError && !stepsError && stepErrors.every((error) => error === null)

  const close = () => {
    if (!create.isPending) onClose()
  }

  const submit = () => {
    setNameTouched(true)
    if (!valid || create.isPending) return
    create.mutate(
      {
        name: name.trim(),
        component_type: 'workflow',
        description: description.trim() || undefined,
        stage: 'published',
        config: {
          name: name.trim(),
          steps: steps.map((step) => ({
            type: 'Step',
            name: step.name.trim(),
            ...(step.type === 'agent'
              ? { agent_id: step.target }
              : step.type === 'team'
                ? { team_id: step.target }
                : { executor_ref: step.target })
          }))
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
      size="lg"
      title="New workflow"
      description="Steps run in order. Each step gets the previous step's output."
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
            {create.isPending ? 'Creating workflow…' : 'Create workflow'}
          </Button>
        </>
      }
    >
      <RequiredLegend />
      <Field
        label="Name"
        htmlFor="new-workflow-name"
        required
        error={nameTouched ? nameError : null}
      >
        <Input
          id="new-workflow-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder="e.g. Content Ingestion & Formatting Pipeline"
          autoComplete="off"
          required
          autoFocus
          aria-invalid={nameTouched && nameError ? true : undefined}
          aria-describedby={
            nameTouched && nameError ? 'new-workflow-name-help' : undefined
          }
        />
      </Field>
      <Field label="Description" htmlFor="new-workflow-description">
        <Input
          id="new-workflow-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Researches, formats to JSON, and summarizes output"
          autoComplete="off"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span id="new-workflow-steps" className="text-[13px] font-medium">
            Steps
            <span className="ml-0.5 text-accent" aria-hidden>
              *
            </span>
          </span>
          <span className="text-[12.5px] text-fg-3">
            Use the arrows to reorder
          </span>
        </div>

        {steps.length ? (
          <ol aria-labelledby="new-workflow-steps" className="flex flex-col">
            {steps.map((step, index) => {
              const error = stepErrors[index]
              const number = index + 1
              const options = targets[step.type]
              const base = `step-${step.key}`
              return (
                <li key={step.key} className="flex flex-col">
                  {index > 0 ? (
                    <ArrowDown
                      aria-hidden
                      className="mx-auto my-1 size-4 text-fg-3"
                    />
                  ) : null}
                  <div
                    className={cn(
                      'flex flex-col gap-2 rounded-[10px] border bg-raised p-2.5',
                      error ? 'border-bad' : 'border-line'
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="flex items-center">
                        <Button
                          id={`${base}-up`}
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move step ${number} up`}
                          disabled={index === 0}
                          onClick={() => moveStep(index, -1)}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          id={`${base}-down`}
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move step ${number} down`}
                          disabled={index === steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                        >
                          <ChevronDown />
                        </Button>
                      </div>
                      <span
                        aria-hidden
                        className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
                      >
                        {number}
                      </span>
                      <label htmlFor={`${base}-type`} className="sr-only">
                        Step {number} type
                      </label>
                      <Select
                        id={`${base}-type`}
                        className="w-28"
                        value={step.type}
                        onChange={(event) => {
                          const type = event.target.value as StepType
                          const target = targets[type][0]?.value ?? ''
                          updateStep(step.key, (current) => ({
                            ...current,
                            type,
                            target,
                            name: current.nameEdited
                              ? current.name
                              : labelOf(type, target)
                          }))
                        }}
                      >
                        {(Object.keys(TYPE_LABEL) as StepType[]).map((type) => (
                          <option key={type} value={type}>
                            {TYPE_LABEL[type]}
                          </option>
                        ))}
                      </Select>
                      <label htmlFor={`${base}-target`} className="sr-only">
                        Step {number} {TYPE_LABEL[step.type].toLowerCase()}
                      </label>
                      <Select
                        id={`${base}-target`}
                        className="min-w-40 flex-1"
                        value={step.target}
                        aria-invalid={error && !step.target ? true : undefined}
                        aria-describedby={error ? `${base}-error` : undefined}
                        onChange={(event) => {
                          const target = event.target.value
                          updateStep(step.key, (current) => ({
                            ...current,
                            target,
                            name: current.nameEdited
                              ? current.name
                              : labelOf(current.type, target)
                          }))
                        }}
                      >
                        {step.target ? null : (
                          <option value="" disabled>
                            {options.length
                              ? `Select ${step.type === 'agent' ? 'an' : 'a'} ${step.type}`
                              : `No ${step.type}s available`}
                          </option>
                        )}
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove step ${number}`}
                        onClick={() => removeStep(step.key)}
                      >
                        <X />
                      </Button>
                    </div>
                    <label htmlFor={`${base}-name`} className="sr-only">
                      Step {number} name
                    </label>
                    <Input
                      id={`${base}-name`}
                      value={step.name}
                      placeholder="Step name"
                      autoComplete="off"
                      className="h-8 text-[13px]"
                      aria-invalid={
                        error && step.target && !step.name.trim()
                          ? true
                          : undefined
                      }
                      aria-describedby={error ? `${base}-error` : undefined}
                      onChange={(event) => {
                        const value = event.target.value
                        updateStep(step.key, (current) => ({
                          ...current,
                          name: value,
                          nameEdited: value.trim() !== ''
                        }))
                      }}
                    />
                    {error ? (
                      <p
                        id={`${base}-error`}
                        className="text-[12.5px] text-bad"
                      >
                        {error}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="rounded-[10px] border border-dashed border-line-strong px-3 py-5 text-center text-[13px] text-fg-3">
            Add at least one step. For example: a researcher agent, then a
            function such as extract_json, then a writer agent.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button id="workflow-add-step" size="sm" onClick={addStep}>
            <Plus aria-hidden />
            Add step
          </Button>
          <span className="text-[12.5px] text-fg-3">
            Agents, teams or registry functions.
          </span>
        </div>
      </div>
    </Modal>
  )
}
