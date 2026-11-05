'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { ApiError, useApi } from '@/api/client'
import { Chip } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KeyValueList } from '@/components/ui/data'
import { Modal } from '@/components/ui/dialog'
import { Field, RequiredLegend } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { ErrorState } from '@/components/ui/states'
import { RelativeTime } from '@/components/ui/time'

import { encodePath, useCompanyKeys, wikiBase } from './api'
import type { WikiPage, WikiPageMeta } from './types'

const MAX_PATH = 512
const MAX_SEGMENTS = 16
const MAX_SEGMENT = 128

type PathResult = { path: string } | { error: string }

/**
 * Mirrors the server's path grammar (agno/fs/_paths.py) so mistakes show up
 * inline: relative, forward slashes, no `.`/`..`, ending in `.md`.
 */
export function normalizeWikiPath(input: string): PathResult {
  if (/[\u0000-\u001f\u007f]/.test(input)) {
    return { error: 'Remove control characters from the path.' }
  }
  let value = input.normalize('NFC').trim()
  if (!value) return { error: 'Enter a path.' }
  if (value.includes('\\')) return { error: 'Use forward slashes (/).' }
  value = value.replace(/\/{2,}/g, '/').replace(/^\//, '')
  if (!value || value.endsWith('/')) {
    return { error: 'End the path with a page name, not a folder.' }
  }
  if (/\.md$/i.test(value)) value = value.replace(/\.md$/i, '.md')
  else value = `${value}.md`
  const segments = value.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return { error: 'Paths can’t contain . or .. segments.' }
  }
  if (segments.some((segment) => segment.trim() === '')) {
    return { error: 'Folder and page names can’t be empty.' }
  }
  if (segments.length > MAX_SEGMENTS) {
    return { error: `Use at most ${MAX_SEGMENTS - 1} folders.` }
  }
  if (segments.some((segment) => segment.length > MAX_SEGMENT)) {
    return { error: `Keep each name under ${MAX_SEGMENT} characters.` }
  }
  if (value.length > MAX_PATH) {
    return { error: `Keep the path under ${MAX_PATH} characters.` }
  }
  return { path: value }
}

function pageName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/, '')
}

export function NewWikiPageDialog({
  productId,
  scopeLabel,
  existingPaths,
  onClose,
  onCreated
}: {
  productId: string | null
  scopeLabel: string
  existingPaths: Set<string>
  onClose: () => void
  onCreated: (path: string) => void
}) {
  const api = useApi()
  const queryClient = useQueryClient()
  const keys = useCompanyKeys()
  const [rawPath, setRawPath] = useState('')
  const [content, setContent] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const result = normalizeWikiPath(rawPath)
  const path = 'path' in result ? result.path : null
  const pathError =
    serverError ??
    ('error' in result
      ? touched
        ? result.error
        : null
      : existingPaths.has(result.path)
        ? 'A page with this path already exists.'
        : null)
  const valid = path !== null && !existingPaths.has(path)

  const create = useMutation({
    mutationFn: (target: { path: string; content: string }) =>
      api.request<WikiPageMeta>(
        `${wikiBase(productId)}/${encodePath(target.path)}`,
        {
          method: 'PUT',
          json: { content: target.content, expected_version: 0 }
        }
      ),
    onSuccess: (metadata, target) => {
      queryClient.setQueryData<WikiPage>(
        keys.wikiPage(productId, target.path),
        { content: target.content, metadata }
      )
      void queryClient.invalidateQueries({
        queryKey: keys.wikiPages(productId)
      })
      onCreated(target.path)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setServerError('A page with this path already exists.')
      } else if (error instanceof ApiError && error.status === 422) {
        setServerError(error.detail ?? 'The server rejected this path.')
      }
    }
  })

  const submit = () => {
    setTouched(true)
    if (!valid || !path || create.isPending) return
    create.mutate({
      path,
      content: content.trim() ? content : `# ${pageName(path)}\n\n`
    })
  }

  const showBanner =
    create.isError &&
    !(
      create.error instanceof ApiError &&
      (create.error.status === 409 || create.error.status === 422)
    )

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="New wiki page"
      description="Write it now or start with a title and fill it in later."
      onSubmit={submit}
      footer={
        <>
          <RequiredLegend className="mr-auto self-center" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={create.isPending}
            disabled={!valid}
          >
            Create page
          </Button>
        </>
      }
    >
      {showBanner ? (
        <ErrorState
          compact
          title="Couldn't create the page"
          error={create.error}
        />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Where</span>
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{scopeLabel}</Chip>
          <span className="text-[12.5px] text-fg-3">
            Change the scope on the Wiki page.
          </span>
        </div>
      </div>
      <Field
        label="Path"
        htmlFor="nw-path"
        required
        error={pathError}
        help={
          path
            ? `Creates ${path}. Use / to put the page in a folder.`
            : '.md is added if missing. Use / to put the page in a folder.'
        }
      >
        <Input
          id="nw-path"
          value={rawPath}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="runbooks/restore-backup"
          className="font-mono text-[13.5px]"
          aria-invalid={Boolean(pathError) || undefined}
          aria-describedby="nw-path-help"
          onChange={(event) => {
            setRawPath(event.target.value)
            setServerError(null)
          }}
          onBlur={() => setTouched(true)}
        />
      </Field>
      <Field
        label="Starting content"
        htmlFor="nw-content"
        help="Leave it empty to start with just a title."
      >
        <Textarea
          id="nw-content"
          rows={6}
          value={content}
          spellCheck={false}
          placeholder={`# ${path ? pageName(path) : 'Restore a backup'}`}
          className="font-mono text-[13px]"
          aria-describedby="nw-content-help"
          onChange={(event) => setContent(event.target.value)}
        />
      </Field>
    </Modal>
  )
}

export function WikiConflictDialog({
  path,
  latest,
  baseVersion,
  overwriting,
  onReview,
  onOverwrite,
  onKeepEditing
}: {
  path: string
  latest: WikiPage
  baseVersion: number
  overwriting: boolean
  onReview: () => void
  onOverwrite: () => void
  onKeepEditing: () => void
}) {
  const version = latest.metadata.version ?? 0
  return (
    <Modal
      open
      size="sm"
      onOpenChange={(open) => {
        if (!open && !overwriting) onKeepEditing()
      }}
      title={
        <span className="flex items-center gap-2">
          <TriangleAlert aria-hidden className="size-4 shrink-0 text-warn" />
          This page changed while you were editing
        </span>
      }
      description={
        <>
          Someone saved v{version} of <span className="font-mono">{path}</span>{' '}
          while you were editing. Your changes are not saved yet.
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onReview} disabled={overwriting}>
            Review their changes
          </Button>
          <Button
            variant="destructive"
            onClick={onOverwrite}
            loading={overwriting}
          >
            Overwrite with mine
          </Button>
        </>
      }
    >
      <KeyValueList
        items={[
          {
            label: 'Their version',
            value: (
              <>
                v{version}
                {latest.metadata.updated_at ? (
                  <>
                    {' '}
                    · saved <RelativeTime value={latest.metadata.updated_at} />
                  </>
                ) : null}
                {latest.metadata.user_id
                  ? ` by ${latest.metadata.user_id}`
                  : ''}
              </>
            )
          },
          { label: 'Your draft', value: `Based on v${baseVersion}` }
        ]}
      />
      <p className="text-[13px] text-fg-3">
        Review loads their version and keeps your draft beside it so you can
        copy what you need. Overwrite replaces their changes with yours.
      </p>
    </Modal>
  )
}
