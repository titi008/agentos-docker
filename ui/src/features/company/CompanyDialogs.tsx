'use client'

import { useMutation } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { useApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Field, RequiredLegend } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { ErrorState, Spinner } from '@/components/ui/states'

import { useInvalidateWork } from './api'
import { decodeExecutor, ExecutorOptions, type Executors } from './executors'
import type { Product, Project, Task } from './types'

/** What the task form had when it handed off to another dialog. */
export interface TaskDraft {
  title: string
  brief: string
  executor: string
}

interface ListState<T> {
  data: T[] | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
  isFetching: boolean
}

/** Proposed and active projects take new work; done and cancelled ones are finished. */
export function isActiveProject(project: Project): boolean {
  return project.status === 'proposed' || project.status === 'active'
}

/** Active and proposed projects first; finished ones stay pickable. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const rank = (p: Project) => (isActiveProject(p) ? 0 : 1)
    return rank(a) - rank(b) || a.name.localeCompare(b.name)
  })
}

function projectLabel(project: Project): string {
  return isActiveProject(project)
    ? project.name
    : `${project.name} (${project.status})`
}

function DialogLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 py-6 text-[13px] text-fg-3"
    >
      <Spinner />
      {label}…
    </div>
  )
}

function NeedsParent({
  title,
  description,
  action
}: {
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line-strong p-4">
      <p className="font-medium">{title}</p>
      <p className="text-[13px] text-fg-3">{description}</p>
      <div className="mt-1">{action}</div>
    </div>
  )
}

/* New product --------------------------------------------------------------- */

export function NewProductDialog({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: (product: Product) => void
}) {
  const api = useApi()
  const invalidate = useInvalidateWork()
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [touched, setTouched] = useState(false)

  const create = useMutation({
    mutationFn: () =>
      api.request<Product>('/company/products', {
        method: 'POST',
        json: { name: name.trim(), purpose: purpose.trim() || null }
      }),
    onSuccess: async (product) => {
      toast.success('Product created')
      await invalidate()
      onCreated(product)
    }
  })

  const nameError = touched && !name.trim() ? 'Enter a name.' : undefined

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="New product"
      description="A product groups projects, routines and its own wiki."
      onSubmit={() => {
        setTouched(true)
        if (name.trim() && !create.isPending) create.mutate()
      }}
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
            disabled={!name.trim()}
          >
            Create product
          </Button>
        </>
      }
    >
      {create.isError ? (
        <ErrorState
          compact
          title="Couldn't create the product"
          error={create.error}
        />
      ) : null}
      <Field label="Name" htmlFor="np-name" required error={nameError}>
        <Input
          id="np-name"
          value={name}
          autoFocus
          autoComplete="off"
          placeholder="e.g. Client Portal"
          aria-invalid={Boolean(nameError) || undefined}
          aria-describedby={nameError ? 'np-name-help' : undefined}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setTouched(true)}
        />
      </Field>
      <Field
        label="Purpose"
        htmlFor="np-purpose"
        help="Company Manager reads the purpose when it plans work."
      >
        <Textarea
          id="np-purpose"
          rows={3}
          value={purpose}
          placeholder="What this product is for and what Company Manager should focus on"
          aria-describedby="np-purpose-help"
          onChange={(event) => setPurpose(event.target.value)}
        />
      </Field>
    </Modal>
  )
}

/* New project --------------------------------------------------------------- */

export function NewProjectDialog({
  products,
  defaultProductId,
  onClose,
  onCreated,
  onCreateProduct
}: {
  products: ListState<Product>
  defaultProductId: string | null
  onClose: () => void
  onCreated: (project: Project) => void
  onCreateProduct: () => void
}) {
  const api = useApi()
  const invalidate = useInvalidateWork()
  const [productChoice, setProductChoice] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [outcome, setOutcome] = useState('')
  const [touched, setTouched] = useState(false)

  const list = products.data ?? []
  const productId =
    productChoice ??
    (defaultProductId && list.some((p) => p.id === defaultProductId)
      ? defaultProductId
      : (list[0]?.id ?? ''))

  const create = useMutation({
    mutationFn: () =>
      api.request<Project>('/company/projects', {
        method: 'POST',
        json: {
          product_id: productId,
          name: name.trim(),
          outcome: outcome.trim() || null
        }
      }),
    onSuccess: async (project) => {
      toast.success('Project created')
      await invalidate()
      onCreated(project)
    }
  })

  const ready = !products.isPending && !products.isError && list.length > 0
  const nameError = touched && !name.trim() ? 'Enter a name.' : undefined
  const canSubmit = ready && Boolean(productId) && Boolean(name.trim())

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="New project"
      description="Projects hold tasks toward one outcome."
      onSubmit={() => {
        setTouched(true)
        if (canSubmit && !create.isPending) create.mutate()
      }}
      footer={
        <>
          {ready ? <RequiredLegend className="mr-auto self-center" /> : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {ready ? (
            <Button
              type="submit"
              variant="primary"
              loading={create.isPending}
              disabled={!canSubmit}
            >
              Create project
            </Button>
          ) : null}
        </>
      }
    >
      {products.isPending ? (
        <DialogLoading label="Loading products" />
      ) : products.isError ? (
        <ErrorState
          compact
          title="Couldn't load products"
          error={products.error}
          onRetry={() => products.refetch()}
          retrying={products.isFetching}
        />
      ) : list.length === 0 ? (
        <NeedsParent
          title="Create a product first"
          description="Every project belongs to a product."
          action={
            <Button size="sm" onClick={onCreateProduct}>
              <Package />
              New product
            </Button>
          }
        />
      ) : (
        <>
          {create.isError ? (
            <ErrorState
              compact
              title="Couldn't create the project"
              error={create.error}
            />
          ) : null}
          <Field label="Product" htmlFor="npj-product" required>
            <Select
              id="npj-product"
              value={productId}
              onChange={(event) => setProductChoice(event.target.value)}
            >
              {list.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name || product.id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name" htmlFor="npj-name" required error={nameError}>
            <Input
              id="npj-name"
              value={name}
              autoFocus
              autoComplete="off"
              placeholder="e.g. API refactoring"
              aria-invalid={Boolean(nameError) || undefined}
              aria-describedby={nameError ? 'npj-name-help' : undefined}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </Field>
          <Field
            label="Expected outcome"
            htmlFor="npj-outcome"
            help="Shown on the task board so everyone knows what done looks like."
          >
            <Textarea
              id="npj-outcome"
              rows={3}
              value={outcome}
              placeholder="e.g. Every endpoint has a typed client and tests"
              aria-describedby="npj-outcome-help"
              onChange={(event) => setOutcome(event.target.value)}
            />
          </Field>
        </>
      )}
    </Modal>
  )
}

/* New task ------------------------------------------------------------------ */

export function NewTaskDialog({
  products,
  projects,
  executors,
  defaultProductId,
  defaultProjectId,
  draft,
  onClose,
  onCreated,
  onCreateProject,
  onCreateProduct
}: {
  products: ListState<Product>
  projects: ListState<Project>
  executors: Executors
  defaultProductId: string | null
  defaultProjectId: string | null
  draft?: TaskDraft
  onClose: () => void
  onCreated: (task: Task) => void
  onCreateProject: (productId: string, draft: TaskDraft) => void
  onCreateProduct: (draft: TaskDraft) => void
}) {
  const api = useApi()
  const invalidate = useInvalidateWork()
  const [productChoice, setProductChoice] = useState<string | null>(null)
  const [projectChoice, setProjectChoice] = useState<string | null>(null)
  const [executor, setExecutor] = useState(draft?.executor ?? '')
  const [title, setTitle] = useState(draft?.title ?? '')
  const [brief, setBrief] = useState(draft?.brief ?? '')
  const [touched, setTouched] = useState(false)

  const productList = products.data ?? []
  const productId =
    productChoice ??
    (defaultProductId && productList.some((p) => p.id === defaultProductId)
      ? defaultProductId
      : (productList[0]?.id ?? ''))
  const product = productList.find((p) => p.id === productId)
  const productProjects = sortProjects(
    (projects.data ?? []).filter((p) => p.product_id === productId)
  )
  // A project from another product is never submitted with this product.
  const projectId =
    projectChoice && productProjects.some((p) => p.id === projectChoice)
      ? projectChoice
      : defaultProjectId &&
          productProjects.some((p) => p.id === defaultProjectId)
        ? defaultProjectId
        : (productProjects[0]?.id ?? '')
  const assignee = decodeExecutor(executor)
  const assigneeInfo = assignee
    ? executors.lookup(assignee.type, assignee.id)
    : null
  const currentDraft: TaskDraft = { title, brief, executor }

  const create = useMutation({
    mutationFn: () =>
      api.request<Task>('/company/tasks', {
        method: 'POST',
        json: {
          product_id: productId,
          project_id: projectId,
          title: title.trim(),
          brief: brief.trim() || null,
          status: 'backlog',
          ...(assignee
            ? { executor_type: assignee.type, executor_id: assignee.id }
            : {})
        }
      }),
    onSuccess: async (task) => {
      toast.success('Task created')
      await invalidate()
      onCreated(task)
    }
  })

  const loading = products.isPending || projects.isPending
  const loadError = products.isError
    ? { title: "Couldn't load products", query: products }
    : projects.isError
      ? { title: "Couldn't load projects", query: projects }
      : null
  const ready = !loading && !loadError && productList.length > 0
  const titleError = touched && !title.trim() ? 'Enter a title.' : undefined
  const canSubmit =
    ready && Boolean(productId) && Boolean(projectId) && Boolean(title.trim())

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="New task"
      description="Add work to a project. New tasks start in Backlog."
      size="lg"
      onSubmit={() => {
        setTouched(true)
        if (canSubmit && !create.isPending) create.mutate()
      }}
      footer={
        <>
          {ready ? <RequiredLegend className="mr-auto self-center" /> : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {ready ? (
            <Button
              type="submit"
              variant="primary"
              loading={create.isPending}
              disabled={!canSubmit}
            >
              Create task
            </Button>
          ) : null}
        </>
      }
    >
      {loading ? (
        <DialogLoading label="Loading products and projects" />
      ) : loadError ? (
        <ErrorState
          compact
          title={loadError.title}
          error={loadError.query.error}
          onRetry={() => loadError.query.refetch()}
          retrying={loadError.query.isFetching}
        />
      ) : productList.length === 0 ? (
        <NeedsParent
          title="Create a product first"
          description="Tasks belong to a project inside a product."
          action={
            <Button size="sm" onClick={() => onCreateProduct(currentDraft)}>
              <Package />
              New product
            </Button>
          }
        />
      ) : (
        <>
          {create.isError ? (
            <ErrorState
              compact
              title="Couldn't create the task"
              error={create.error}
            />
          ) : null}
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Product" htmlFor="nt-product" required>
                <Select
                  id="nt-product"
                  value={productId}
                  onChange={(event) => {
                    setProductChoice(event.target.value)
                    setProjectChoice(null)
                  }}
                >
                  {productList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name || item.id}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Project" htmlFor="nt-project" required>
                {productProjects.length > 0 ? (
                  <Select
                    id="nt-project"
                    value={projectId}
                    aria-describedby="nt-project-help"
                    onChange={(event) => setProjectChoice(event.target.value)}
                  >
                    {productProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {projectLabel(project)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Select
                    id="nt-project"
                    value=""
                    disabled
                    aria-describedby="nt-project-help"
                  >
                    <option value="">No projects in this product yet.</option>
                  </Select>
                )}
              </Field>
            </div>
            <p id="nt-project-help" className="text-[12.5px] text-fg-3">
              {productProjects.length > 0
                ? `Only ${product?.name ?? 'this product'}’s projects are listed. Need another one?`
                : 'Create a project to add tasks to this product.'}{' '}
              <button
                type="button"
                className="font-medium text-accent underline-offset-2 hover:underline"
                onClick={() => onCreateProject(productId, currentDraft)}
              >
                Create project
              </button>
            </p>
          </div>
          <Field
            label="Assign to"
            htmlFor="nt-executor"
            help={
              assigneeInfo?.caption ??
              'Optional. You can also choose who runs it when you mark it ready.'
            }
          >
            <Select
              id="nt-executor"
              value={executor}
              aria-describedby="nt-executor-help"
              onChange={(event) => setExecutor(event.target.value)}
            >
              <ExecutorOptions executors={executors} />
            </Select>
          </Field>
          <Field label="Title" htmlFor="nt-title" required error={titleError}>
            <Input
              id="nt-title"
              value={title}
              autoFocus
              autoComplete="off"
              placeholder="e.g. Audit competitor pricing and draft a report"
              aria-invalid={Boolean(titleError) || undefined}
              aria-describedby={titleError ? 'nt-title-help' : undefined}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </Field>
          <Field label="Brief" htmlFor="nt-brief">
            <Textarea
              id="nt-brief"
              rows={4}
              value={brief}
              placeholder="Instructions or acceptance criteria for the team or agent"
              onChange={(event) => setBrief(event.target.value)}
            />
          </Field>
        </>
      )}
    </Modal>
  )
}
