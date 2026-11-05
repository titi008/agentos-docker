'use client'

import { ArrowUp, FileText, Info, Paperclip, Square, X } from 'lucide-react'
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode
} from 'react'

import { Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'

import { ACCEPT_ATTRIBUTE, ACCEPTED_SUMMARY } from './files'

interface ComposerProps {
  /** Who the message goes to, used in the placeholder. */
  name: string | null
  /** Why sending is impossible right now; shown above the input. */
  notice: ReactNode
  /** Blocks sending without a notice (e.g. while a chat loads). */
  busy: boolean
  isStreaming: boolean
  /** False for workflows, whose runs take text only. */
  allowFiles: boolean
  attachments: File[]
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  onSend: (text: string) => void
  onStop: () => void
}

function resize(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

/**
 * Message box pinned under the conversation: grows with the text, sends on
 * Enter (Shift + Enter adds a line; on touch keyboards Enter adds a line),
 * and takes attachments from the button, paste or drag and drop.
 */
export function Composer({
  name,
  notice,
  busy,
  isStreaming,
  allowFiles,
  attachments,
  onAddFiles,
  onRemoveFile,
  onSend,
  onStop
}: ComposerProps) {
  const chatInputRef = useStore((state) => state.chatInputRef)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const inputId = useId()

  const disabled = Boolean(notice) || busy
  const canSend =
    !disabled &&
    !isStreaming &&
    (draft.trim().length > 0 || attachments.length > 0)

  useLayoutEffect(() => resize(chatInputRef.current), [draft, chatInputRef])

  const submit = () => {
    if (!canSend) return
    onSend(draft)
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    // IME composition (e.g. Japanese input) uses Enter to confirm text.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    // On-screen keyboards have no Shift + Enter, so Enter adds a line there.
    if (window.matchMedia('(pointer: coarse)').matches) return
    event.preventDefault()
    submit()
  }

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (!files.length) return
    if (!event.clipboardData.getData('text')) event.preventDefault()
    onAddFiles(files)
  }

  return (
    <div className="shrink-0 px-6 pt-2 pb-5 max-md:border-t max-md:border-line max-md:bg-canvas max-md:px-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))]">
      {notice ? (
        <div
          role="status"
          className="mx-auto mb-2 flex max-w-[780px] items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-fg-2"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-3" />
          <div className="min-w-0 flex-1">{notice}</div>
        </div>
      ) : null}
      <form
        aria-label="Message composer"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className={cn(
          'mx-auto flex max-w-[780px] flex-col gap-1 rounded-[14px] border border-line-strong bg-surface pt-2.5 pr-2.5 pb-2 pl-3.5 shadow-pop transition-colors focus-within:border-accent',
          'max-md:rounded-[18px] max-md:p-1 max-md:shadow-none',
          disabled && 'opacity-70'
        )}
      >
        {attachments.length ? (
          <ul
            aria-label="Attached files"
            className="flex flex-wrap gap-1.5 pt-0.5 pb-1 max-md:px-2 max-md:pt-2"
          >
            {attachments.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <Chip className="max-w-[260px] pr-0.5">
                  <FileText aria-hidden />
                  <span className="truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-fg-3">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(index)}
                    aria-label={`Remove ${file.name}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-fg-3 hover:bg-hover hover:text-fg max-md:size-8"
                  >
                    <X aria-hidden />
                  </button>
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}
        <div
          className={cn(
            'flex flex-col gap-1 max-md:flex-row max-md:items-end',
            !allowFiles && 'max-md:pl-3'
          )}
        >
          <label htmlFor={inputId} className="sr-only">
            {name ? `Message ${name}` : 'Message'}
          </label>
          <textarea
            id={inputId}
            ref={chatInputRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={allowFiles ? onPaste : undefined}
            disabled={disabled}
            placeholder={name ? `Message ${name}…` : 'Message…'}
            className="max-h-[min(40dvh,240px)] min-h-11 w-full resize-none border-0 bg-transparent py-1 text-[14.5px] leading-normal text-fg outline-none placeholder:text-fg-3 focus-visible:outline-none disabled:cursor-not-allowed max-md:order-1 max-md:min-w-0 max-md:flex-1 max-md:py-[11px] max-md:text-base"
          />
          <div className="flex items-center gap-2 max-md:contents">
            {allowFiles ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Attach files: ${ACCEPTED_SUMMARY}`}
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                className="max-md:size-11 max-md:rounded-[14px]"
              >
                <Paperclip />
              </Button>
            ) : null}
            <span className="min-w-0 flex-1 text-xs text-fg-3 max-md:hidden">
              Enter to send · Shift + Enter for a new line
              {allowFiles
                ? ' · Drop files to attach'
                : ' · Workflows take text, not files'}
            </span>
            {isStreaming ? (
              <Button
                type="button"
                size="sm"
                onClick={onStop}
                className="max-md:order-2 max-md:h-11 max-md:rounded-[14px]"
              >
                <Square className="fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="icon-sm"
                disabled={!canSend}
                aria-label={
                  canSend
                    ? 'Send message'
                    : 'Send message (type a message first)'
                }
                className="max-md:order-2 max-md:size-11 max-md:rounded-[14px]"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          tabIndex={-1}
          aria-hidden
          className="hidden"
          onChange={(event) => {
            onAddFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
      </form>
    </div>
  )
}
