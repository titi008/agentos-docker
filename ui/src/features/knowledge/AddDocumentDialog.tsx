'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { FileText, TextCursorInput, Upload, X } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Modal } from '@/components/ui/dialog'
import { Field, RequiredLegend } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented'
import { formatBytes } from '@/lib/time'
import { cn } from '@/lib/utils'

import { KNOWLEDGE_KEY, useBeforeUnload } from './queries'
import type { KnowledgeDocument, KnowledgeReaderConfig } from './types'

type Mode = 'upload' | 'paste'

/** File extensions the server's readers accept, from `GET /knowledge/config`. */
function useReaderExtensions(knowledgeId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: api.key(KNOWLEDGE_KEY, 'reader-config', knowledgeId ?? null),
    queryFn: ({ signal }) =>
      api.request<KnowledgeReaderConfig>('/knowledge/config', {
        signal,
        query: { knowledge_id: knowledgeId }
      }),
    select: (config) =>
      Object.keys(config.readersForType ?? {})
        .filter((type) => type.startsWith('.'))
        .sort(),
    enabled: api.ready,
    staleTime: 10 * 60_000
  })
}

function hasExtension(fileName: string, extensions: string[]): boolean {
  const name = fileName.toLowerCase()
  return extensions.some((extension) => name.endsWith(extension))
}

function describeFormats(extensions: string[] | undefined): string {
  if (!extensions?.length) {
    return 'PDF, Markdown, text, CSV, JSON and other formats your readers support.'
  }
  const shown = extensions.slice(0, 8).map((e) => e.slice(1).toUpperCase())
  const rest = extensions.length - shown.length
  return `Supported: ${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}.`
}

interface AddDocumentDialogProps {
  knowledgeId: string | undefined
  onClose: () => void
  onAdded: (document: KnowledgeDocument) => void
}

/**
 * Upload a file or paste text into the knowledge base. Sends multipart form
 * data to `POST /knowledge/content`; indexing continues in the background.
 * Mounted only while open, so every open starts with an empty form.
 */
export function AddDocumentDialog({
  knowledgeId,
  onClose,
  onAdded
}: AddDocumentDialogProps) {
  const api = useApi()
  const confirm = useConfirm()
  const ids = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const extensions = useReaderExtensions(knowledgeId)

  const [mode, setMode] = useState<Mode>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')

  const supported = extensions.data
  const fileError =
    file && supported?.length && !hasExtension(file.name, supported)
      ? `This file type isn't supported. ${describeFormats(supported)}`
      : null
  const canSubmit =
    mode === 'upload'
      ? Boolean(file) && !fileError
      : Boolean(title.trim() && content.trim())
  const dirty = Boolean(
    file || title.trim() || description.trim() || content.trim()
  )
  useBeforeUnload(dirty)

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData()
      if (mode === 'upload' && file) {
        form.append('file', file, file.name)
        if (title.trim()) form.append('name', title.trim())
      } else {
        form.append('name', title.trim())
        form.append('text_content', content.trim())
      }
      if (description.trim()) form.append('description', description.trim())
      return api.request<KnowledgeDocument>('/knowledge/content', {
        method: 'POST',
        formData: form,
        query: { knowledge_id: knowledgeId }
      })
    },
    onSuccess: (document) => {
      toast.success('Document added', {
        description: 'Indexing started. The status updates when it finishes.'
      })
      onAdded(document)
      onClose()
    },
    onError: (error) =>
      toast.error("Couldn't add the document", {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })

  const requestClose = async () => {
    if (upload.isPending) return
    if (
      dirty &&
      !(await confirm({
        title: 'Discard this document?',
        description: 'The file or text you entered will not be added.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        tone: 'danger'
      }))
    ) {
      return
    }
    onClose()
  }

  const pickFile = (picked: File | undefined) => {
    if (picked) setFile(picked)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    pickFile(event.dataTransfer.files[0])
  }

  const titleId = `${ids}-title`
  const descriptionId = `${ids}-description`
  const contentId = `${ids}-content`
  const fileHelpId = `${ids}-file-help`

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) void requestClose()
      }}
      title="Add document"
      description="Indexed into the knowledge base so agents can retrieve it in answers."
      size="md"
      onSubmit={() => {
        if (canSubmit && !upload.isPending) upload.mutate()
      }}
      footer={
        <>
          <Button onClick={() => void requestClose()}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            loading={upload.isPending}
            disabled={!canSubmit}
          >
            {upload.isPending ? 'Adding…' : 'Add to knowledge'}
          </Button>
        </>
      }
    >
      <SegmentedControl<Mode>
        aria-label="How to add the document"
        value={mode}
        onChange={setMode}
        fill
        options={[
          {
            value: 'upload',
            label: (
              <>
                <Upload aria-hidden className="size-3.5" />
                Upload file
              </>
            )
          },
          {
            value: 'paste',
            label: (
              <>
                <TextCursorInput aria-hidden className="size-3.5" />
                Paste text
              </>
            )
          }
        ]}
      />

      {mode === 'upload' ? (
        <div className="flex flex-col gap-1.5">
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept={supported?.length ? supported.join(',') : undefined}
            onChange={(event) => {
              pickFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          {file ? (
            <div
              className={cn(
                'flex items-center gap-3 rounded-[10px] border bg-canvas px-3 py-2.5',
                fileError ? 'border-bad' : 'border-line'
              )}
            >
              <FileText aria-hidden className="size-5 shrink-0 text-fg-3" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-[13px] text-fg">
                  {file.name}
                </span>
                <span className="text-xs text-fg-3">
                  {formatBytes(file.size)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                Replace
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFile(null)}
              >
                <X />
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed bg-canvas p-4 text-center text-[13.5px] text-fg-2 transition-colors',
                dragging ? 'border-accent bg-accent-soft' : 'border-line-strong'
              )}
            >
              <Upload aria-hidden className="size-6 text-fg-3" />
              <span>
                Drop a file here or{' '}
                <button
                  type="button"
                  aria-describedby={fileHelpId}
                  onClick={() => fileInput.current?.click()}
                  className="font-medium text-accent underline underline-offset-2 hover:no-underline"
                >
                  browse
                </button>
              </span>
            </div>
          )}
          <p
            id={fileHelpId}
            className={cn(
              'text-[12.5px]',
              fileError ? 'text-bad' : 'text-fg-3'
            )}
            role={fileError ? 'alert' : undefined}
          >
            {fileError ?? describeFormats(supported)}
          </p>
        </div>
      ) : (
        <Field
          label="Content"
          htmlFor={contentId}
          required
          help="Markdown or plain text."
        >
          <Textarea
            id={contentId}
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Paste documentation, business facts, product specs or strategy notes…"
            aria-describedby={`${contentId}-help`}
            required
          />
        </Field>
      )}

      <Field
        label="Title"
        htmlFor={titleId}
        required={mode === 'paste'}
        help={
          mode === 'upload'
            ? 'Optional. Defaults to the file name.'
            : 'Agents see this name in their sources.'
        }
      >
        <Input
          id={titleId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. solopreneur_business_model.md"
          aria-describedby={`${titleId}-help`}
          required={mode === 'paste'}
        />
      </Field>

      <Field
        label="Description"
        htmlFor={descriptionId}
        help="Optional context for agents and for you."
      >
        <Input
          id={descriptionId}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-describedby={`${descriptionId}-help`}
        />
      </Field>

      {mode === 'paste' ? <RequiredLegend /> : null}
    </Modal>
  )
}
