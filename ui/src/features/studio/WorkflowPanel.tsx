'use client'

import { Play, Workflow } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DetailPanel } from '@/components/ui/detail-panel'
import { ErrorState, LoadingRows } from '@/components/ui/states'
import { chatHref } from '@/components/shell/nav'

import { KindIcon } from './CatalogCard'
import { SandboxedBadge } from './chips'
import { Divider, IdentifierRow, PanelSection } from './CodeItemPanel'
import { capitalize, stepExecutor } from './lib'
import { useWorkflowDetailQuery } from './queries'
import type { CatalogItem, WorkflowStepInfo } from './types'

function StepList({ steps }: { steps: WorkflowStepInfo[] }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((step, index) => {
        const executor = stepExecutor(step)
        return (
          <li
            key={`${step.name ?? 'step'}-${index}`}
            className="flex flex-col gap-1.5 rounded-[10px] border border-line px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
              >
                {index + 1}
              </span>
              <span className="sr-only">Step {index + 1}:</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                {step.name || `Step ${index + 1}`}
              </span>
              <Badge>{executor.label}</Badge>
            </div>
            {executor.target || step.description ? (
              <div className="flex flex-col gap-0.5 pl-8 text-[12.5px] text-fg-3">
                {executor.target ? (
                  <span className="truncate font-mono">{executor.target}</span>
                ) : null}
                {step.description ? <span>{step.description}</span> : null}
              </div>
            ) : null}
            {step.steps?.length ? (
              <div className="pl-8">
                <StepList steps={step.steps} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Details of a code-defined workflow: identity and its steps. */
export function WorkflowPanel({
  item,
  onClose
}: {
  item: CatalogItem
  onClose: () => void
}) {
  const detail = useWorkflowDetailQuery(item.isFactory ? null : item.id)
  const steps = detail.data?.steps ?? []

  return (
    <DetailPanel
      aria-label={`Workflow details: ${item.name}`}
      title={
        <span className="flex items-center gap-2.5">
          <KindIcon icon={Workflow} />
          <span className="min-w-0">{item.name}</span>
        </span>
      }
      subtitle={
        <>
          <Badge>Code-defined</Badge>
          <Badge tone="info">{item.isFactory ? 'Factory' : 'Pipeline'}</Badge>
          {item.stage ? <Badge>{capitalize(item.stage)}</Badge> : null}
          {item.sandboxed ? <SandboxedBadge /> : null}
        </>
      }
      backLabel="All workflows"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" asChild>
            <Link href={chatHref('workflow', item.id)}>
              <Play aria-hidden />
              Run in chat
            </Link>
          </Button>
        </div>
      }
    >
      <PanelSection title="Workflow ID">
        <IdentifierRow value={item.id} successMessage="Workflow ID copied" />
      </PanelSection>
      <PanelSection title="Description">
        <p
          className={
            item.description
              ? 'text-[13.5px] text-fg-2'
              : 'text-[13px] text-fg-3'
          }
        >
          {item.description || 'No description provided.'}
        </p>
      </PanelSection>
      <Divider />
      <PanelSection
        title={detail.isSuccess ? `Steps (${steps.length})` : 'Steps'}
      >
        {item.isFactory ? (
          <p className="text-[13px] text-fg-3">
            A factory builds this workflow per request, so its steps are only
            known at run time.
          </p>
        ) : detail.isPending ? (
          <LoadingRows rows={3} label="Loading steps" />
        ) : detail.isError ? (
          <ErrorState
            compact
            title="Couldn't load the steps"
            error={detail.error}
            onRetry={() => void detail.refetch()}
            retrying={detail.isFetching}
          />
        ) : steps.length ? (
          <StepList steps={steps} />
        ) : (
          <p className="text-[13px] text-fg-3">
            No steps listed. The workflow runs custom code instead.
          </p>
        )}
      </PanelSection>
    </DetailPanel>
  )
}
