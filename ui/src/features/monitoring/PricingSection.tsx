'use client'

import {
  useMutation,
  useQueryClient,
  type UseQueryResult
} from '@tanstack/react-query'
import { ChevronDown, History, Info, Plus, Tag } from 'lucide-react'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Card, Table, TableWrap, Td, Th, Tr } from '@/components/ui/data'
import { Modal } from '@/components/ui/dialog'
import { Field, RequiredLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SectionTitle } from '@/components/ui/page'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/states'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'

import { MONITORING_KEY, formatRate } from './format'
import type { PriceRate, PricingResponse, UpdatePriceRequest } from './types'

/* Validation -------------------------------------------------------------- */

function rateError(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter a rate'
  const amount = Number(trimmed)
  if (!Number.isFinite(amount)) return 'Enter a number'
  if (amount < 0) return "Can't be negative"
  return null
}

/** DOM-safe id fragment for a model id (which may contain / : . and spaces). */
function slug(modelId: string): string {
  return modelId.replace(
    /[^A-Za-z0-9_-]/g,
    (char) => `_${char.charCodeAt(0).toString(16)}`
  )
}

const rateRowId = (modelId: string) => `rate-row-${slug(modelId)}`
const rateInputId = (modelId: string) => `rate-in-${slug(modelId)}`

/* Editor state ------------------------------------------------------------ */

export interface RateDraft {
  modelId: string
  provider: string
  input: string
  output: string
  initialInput: string
  initialOutput: string
  attempted: boolean
}

export interface AddRateDraft {
  modelId: string
  provider: string
  input: string
  output: string
  initial: { modelId: string; provider: string }
  attempted: boolean
}

function newAddDraft(modelId = '', provider = ''): AddRateDraft {
  return {
    modelId,
    provider,
    input: '',
    output: '',
    initial: { modelId, provider },
    attempted: false
  }
}

function isEditDirty(draft: RateDraft | null): boolean {
  return Boolean(
    draft &&
    (draft.input !== draft.initialInput || draft.output !== draft.initialOutput)
  )
}

function isAddDirty(draft: AddRateDraft | null): boolean {
  return Boolean(
    draft &&
    (draft.modelId !== draft.initial.modelId ||
      draft.provider !== draft.initial.provider ||
      draft.input ||
      draft.output)
  )
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Inline rate editing and the add-rate dialog. Owned by the usage page so
 * the "Edit rate" buttons in the by-model table can open a pricing row.
 */
export function usePricingEditor(currentRates: PriceRate[]) {
  const api = useApi()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<RateDraft | null>(null)
  const [adding, setAdding] = useState<AddRateDraft | null>(null)
  const dirty = isEditDirty(editing) || isAddDirty(adding)

  const save = useMutation({
    mutationFn: (payload: UpdatePriceRequest) =>
      api.request<{ status: string; rate: PriceRate }>('/pricing', {
        method: 'POST',
        json: payload,
        fallbackPaths: ['/api/pricing']
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: api.key(MONITORING_KEY, 'pricing') }),
        qc.invalidateQueries({ queryKey: api.key(MONITORING_KEY, 'costs') })
      ]),
    onError: (error) =>
      toast.error("Couldn't save the rate", {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  useUnsavedChanges(dirty, 'the model rate')

  const confirmDiscardEdit = async (): Promise<boolean> => {
    if (!editing || !isEditDirty(editing)) return true
    return confirm({
      title: 'Discard rate change?',
      description: (
        <>
          The new rate for{' '}
          <span className="font-mono text-fg">{editing.modelId}</span> hasn’t
          been applied.
        </>
      ),
      confirmLabel: 'Discard change',
      cancelLabel: 'Keep editing',
      tone: 'danger'
    })
  }

  const revealRow = (modelId: string) => {
    const row = document.getElementById(rateRowId(modelId))
    row?.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    })
    document
      .getElementById(rateInputId(modelId))
      ?.focus({ preventScroll: true })
  }

  /** Opens the pricing row for a model, or the add dialog if it has no rate. */
  const startEdit = async (modelId: string, provider: string) => {
    if (editing?.modelId === modelId) {
      revealRow(modelId)
      return
    }
    if (!(await confirmDiscardEdit())) return
    save.reset()
    const rate = currentRates.find((item) => item.model_id === modelId)
    if (!rate) {
      setEditing(null)
      setAdding(newAddDraft(modelId, provider))
      return
    }
    const input = String(rate.input_cost_per_m)
    const output = String(rate.output_cost_per_m)
    flushSync(() =>
      setEditing({
        modelId,
        provider: rate.provider,
        input,
        output,
        initialInput: input,
        initialOutput: output,
        attempted: false
      })
    )
    revealRow(modelId)
  }

  const cancelEdit = () => {
    save.reset()
    setEditing(null)
  }

  const openAdd = async () => {
    if (!(await confirmDiscardEdit())) return
    save.reset()
    setEditing(null)
    setAdding(newAddDraft())
  }

  const closeAdd = async () => {
    if (
      isAddDirty(adding) &&
      !(await confirm({
        title: 'Discard this rate?',
        description: 'The model rate you entered hasn’t been added.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        tone: 'danger'
      }))
    ) {
      return
    }
    save.reset()
    setAdding(null)
  }

  return {
    editing,
    setEditing,
    adding,
    setAdding,
    save,
    startEdit,
    cancelEdit,
    openAdd,
    closeAdd
  }
}

export type PricingEditor = ReturnType<typeof usePricingEditor>

/* Pieces ------------------------------------------------------------------ */

function MoneyInput({
  id,
  label,
  value,
  onChange,
  error,
  onEnter,
  onEscape,
  className
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | null
  onEnter?: () => void
  onEscape?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[13px] text-fg-3"
        >
          $
        </span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onEnter?.()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onEscape?.()
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-8 pl-6 font-mono text-[13px]"
        />
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-xs text-bad">
          {error}
        </span>
      ) : null}
    </div>
  )
}

function RateHistory({
  history,
  currentRates
}: {
  history: PriceRate[]
  currentRates: PriceRate[]
}) {
  const [open, setOpen] = useState(false)
  const current = new Set(
    currentRates.map((rate) => `${rate.model_id}\u0000${rate.effective_from}`)
  )
  const sorted = [...history].sort((a, b) =>
    a.effective_from < b.effective_from ? 1 : -1
  )

  return (
    <Card className="min-w-0 flex-[1_1_320px] self-start overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="rate-history"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold transition-colors hover:bg-hover max-md:min-h-11"
      >
        <History aria-hidden className="size-4 text-fg-3" />
        <span className="flex-1">Rate change history</span>
        <Badge>
          {sorted.length} {sorted.length === 1 ? 'version' : 'versions'}
        </Badge>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 text-fg-3 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open ? (
        <div id="rate-history" className="overflow-x-auto border-t border-line">
          {sorted.length ? (
            <table className="w-full min-w-[420px] border-collapse text-[13px]">
              <caption className="sr-only">
                Every rate version, newest first
              </caption>
              <thead>
                <tr>
                  <Th>Model</Th>
                  <Th>Effective from</Th>
                  <Th className="text-right">In</Th>
                  <Th className="text-right">Out</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((rate, index) => {
                  const isCurrent = current.has(
                    `${rate.model_id}\u0000${rate.effective_from}`
                  )
                  return (
                    <tr
                      key={`${rate.model_id}-${rate.effective_from}-${index}`}
                    >
                      <Td>
                        <span className="flex flex-col">
                          <span className="font-mono break-all text-fg">
                            {rate.model_id}
                          </span>
                          <span className="text-xs text-fg-3">
                            {rate.provider}
                            {isCurrent ? ' · current' : ''}
                          </span>
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-fg-3">
                        {formatDateTime(rate.effective_from)}
                      </Td>
                      <Td className="text-right font-mono whitespace-nowrap">
                        {formatRate(rate.input_cost_per_m)}
                      </Td>
                      <Td className="text-right font-mono whitespace-nowrap">
                        {formatRate(rate.output_cost_per_m)}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-3 text-[13px] text-fg-3">
              No rate changes recorded yet.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  )
}

function AddRateDialog({
  editor,
  currentRates,
  providers,
  saving,
  error,
  onSave
}: {
  editor: PricingEditor
  currentRates: PriceRate[]
  providers: string[]
  saving: boolean
  /** Message from the last failed save, shown above the fields. */
  error: string | null
  onSave: (payload: UpdatePriceRequest) => void
}) {
  const draft = editor.adding
  const update = (patch: Partial<AddRateDraft>) =>
    editor.setAdding((current) =>
      current ? { ...current, ...patch } : current
    )

  const modelId = draft?.modelId.trim() ?? ''
  const provider = draft?.provider.trim() ?? ''
  const exists = currentRates.some((rate) => rate.model_id === modelId)
  const errors = {
    modelId: !modelId
      ? 'Enter the model ID'
      : exists
        ? 'This model already has a rate. Use Update in the rates table.'
        : null,
    provider: provider ? null : 'Enter the provider',
    input: rateError(draft?.input ?? ''),
    output: rateError(draft?.output ?? '')
  }
  const show = (field: keyof typeof errors) =>
    draft?.attempted || (field === 'modelId' && exists) ? errors[field] : null
  const filled = Boolean(
    modelId && provider && draft?.input.trim() && draft?.output.trim()
  )

  const submit = () => {
    if (!draft) return
    if (Object.values(errors).some(Boolean)) {
      update({ attempted: true })
      return
    }
    onSave({
      model_id: modelId,
      provider,
      input_cost_per_m: Number(draft.input),
      output_cost_per_m: Number(draft.output)
    })
  }

  return (
    <Modal
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) void editor.closeAdd()
      }}
      title="Add model rate"
      description="Price a model that has no rate yet. The rate applies to runs from now on."
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={() => void editor.closeAdd()}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={!filled}
          >
            Add rate
          </Button>
        </>
      }
    >
      {error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-bad/40 bg-bad-soft px-3 py-2.5 text-[13px] text-fg-2"
        >
          {error}
        </p>
      ) : null}
      <RequiredLegend />
      <Field
        label="Model ID"
        htmlFor="add-rate-model"
        required
        help="Exactly as your runs report it, for example claude-sonnet-5-5."
        error={show('modelId')}
      >
        <Input
          id="add-rate-model"
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          value={draft?.modelId ?? ''}
          onChange={(event) => update({ modelId: event.target.value })}
          aria-invalid={show('modelId') ? true : undefined}
          aria-describedby="add-rate-model-help"
          required
        />
      </Field>
      <Field
        label="Provider"
        htmlFor="add-rate-provider"
        required
        error={show('provider')}
      >
        <Input
          id="add-rate-provider"
          list="add-rate-providers"
          autoComplete="off"
          value={draft?.provider ?? ''}
          onChange={(event) => update({ provider: event.target.value })}
          aria-invalid={show('provider') ? true : undefined}
          aria-describedby={
            show('provider') ? 'add-rate-provider-help' : undefined
          }
          required
        />
        <datalist id="add-rate-providers">
          {providers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field
          label="Input $ per 1M tokens"
          htmlFor="add-rate-input"
          required
          error={show('input')}
        >
          <Input
            id="add-rate-input"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            className="font-mono"
            value={draft?.input ?? ''}
            onChange={(event) => update({ input: event.target.value })}
            aria-invalid={show('input') ? true : undefined}
            aria-describedby={show('input') ? 'add-rate-input-help' : undefined}
            required
          />
        </Field>
        <Field
          label="Output $ per 1M tokens"
          htmlFor="add-rate-output"
          required
          error={show('output')}
        >
          <Input
            id="add-rate-output"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            className="font-mono"
            value={draft?.output ?? ''}
            onChange={(event) => update({ output: event.target.value })}
            aria-invalid={show('output') ? true : undefined}
            aria-describedby={
              show('output') ? 'add-rate-output-help' : undefined
            }
            required
          />
        </Field>
      </div>
    </Modal>
  )
}

/* Section ----------------------------------------------------------------- */

export function PricingSection({
  pricing,
  editor,
  knownProviders
}: {
  pricing: UseQueryResult<PricingResponse>
  editor: PricingEditor
  /** Provider names seen in costs, offered when adding a rate. */
  knownProviders: string[]
}) {
  const api = useApi()
  const { save } = editor

  const currentRates = [...(pricing.data?.current_rates ?? [])].sort(
    (a, b) =>
      a.provider.localeCompare(b.provider) ||
      a.model_id.localeCompare(b.model_id)
  )
  const history = pricing.data?.history ?? []
  const providers = [
    ...new Set([
      ...currentRates.map((rate) => rate.provider),
      ...knownProviders
    ])
  ]
    .filter((name) => name && name !== 'Unknown')
    .sort((a, b) => a.localeCompare(b))

  const { editing } = editor
  const editErrors = editing
    ? { input: rateError(editing.input), output: rateError(editing.output) }
    : null
  const savingModel = save.isPending ? save.variables?.model_id : undefined
  const failedModel =
    save.isError && !save.isPending ? save.variables?.model_id : undefined

  const updateEditing = (patch: Partial<RateDraft>) =>
    editor.setEditing((current) =>
      current ? { ...current, ...patch } : current
    )

  const applyEdit = () => {
    if (!editing || !editErrors) return
    if (editErrors.input || editErrors.output) {
      updateEditing({ attempted: true })
      return
    }
    save.mutate(
      {
        model_id: editing.modelId,
        provider: editing.provider,
        input_cost_per_m: Number(editing.input),
        output_cost_per_m: Number(editing.output)
      },
      {
        onSuccess: () => {
          toast.success(`New rate applied to ${editing.modelId}`)
          editor.setEditing(null)
        }
      }
    )
  }

  const saveNew = (payload: UpdatePriceRequest) =>
    save.mutate(payload, {
      onSuccess: () => {
        toast.success(`Rate added for ${payload.model_id}`)
        editor.setAdding(null)
      }
    })

  const showEditError = (field: 'input' | 'output') =>
    editing && editErrors
      ? editing.attempted ||
        (field === 'input'
          ? editing.input !== editing.initialInput
          : editing.output !== editing.initialOutput)
        ? editErrors[field]
        : null
      : null

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <SectionTitle id="pricing-title">Model pricing</SectionTitle>
          <p className="text-[12.5px] text-fg-3">
            Dollars per 1 million tokens, used to estimate every cost on this
            page.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void editor.openAdd()}
          disabled={!pricing.data}
        >
          <Plus aria-hidden />
          Add model rate
        </Button>
      </div>

      <div className="flex items-start gap-2.5 rounded-[10px] bg-info-soft px-3.5 py-3 text-[13.5px] text-fg">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
        <span>
          Rate changes apply to new runs only. Past runs keep the rate that was
          in effect.
        </span>
      </div>

      {pricing.isPending ? (
        <LoadingRows rows={4} label="Loading model rates" />
      ) : pricing.isError ? (
        <ErrorState
          title="Couldn't load model pricing"
          error={pricing.error}
          onRetry={() => void pricing.refetch()}
          retrying={pricing.isFetching}
        />
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          {currentRates.length ? (
            <TableWrap className="min-w-0 flex-[2_1_600px]">
              <Table className="min-w-[680px]">
                <caption className="sr-only">Current model rates</caption>
                <thead>
                  <tr>
                    <Th>Model</Th>
                    <Th>Provider</Th>
                    <Th>Input / 1M</Th>
                    <Th>Output / 1M</Th>
                    <Th>Effective from</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {currentRates.map((rate) => {
                    const isEditing = editing?.modelId === rate.model_id
                    const saving = savingModel === rate.model_id
                    if (isEditing && editing) {
                      return (
                        <Tr
                          key={rate.model_id}
                          id={rateRowId(rate.model_id)}
                          selected
                        >
                          <Td className="font-mono text-fg">{rate.model_id}</Td>
                          <Td>{rate.provider}</Td>
                          <Td className="align-top">
                            <MoneyInput
                              id={rateInputId(rate.model_id)}
                              label={`Input cost per 1M tokens for ${rate.model_id}`}
                              value={editing.input}
                              onChange={(input) => updateEditing({ input })}
                              error={showEditError('input')}
                              onEnter={applyEdit}
                              onEscape={editor.cancelEdit}
                              className="w-[110px]"
                            />
                          </Td>
                          <Td className="align-top">
                            <MoneyInput
                              id={`rate-out-${slug(rate.model_id)}`}
                              label={`Output cost per 1M tokens for ${rate.model_id}`}
                              value={editing.output}
                              onChange={(output) => updateEditing({ output })}
                              error={showEditError('output')}
                              onEnter={applyEdit}
                              onEscape={editor.cancelEdit}
                              className="w-[110px]"
                            />
                          </Td>
                          <Td>
                            <span className="text-[12.5px] text-fg-2">
                              Starts when you apply
                            </span>
                            {failedModel === rate.model_id ? (
                              <span
                                role="alert"
                                className="mt-1 block text-xs text-bad"
                              >
                                {getErrorMessage(save.error, api.ctx.endpoint)}
                              </span>
                            ) : null}
                          </Td>
                          <Td className="text-right">
                            <span className="inline-flex gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={editor.cancelEdit}
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={saving}
                                onClick={applyEdit}
                              >
                                Apply new rate
                              </Button>
                            </span>
                          </Td>
                        </Tr>
                      )
                    }
                    return (
                      <Tr key={rate.model_id} id={rateRowId(rate.model_id)}>
                        <Td className="font-mono text-fg">{rate.model_id}</Td>
                        <Td>{rate.provider}</Td>
                        <Td className="font-mono">
                          {formatRate(rate.input_cost_per_m)}
                        </Td>
                        <Td className="font-mono">
                          {formatRate(rate.output_cost_per_m)}
                        </Td>
                        <Td className="whitespace-nowrap text-fg-3">
                          {formatDateTime(rate.effective_from)}
                        </Td>
                        <Td className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Update rate for ${rate.model_id}`}
                            disabled={save.isPending}
                            onClick={() =>
                              void editor.startEdit(
                                rate.model_id,
                                rate.provider
                              )
                            }
                          >
                            Update
                          </Button>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState
              className="min-w-0 flex-[2_1_600px]"
              icon={<Tag />}
              title="No model rates yet"
              description="Add a rate for each model your agents use so this page can estimate costs."
              action={
                <Button size="sm" onClick={() => void editor.openAdd()}>
                  <Plus aria-hidden />
                  Add model rate
                </Button>
              }
            />
          )}
          <RateHistory history={history} currentRates={currentRates} />
        </div>
      )}

      <AddRateDialog
        editor={editor}
        currentRates={currentRates}
        providers={providers}
        saving={save.isPending}
        error={
          editor.adding &&
          failedModel &&
          failedModel === editor.adding.modelId.trim()
            ? getErrorMessage(save.error, api.ctx.endpoint)
            : null
        }
        onSave={saveNew}
      />
    </section>
  )
}
