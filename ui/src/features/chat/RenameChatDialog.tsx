'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { SessionEntry } from '@/types/os'

import { chatTitle } from './format'
import { useRenameSession, type ChatTargetRef } from './queries'

const MAX_LENGTH = 200

function RenameForm({
  session,
  target,
  onClose
}: {
  session: SessionEntry
  target: ChatTargetRef | null
  onClose: () => void
}) {
  const [name, setName] = useState(chatTitle(session))
  const [error, setError] = useState<string | null>(null)
  const rename = useRenameSession(target)
  const trimmed = name.trim()

  const submit = () => {
    if (!trimmed) {
      setError('Enter a name for the chat.')
      return
    }
    if (trimmed === session.session_name) {
      onClose()
      return
    }
    rename.mutate(
      { sessionId: session.session_id, name: trimmed },
      {
        onSuccess: () => {
          toast.success('Chat renamed')
          onClose()
        },
        onError: (err) =>
          toast.error("Couldn't rename the chat", {
            description: getErrorMessage(err)
          })
      }
    )
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Rename chat"
      size="sm"
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={rename.isPending}
            disabled={!trimmed}
          >
            Save
          </Button>
        </>
      }
    >
      <Field
        label="Chat name"
        htmlFor="rename-chat-name"
        required
        error={error}
        help="Shown in the chat list."
      >
        <Input
          id="rename-chat-name"
          value={name}
          maxLength={MAX_LENGTH}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby="rename-chat-name-help"
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError(null)
          }}
        />
      </Field>
    </Modal>
  )
}

/** Rename dialog for one chat; mounted only while `session` is set. */
export function RenameChatDialog({
  session,
  target,
  onClose
}: {
  session: SessionEntry | null
  target: ChatTargetRef | null
  onClose: () => void
}) {
  if (!session) return null
  return (
    <RenameForm
      key={session.session_id}
      session={session}
      target={target}
      onClose={onClose}
    />
  )
}
