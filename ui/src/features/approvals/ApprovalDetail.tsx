'use client'

import { Check, ExternalLink, Info, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock, CopyButton, formatJson } from '@/components/ui/code'
import { Card, KeyValueList, type KeyValueItem } from '@/components/ui/data'
import { DetailPanel } from '@/components/ui/detail-panel'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented'
import { ErrorState, LoadingRows } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'
import { formatDateTime } from '@/lib/time'

import {
  parseInput,
  pendingActions,
  requesterName,
  resolutionNote,
  SOURCE_LABEL,
  sourceLabel,
  sourceOf,
  statusMeta,
  typeLabel,
  type InputField,
  type PendingAction
} from './model'
import {
  approvalChatHref,
  useApprovalQuery,
  useComponentNames,
  useResolveApproval,
  useSessionName
} from './queries'
import type {
  Approval,
  ApprovalDecision,
  ResolutionData,
  SourceKind
} from './types'

function ArgValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return value ? (
      <span className="[overflow-wrap:anywhere] whitespace-pre-wrap">
        {value}
      </span>
    ) : (
      <span className="text-fg-3">Empty</span>
    )
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="font-mono text-[12.5px]">{String(value)}</span>
  }
  if (value === null || value === undefined) {
    return <span className="font-mono text-[12.5px] text-fg-3">null</span>
  }
  return (
    <pre className="font-mono text-[12.5px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-fg-2">
      {formatJson(value)}
    </pre>
  )
}

function ArgsTable({ args }: { args: Record<string, unknown> | null }) {
  const entries = Object.entries(args ?? {})
  if (entries.length === 0) {
    return <p className="text-[13px] text-fg-3">No arguments.</p>
  }
  return (
    <Card className="overflow-hidden">
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                className="w-[120px] px-3.5 py-2.5 text-left align-top font-mono text-[12.5px] font-normal break-all text-fg-3 max-sm:w-[96px]"
              >
                {key}
              </th>
              <td className="min-w-0 px-3.5 py-2.5 align-top text-fg">
                <ArgValue value={value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function ActionArgs({
  action,
  view,
  showName
}: {
  action: PendingAction
  view: 'readable' | 'raw'
  showName: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      {showName || action.memberName ? (
        <p className="text-[13px] text-fg-2">
          {showName ? (
            <span className="font-mono font-medium text-fg">
              {action.toolName}
            </span>
          ) : null}
          {action.memberName ? (
            <span className="text-fg-3">
              {showName ? ' · ' : ''}called by {action.memberName}
            </span>
          ) : null}
        </p>
      ) : null}
      {view === 'readable' ? (
        <ArgsTable args={action.args} />
      ) : (
        <CodeBlock
          code={formatJson(action.args ?? {})}
          label="tool_args"
          maxHeight="20rem"
        />
      )}
    </div>
  )
}

function InputControl({
  field,
  value,
  error,
  onChange
}: {
  field: InputField
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const id = `approval-input-${field.name}`
  const describedBy = error || field.description ? `${id}-help` : undefined
  return (
    <Field
      label={<span className="font-mono">{field.name}</span>}
      htmlFor={id}
      required
      error={error}
      help={field.description}
    >
      {field.type === 'bool' ? (
        <Select
          id={id}
          value={value}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choose…</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      ) : (
        <Input
          id={id}
          value={value}
          inputMode={
            field.type === 'int'
              ? 'numeric'
              : field.type === 'float'
                ? 'decimal'
                : undefined
          }
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  )
}

const initialValue = (field: InputField): string =>
  field.value === null || field.value === undefined ? '' : String(field.value)

/** Decision inputs (body) and the Reject / Approve bar (footer) for a waiting request. */
function usePendingForm(
  approval: Approval,
  actions: PendingAction[],
  onResolved: (approvalId: string) => void
) {
  const resolve = useResolveApproval()
  const fields =
    approval.pause_type === 'user_input'
      ? actions.flatMap((action) => action.inputFields)
      : []
  const needsResult = approval.pause_type === 'external_execution'
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, initialValue(field)]))
  )
  const [result, setResult] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const decide = (decision: ApprovalDecision) => {
    if (resolve.isPending) return
    const resolution: ResolutionData = {}
    if (decision === 'approved') {
      const nextErrors: Record<string, string> = {}
      for (const field of fields) {
        if (!values[field.name]?.trim()) {
          nextErrors[field.name] = 'Enter a value to approve.'
        }
      }
      if (needsResult && !result.trim()) {
        nextErrors.result = 'Enter the result to approve.'
      }
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) return
      if (fields.length > 0) {
        resolution.values = Object.fromEntries(
          fields.map((field) => [
            field.name,
            parseInput(field, values[field.name] ?? '')
          ])
        )
      }
      if (needsResult) resolution.result = result
    }
    if (note.trim()) resolution.note = note.trim()
    resolve.mutate(
      {
        approval,
        decision,
        resolution: Object.keys(resolution).length > 0 ? resolution : undefined
      },
      { onSuccess: () => onResolved(approval.id) }
    )
  }

  const pending = resolve.isPending ? resolve.variables.decision : null

  return {
    body: (
      <>
        {fields.length > 0 ? (
          <section
            className="flex flex-col gap-3"
            aria-labelledby="approval-inputs"
          >
            <h3 id="approval-inputs" className="text-[15px] font-semibold">
              Values it needs from you
            </h3>
            {fields.map((field) => (
              <InputControl
                key={field.name}
                field={field}
                value={values[field.name] ?? ''}
                error={errors[field.name]}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.name]: value }))
                }
              />
            ))}
          </section>
        ) : null}
        {needsResult ? (
          <Field
            label="Result"
            htmlFor="approval-result"
            required
            error={errors.result}
            help={
              errors.result
                ? undefined
                : 'This tool runs outside AgentOS. Paste what it returned.'
            }
          >
            <Textarea
              id="approval-result"
              rows={4}
              value={result}
              aria-invalid={Boolean(errors.result) || undefined}
              aria-describedby="approval-result-help"
              onChange={(event) => setResult(event.target.value)}
            />
          </Field>
        ) : null}
        <Field
          label={
            <>
              Note <span className="font-normal text-fg-3">(optional)</span>
            </>
          }
          htmlFor="approval-note"
          help="Saved with your decision."
        >
          <Textarea
            id="approval-note"
            rows={2}
            maxLength={2000}
            value={note}
            placeholder="Why you approved or rejected it"
            aria-describedby="approval-note-help"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </>
    ),
    footer: (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <p className="flex min-w-[200px] flex-1 items-center gap-1.5 text-[12.5px] text-fg-3">
          <Info aria-hidden className="size-3.5 shrink-0" />
          Approving runs this action right away.
        </p>
        <div className="flex gap-2 max-md:w-full max-md:*:flex-1">
          <Button
            variant="danger"
            loading={pending === 'rejected'}
            disabled={pending !== null}
            onClick={() => decide('rejected')}
          >
            {pending === 'rejected' ? null : <X />}
            Reject
          </Button>
          <Button
            variant="primary"
            loading={pending === 'approved'}
            disabled={pending !== null}
            onClick={() => decide('approved')}
          >
            {pending === 'approved' ? null : <Check />}
            Approve
          </Button>
        </div>
      </div>
    )
  }
}

function detailItems(
  approval: Approval,
  requester: string,
  kind: SourceKind | null,
  sessionName: string | null | undefined
): KeyValueItem[] {
  const href = approvalChatHref(approval)
  const items: KeyValueItem[] = [
    {
      label: 'Requested by',
      value: (
        <span className="flex flex-wrap items-center gap-2">
          {requester}
          {kind ? <Badge>{SOURCE_LABEL[kind]}</Badge> : null}
        </span>
      )
    },
    {
      label: 'Session',
      value: (
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {sessionName ? (
            <span className="min-w-0">{sessionName}</span>
          ) : (
            <span className="min-w-0 font-mono text-[12.5px] break-all">
              {approval.session_id || '—'}
            </span>
          )}
          {href ? (
            <Link
              href={href}
              className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline"
            >
              Open chat
              <ExternalLink aria-hidden className="size-3.5" />
            </Link>
          ) : null}
        </span>
      )
    },
    {
      label: 'Run ID',
      value: (
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-mono text-[12.5px]">
            {approval.run_id}
          </span>
          <CopyButton
            value={approval.run_id}
            aria-label="Copy run ID"
            successMessage="Run ID copied"
          />
        </span>
      )
    },
    { label: 'Type', value: typeLabel(approval) },
    { label: 'Source', value: sourceLabel(approval) },
    {
      label: 'Requested at',
      value: approval.created_at ? (
        <>
          {formatDateTime(approval.created_at)}{' '}
          <span className="text-fg-3">
            · <RelativeTime value={approval.created_at} />
          </span>
        </>
      ) : (
        '—'
      )
    }
  ]
  if (approval.status === 'pending' && approval.expires_at) {
    items.push({
      label: 'Expires',
      value: (
        <>
          {formatDateTime(approval.expires_at)}{' '}
          <span className="text-fg-3">
            · <RelativeTime value={approval.expires_at} />
          </span>
        </>
      )
    })
  }
  if (approval.status !== 'pending') {
    items.push({
      label: 'Resolved',
      value: approval.resolved_at ? (
        <>
          {formatDateTime(approval.resolved_at)}
          {approval.resolved_by ? ` by ${approval.resolved_by}` : ''}{' '}
          <span className="text-fg-3">
            · <RelativeTime value={approval.resolved_at} />
          </span>
        </>
      ) : (
        (approval.resolved_by ?? '—')
      )
    })
    const note = resolutionNote(approval)
    if (note) {
      items.push({
        label: 'Note',
        value: <span className="whitespace-pre-wrap">{note}</span>
      })
    }
  }
  return items
}

function ApprovalContent({
  approval,
  onClose,
  onResolved
}: {
  approval: Approval
  onClose: () => void
  onResolved: (approvalId: string) => void
}) {
  const [view, setView] = useState<'readable' | 'raw'>('readable')
  const lookup = useComponentNames()
  const session = useSessionName(approval)
  const actions = pendingActions(approval)
  const requester = requesterName(approval, lookup)
  const { kind } = sourceOf(approval)
  const isPending = approval.status === 'pending'
  const status = statusMeta(approval.status)
  const form = usePendingForm(approval, actions, onResolved)
  const [first] = actions

  return (
    <DetailPanel
      title={
        <span className="font-mono font-medium break-all">
          {first.toolName}
        </span>
      }
      subtitle={
        <>
          <Badge tone={status.tone} dot>
            {isPending ? 'Waiting for you' : status.label}
          </Badge>
          {actions.length > 1 ? (
            <span>+{actions.length - 1} more in this request</span>
          ) : null}
        </>
      }
      backLabel="All approvals"
      onClose={onClose}
      aria-label="Approval request"
      footer={isPending ? form.footer : undefined}
      className="md:w-auto md:flex-1 md:shrink md:border-l-0 xl:w-auto"
    >
      <p className="text-sm text-fg-2">
        {isPending ? (
          <>
            {requester} wants to run{' '}
            <span className="font-mono text-fg">{first.toolName}</span> and
            paused for your sign-off.
          </>
        ) : (
          <>
            {requester} asked to run{' '}
            <span className="font-mono text-fg">{first.toolName}</span>. This
            request is {status.label.toLowerCase()}.
          </>
        )}
      </p>
      <KeyValueList
        items={detailItems(approval, requester, kind, session.data)}
      />
      <section
        className="flex flex-col gap-2.5"
        aria-labelledby="approval-args"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="approval-args" className="text-[15px] font-semibold">
            {isPending ? 'What it wants to do' : 'What it asked to do'}
          </h3>
          <SegmentedControl
            aria-label="Argument view"
            value={view}
            onChange={setView}
            options={[
              { value: 'readable', label: 'Readable' },
              { value: 'raw', label: 'Raw JSON' }
            ]}
          />
        </div>
        {actions.map((action) => (
          <ActionArgs
            key={action.key}
            action={action}
            view={view}
            showName={actions.length > 1}
          />
        ))}
      </section>
      {isPending ? form.body : null}
    </DetailPanel>
  )
}

export function ApprovalDetail({
  approvalId,
  placeholder,
  onClose,
  onResolved
}: {
  approvalId: string
  placeholder: Approval | undefined
  onClose: () => void
  onResolved: (approvalId: string) => void
}) {
  const query = useApprovalQuery(approvalId, placeholder)

  if (!query.data) {
    return (
      <DetailPanel
        title={query.isError ? 'Request unavailable' : 'Loading request…'}
        backLabel="All approvals"
        onClose={onClose}
        aria-label="Approval request"
        className="md:w-auto md:flex-1 md:shrink md:border-l-0 xl:w-auto"
      >
        {query.isError ? (
          <ErrorState
            title="Couldn't load this request"
            error={query.error}
            onRetry={() => query.refetch()}
            retrying={query.isFetching}
          />
        ) : (
          <LoadingRows rows={5} label="Loading request" />
        )}
      </DetailPanel>
    )
  }

  return (
    <ApprovalContent
      key={query.data.id}
      approval={query.data}
      onClose={onClose}
      onResolved={onResolved}
    />
  )
}
