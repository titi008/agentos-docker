'use client'

import { useMutation } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useId, useState } from 'react'

import { unwrapList, useApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/data'
import { Label } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { ErrorState } from '@/components/ui/states'

import { pluralize } from './shared'
import type { RetrievedChunk } from './types'

const RESULT_COUNTS = ['3', '5', '10'] as const
type ResultCount = (typeof RESULT_COUNTS)[number]

interface SearchVariables {
  query: string
  maxResults: number
}

function ChunkText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > 320
  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className={
          expanded || !long
            ? 'text-[13px] break-words whitespace-pre-wrap text-fg-2'
            : 'line-clamp-4 text-[13px] break-words whitespace-pre-wrap text-fg-2'
        }
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="text-xs font-medium text-accent hover:underline"
        >
          {expanded ? 'Show less' : 'Show full chunk'}
        </button>
      ) : null}
    </div>
  )
}

function ChunkResult({
  chunk,
  index
}: {
  chunk: RetrievedChunk
  index: number
}) {
  const score =
    typeof chunk.reranking_score === 'number' &&
    Number.isFinite(chunk.reranking_score)
      ? chunk.reranking_score
      : null
  const name = chunk.name || chunk.content_id || `Chunk ${index + 1}`
  return (
    <li className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-canvas p-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg"
          title={name}
        >
          {name}
        </span>
        {score !== null ? (
          <span className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-xs text-fg-3">Relevance</span>
            <span className="font-mono text-[13px] text-fg tabular-nums">
              {score.toFixed(2)}
            </span>
          </span>
        ) : null}
      </div>
      {score !== null ? (
        <div aria-hidden className="h-1 overflow-hidden rounded-full bg-hover">
          <div
            className="h-full rounded-full bg-accent-fill"
            style={{
              width: `${Math.round(Math.min(1, Math.max(0, score)) * 100)}%`
            }}
          />
        </div>
      ) : null}
      <ChunkText text={chunk.content} />
    </li>
  )
}

/** Runs `POST /knowledge/search` to show which chunks an agent would get. */
export function RetrievalTest({
  knowledgeId,
  className
}: {
  knowledgeId: string | undefined
  className?: string
}) {
  const api = useApi()
  const ids = useId()
  const [query, setQuery] = useState('')
  const [count, setCount] = useState<ResultCount>('5')

  const search = useMutation({
    mutationFn: ({ query: text, maxResults }: SearchVariables) =>
      api
        .request<unknown>('/knowledge/search', {
          method: 'POST',
          json: {
            query: text,
            max_results: maxResults,
            knowledge_id: knowledgeId,
            meta: { page: 1, limit: maxResults }
          }
        })
        .then((value) => unwrapList<RetrievedChunk>(value))
  })

  const submit = () => {
    const text = query.trim()
    if (!text || search.isPending) return
    search.mutate({ query: text, maxResults: Number(count) })
  }

  const results = search.data

  return (
    <Card
      className={className}
      role="region"
      aria-labelledby={`${ids}-heading`}
    >
      <div className="flex flex-col gap-3.5 p-4">
        <div className="flex flex-col gap-0.5">
          <h2 id={`${ids}-heading`} className="text-[15px] font-semibold">
            Test retrieval
          </h2>
          <p className="text-[13px] text-fg-3">
            See which chunks an agent gets for a question.
          </p>
        </div>

        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          noValidate
        >
          <Label htmlFor={`${ids}-query`}>Question</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${ids}-query`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What are our pricing tiers?"
              className="min-w-0 flex-[1_1_160px]"
            />
            <label htmlFor={`${ids}-count`} className="sr-only">
              Number of results
            </label>
            <Select
              id={`${ids}-count`}
              value={count}
              onChange={(event) => setCount(event.target.value as ResultCount)}
              className="w-[104px] shrink-0"
            >
              {RESULT_COUNTS.map((value) => (
                <option key={value} value={value}>
                  Top {value}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              loading={search.isPending}
              disabled={!query.trim()}
            >
              {search.isPending ? null : <Search />}
              Search
            </Button>
          </div>
        </form>

        {search.isError ? (
          <ErrorState
            compact
            title="Search failed"
            error={search.error}
            onRetry={() => search.variables && search.mutate(search.variables)}
            retrying={search.isPending}
          />
        ) : null}

        {results && search.variables ? (
          <div
            className="flex flex-col gap-2.5 border-t border-line pt-3.5"
            aria-live="polite"
          >
            {results.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-line-strong px-3 py-4 text-center text-[13px] text-fg-3">
                No chunks matched “{search.variables.query}”. Try other words,
                or check that your documents finished processing.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium text-fg">
                    {pluralize(results.length, 'chunk')} returned
                  </span>
                  <span className="text-xs text-fg-3">Most relevant first</span>
                </div>
                <ol className="flex flex-col gap-2.5">
                  {results.map((chunk, index) => (
                    <ChunkResult
                      key={chunk.id ?? `${chunk.content_id}-${index}`}
                      chunk={chunk}
                      index={index}
                    />
                  ))}
                </ol>
              </>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
