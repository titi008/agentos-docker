'use client'

import { X } from 'lucide-react'
import type { KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code'
import { Markdown } from '@/components/ui/markdown'
import { SegmentedControl } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

export type EditorMode = 'write' | 'split' | 'preview'

/** Write / Split / Preview switch; phones get Write and Preview only. */
export function EditorModeSwitch({
  mode,
  onChange
}: {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
}) {
  return (
    <>
      <SegmentedControl
        aria-label="Editor layout"
        className="max-md:hidden"
        value={mode}
        onChange={onChange}
        options={[
          { value: 'write', label: 'Write' },
          { value: 'split', label: 'Split' },
          { value: 'preview', label: 'Preview' }
        ]}
      />
      <SegmentedControl
        aria-label="Editor layout"
        className="md:hidden"
        value={mode === 'preview' ? 'preview' : 'write'}
        onChange={onChange}
        options={[
          { value: 'write', label: 'Write' },
          { value: 'preview', label: 'Preview' }
        ]}
      />
    </>
  )
}

interface WikiEditorProps {
  mode: EditorMode
  draft: string
  onDraftChange: (draft: string) => void
  onSave: () => void
  /** The draft kept after reviewing a conflicting save. */
  previousDraft?: string
  onDismissPrevious: () => void
}

export function WikiEditor({
  mode,
  draft,
  onDraftChange,
  onSave,
  previousDraft,
  onDismissPrevious
}: WikiEditorProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      onSave()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {previousDraft !== undefined ? (
        <div className="flex max-h-[40%] shrink-0 flex-col gap-2 overflow-y-auto border-b border-line bg-warn-soft px-4 py-3 md:px-6">
          <div className="flex items-start gap-3">
            <p className="flex-1 text-[13px] text-fg">
              The editor now shows their version. Your previous draft is kept
              below so you can copy what you need into it.
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss your previous draft"
              onClick={onDismissPrevious}
            >
              <X />
            </Button>
          </div>
          <CodeBlock
            code={previousDraft}
            label="Your draft"
            maxHeight="12rem"
          />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            mode === 'preview' && 'hidden'
          )}
        >
          <div className="flex min-h-9 items-center justify-between gap-2 border-b border-line px-4 py-1 text-xs text-fg-3">
            <label htmlFor="wiki-source">Markdown</label>
            <span className="max-md:hidden">Ctrl or ⌘ + S to save</span>
          </div>
          <textarea
            id="wiki-source"
            value={draft}
            spellCheck={false}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            className="min-h-[320px] w-full flex-1 resize-none bg-canvas px-[18px] py-4 font-mono text-[13px] leading-[1.7] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset"
          />
        </div>
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            mode === 'write' && 'hidden',
            mode === 'split' && 'max-md:hidden md:border-l md:border-line'
          )}
        >
          <div className="flex min-h-9 items-center justify-between gap-2 border-b border-line px-4 py-1 text-xs text-fg-3">
            <span>Preview</span>
            <span>Rendered as your agents read it</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-[26px]">
            {draft.trim() ? (
              <Markdown content={draft} />
            ) : (
              <p className="text-[13px] text-fg-3">Nothing to preview yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
