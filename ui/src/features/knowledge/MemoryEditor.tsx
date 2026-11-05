'use client'

import { X } from 'lucide-react'
import { useId, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { KeyValueList } from '@/components/ui/data'
import { DetailPanel } from '@/components/ui/detail-panel'
import { Field, Label } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { formatDateTime } from '@/lib/time'

import type { Memory } from './types'

/** Longest memory the API accepts (`UserMemoryCreateSchema.memory`). */
export const MEMORY_MAX_LENGTH = 5000

export interface MemoryDraft {
  /** `new` or the memory id the draft belongs to. */
  key: string
  text: string
  topics: string[]
  /** Topic typed but not yet added. */
  topicInput: string
}

export type MemoryDraftPatch = Partial<Omit<MemoryDraft, 'key'>>

/** Adds comma-separated topics from `raw`, trimmed and without duplicates. */
export function mergeTopics(topics: string[], raw: string): string[] {
  const next = [...topics]
  for (const part of raw.split(',')) {
    const topic = part.trim()
    if (
      topic &&
      !next.some((existing) => existing.toLowerCase() === topic.toLowerCase())
    ) {
      next.push(topic)
    }
  }
  return next
}

function TopicInput({
  id,
  topics,
  input,
  onChange,
  describedBy
}: {
  id: string
  topics: string[]
  input: string
  onChange: (patch: MemoryDraftPatch) => void
  describedBy: string
}) {
  const commit = () => {
    if (input.trim()) {
      onChange({ topics: mergeTopics(topics, input), topicInput: '' })
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && !input && topics.length) {
      onChange({ topics: topics.slice(0, -1) })
    }
  }

  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-surface p-1.5 transition-colors focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent/40">
      {topics.map((topic) => (
        <span
          key={topic}
          className="inline-flex h-7 max-w-full items-center gap-0.5 rounded-full border border-line bg-hover pr-[3px] pl-2.5 text-[12.5px] text-fg"
        >
          <span className="truncate">{topic}</span>
          <button
            type="button"
            aria-label={`Remove topic ${topic}`}
            onClick={() =>
              onChange({ topics: topics.filter((value) => value !== topic) })
            }
            className="grid size-[22px] shrink-0 place-items-center rounded-full text-fg-3 hover:bg-line-strong hover:text-fg max-md:size-8"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={input}
        onChange={(event) => {
          const value = event.target.value
          if (value.includes(',')) {
            const parts = value.split(',')
            const rest = parts.pop() ?? ''
            onChange({
              topics: mergeTopics(topics, parts.join(',')),
              topicInput: rest
            })
          } else {
            onChange({ topicInput: value })
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={
          topics.length ? 'Add another topic' : 'Add a topic, then press Enter'
        }
        aria-describedby={describedBy}
        className="h-7 min-w-[120px] flex-1 bg-transparent px-1 text-[13.5px] text-fg outline-none placeholder:text-fg-3 focus-visible:outline-none max-md:h-9"
      />
    </div>
  )
}

interface MemoryEditorProps {
  /** The memory being edited; undefined when adding one. */
  memory: Memory | undefined
  values: MemoryDraft
  onChange: (patch: MemoryDraftPatch) => void
  dirty: boolean
  saving: boolean
  onSubmit: () => void
  onClose: () => void
  userId: string
  source: string | null
}

/** Add or edit a memory in the detail column (full screen on phones). */
export function MemoryEditor({
  memory,
  values,
  onChange,
  dirty,
  saving,
  onSubmit,
  onClose,
  userId,
  source
}: MemoryEditorProps) {
  const ids = useId()
  const formId = `${ids}-form`
  const textId = `${ids}-text`
  const topicId = `${ids}-topics`
  const editing = memory !== undefined
  const canSave = Boolean(values.text.trim()) && (!editing || dirty)

  return (
    <DetailPanel
      title={editing ? 'Edit memory' : 'Add memory'}
      subtitle="Changes apply to the next chat."
      backLabel="All memories"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="mr-auto inline-flex items-center gap-1.5 text-xs text-fg-3"
            aria-live="polite"
          >
            {dirty ? (
              <>
                <span aria-hidden className="size-[7px] rounded-full bg-warn" />
                Unsaved changes
              </>
            ) : null}
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={saving}
            disabled={!canSave}
          >
            {editing ? 'Save changes' : 'Add memory'}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSave && !saving) onSubmit()
        }}
        noValidate
      >
        <Field
          label="Memory"
          htmlFor={textId}
          required
          help="One fact or preference per memory works best."
        >
          <Textarea
            id={textId}
            rows={5}
            value={values.text}
            maxLength={MEMORY_MAX_LENGTH}
            onChange={(event) => onChange({ text: event.target.value })}
            placeholder="e.g. Brand tone is friendly, technical and concise."
            aria-describedby={`${textId}-help`}
            required
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={topicId}>Topics</Label>
          <TopicInput
            id={topicId}
            topics={values.topics}
            input={values.topicInput}
            onChange={onChange}
            describedBy={`${topicId}-help`}
          />
          <p id={`${topicId}-help`} className="text-[12.5px] text-fg-3">
            Press Enter or type a comma to add a topic. Topics help agents and
            you find this memory later.
          </p>
        </div>
      </form>

      {memory ? (
        <KeyValueList
          className="border-t border-line pt-4"
          items={[
            {
              label: 'Memory ID',
              value: (
                <span className="font-mono break-all">{memory.memory_id}</span>
              )
            },
            {
              label: 'Source',
              value: source ? (
                <span className="flex flex-col">
                  {source}
                  <span className="text-xs text-fg-3">
                    AgentOS clears the source when you save changes.
                  </span>
                </span>
              ) : (
                '—'
              )
            },
            {
              label: 'User',
              value: (
                <span className="font-mono break-all">
                  {memory.user_id || userId}
                </span>
              )
            },
            { label: 'Updated', value: formatDateTime(memory.updated_at) }
          ]}
        />
      ) : null}
    </DetailPanel>
  )
}
