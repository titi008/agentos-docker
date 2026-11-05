'use client'

import {
  ChevronDown,
  FolderPlus,
  ListTodo,
  PackagePlus,
  Plus,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useMemo, useState, type ReactNode } from 'react'

import { SECTIONS } from '@/components/shell/nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/field'
import { SearchInput, Select } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import {
  PageHeader,
  RouteTabs,
  SplitLayout,
  SplitMain
} from '@/components/ui/page'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { useProductsQuery, useProjectsQuery, useTasksQuery } from './api'
import {
  NewProductDialog,
  NewProjectDialog,
  NewTaskDialog,
  isActiveProject,
  sortProjects,
  type TaskDraft
} from './CompanyDialogs'
import { useExecutors } from './executors'
import { BOARD_STATUSES } from './status'
import { TaskBoard, TaskBoardSkeleton } from './TaskBoard'
import { TaskDetail } from './TaskDetail'
import type { Project, Task, TaskStatus } from './types'

const ALL_PRODUCTS = 'all'
const NEW_KINDS = ['task', 'product', 'project'] as const
type NewKind = (typeof NEW_KINDS)[number]

/** Extra state carried between chained create dialogs. */
interface DialogContext {
  productId?: string
  projectId?: string
  draft?: TaskDraft
  /** Reopen this dialog once the parent record has been created. */
  returnTo?: 'task' | 'project'
}

function ProjectChip({
  name,
  count,
  caption,
  title,
  selected,
  onClick
}: {
  name: string
  count: number
  caption: string
  title?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={title}
      onClick={onClick}
      className={cn(
        'flex max-w-[236px] shrink-0 flex-col items-start gap-0.5 rounded-[10px] border px-3 py-[7px] text-left transition-colors max-md:min-h-11 max-md:justify-center',
        selected
          ? 'border-accent bg-accent-soft'
          : 'border-line bg-surface hover:border-line-strong'
      )}
    >
      <span className="flex max-w-full items-center gap-1.5 text-[13px] font-medium">
        <span className="truncate">{name}</span>
        <span className="font-normal text-fg-3 tabular-nums">{count}</span>
      </span>
      <span className="max-w-[210px] truncate text-xs text-fg-3 max-md:hidden">
        {caption}
      </span>
    </button>
  )
}

export function TasksView() {
  const section = SECTIONS.company
  const [productParam, setProductParam] = useQueryState('product')
  const [projectParam, setProjectParam] = useQueryState('project')
  const [taskId, setTaskId] = useQueryState(
    'task',
    parseAsString.withOptions({ history: 'push' })
  )
  const [newKind, setNewKind] = useQueryState(
    'new',
    parseAsStringLiteral(NEW_KINDS)
  )
  const [dialogContext, setDialogContext] = useState<DialogContext>({})
  const [search, setSearch] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>('backlog')

  const products = useProductsQuery()
  const projects = useProjectsQuery()
  const executors = useExecutors()

  const productList = useMemo(() => products.data ?? [], [products.data])
  const projectList = useMemo(() => projects.data ?? [], [projects.data])

  // The product filter defaults to the first product; "all" is explicit.
  const productId: string | null =
    productParam === ALL_PRODUCTS
      ? null
      : productParam &&
          (products.isPending || productList.some((p) => p.id === productParam))
        ? productParam
        : (productList[0]?.id ?? null)
  const product = productList.find((p) => p.id === productId)
  const productProjects = useMemo(
    () => sortProjects(projectList.filter((p) => p.product_id === productId)),
    [projectList, productId]
  )
  const projectId =
    productId && productProjects.some((p) => p.id === projectParam)
      ? projectParam
      : null
  const project = productProjects.find((p) => p.id === projectId)

  // Wait for the default product instead of loading every task first.
  const tasksEnabled = productParam !== null || products.isSuccess
  const tasks = useTasksQuery(productId, { enabled: tasksEnabled })

  const projectsById = useMemo(
    () => new Map(projectList.map((p) => [p.id, p] as [string, Project])),
    [projectList]
  )

  const visibleTasks = useMemo(
    () =>
      (tasks.data ?? []).filter(
        (task) => showCancelled || task.status !== 'cancelled'
      ),
    [tasks.data, showCancelled]
  )
  const inProject = projectId
    ? visibleTasks.filter((task) => task.project_id === projectId)
    : visibleTasks
  const query = search.trim().toLowerCase()
  const matching = query
    ? inProject.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          (task.brief ?? '').toLowerCase().includes(query)
      )
    : inProject

  const statuses: TaskStatus[] = showCancelled
    ? [...BOARD_STATUSES, 'cancelled']
    : BOARD_STATUSES
  const groups = new Map<TaskStatus, Task[]>(
    statuses.map((status) => [
      status,
      matching.filter((task) => task.status === status)
    ])
  )
  const projectCounts = new Map<string, number>()
  for (const task of visibleTasks) {
    if (task.project_id) {
      projectCounts.set(
        task.project_id,
        (projectCounts.get(task.project_id) ?? 0) + 1
      )
    }
  }
  // Finished projects only show up while they still hold visible tasks.
  const chipProjects = productProjects.filter(
    (p) =>
      isActiveProject(p) ||
      (projectCounts.get(p.id) ?? 0) > 0 ||
      p.id === projectId
  )

  const openDialog = (kind: NewKind, context: DialogContext = {}) => {
    setDialogContext(context)
    void setNewKind(kind)
  }
  const closeDialog = () => {
    setDialogContext({})
    void setNewKind(null)
  }
  const selectProduct = (value: string) => {
    void setProductParam(value)
    void setProjectParam(null)
  }

  const refreshing =
    products.isFetching || projects.isFetching || tasks.isFetching
  const refresh = () => {
    void products.refetch()
    void projects.refetch()
    if (tasksEnabled) void tasks.refetch()
  }

  const activeFilters = (query ? 1 : 0) + (showCancelled ? 1 : 0)
  const selectedPlaceholder = taskId
    ? tasks.data?.find((task) => task.id === taskId)
    : undefined

  let content: ReactNode
  if (products.isError) {
    content = (
      <ErrorState
        title="Couldn't load products"
        error={products.error}
        onRetry={() => products.refetch()}
        retrying={products.isFetching}
      />
    )
  } else if (products.isSuccess && productList.length === 0) {
    content = (
      <EmptyState
        icon={<PackagePlus />}
        title="No products yet"
        description="A product groups projects, tasks and its own wiki. Create one to start planning work with Company Manager."
        action={
          <Button variant="primary" onClick={() => openDialog('product')}>
            <Plus />
            New product
          </Button>
        }
      />
    )
  } else if (tasks.isError) {
    content = (
      <ErrorState
        title="Couldn't load tasks"
        error={tasks.error}
        onRetry={() => tasks.refetch()}
        retrying={tasks.isFetching}
      />
    )
  } else if (!tasks.data) {
    content = <TaskBoardSkeleton columns={statuses.length} />
  } else if (inProject.length === 0) {
    content = (
      <EmptyState
        icon={<ListTodo />}
        title={project ? `No tasks in ${project.name} yet` : 'No tasks yet'}
        description="Tasks you propose, or that the agentos-maintenance routine suggests, appear here."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="primary"
              onClick={() =>
                openDialog('task', {
                  productId: productId ?? undefined,
                  projectId: projectId ?? undefined
                })
              }
            >
              <Plus />
              New task
            </Button>
            <Button
              onClick={() =>
                openDialog('project', { productId: productId ?? undefined })
              }
            >
              <FolderPlus />
              New project
            </Button>
          </div>
        }
      />
    )
  } else if (matching.length === 0) {
    content = (
      <EmptyState
        title={`No tasks match “${search.trim()}”`}
        description="Try another word, or clear the search to see every task."
        action={<Button onClick={() => setSearch('')}>Clear search</Button>}
      />
    )
  } else {
    content = (
      <TaskBoard
        statuses={statuses}
        groups={groups}
        mobileStatus={mobileStatus}
        onMobileStatusChange={setMobileStatus}
        selectedId={taskId}
        onSelect={(id) => void setTaskId(id)}
        projectsById={projectsById}
        showProject={!projectId}
        executors={executors}
      />
    )
  }

  const listState = {
    products: {
      data: products.data,
      isPending: products.isPending,
      isError: products.isError,
      error: products.error,
      refetch: products.refetch,
      isFetching: products.isFetching
    },
    projects: {
      data: projects.data,
      isPending: projects.isPending,
      isError: projects.isError,
      error: projects.error,
      refetch: projects.refetch,
      isFetching: projects.isFetching
    }
  }

  return (
    <>
      <PageHeader
        title={section.title}
        description={section.description}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              loading={refreshing}
            >
              {refreshing ? null : <RefreshCw />}
              Refresh
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" aria-label="New product or project">
                  <Plus />
                  New
                  <ChevronDown />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => openDialog('product')}>
                  <PackagePlus />
                  Product
                </MenuItem>
                <MenuItem
                  onSelect={() =>
                    openDialog('project', {
                      productId: productId ?? undefined
                    })
                  }
                >
                  <FolderPlus />
                  Project
                </MenuItem>
              </MenuContent>
            </Menu>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                openDialog('task', {
                  productId: productId ?? undefined,
                  projectId: projectId ?? undefined
                })
              }
            >
              <Plus />
              New task
            </Button>
          </>
        }
      />
      <RouteTabs tabs={section.tabs} aria-label="Company sections" />
      <SplitLayout>
        <SplitMain>
          <div className="flex flex-col gap-4 p-4 md:px-6 md:pt-5 md:pb-8">
            {productList.length > 0 ? (
              <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
                <div className="flex w-full flex-col gap-1.5 sm:w-60">
                  <Label htmlFor="task-product">Product</Label>
                  <Select
                    id="task-product"
                    value={
                      productParam === ALL_PRODUCTS
                        ? ALL_PRODUCTS
                        : (productId ?? '')
                    }
                    aria-describedby="task-product-help"
                    onChange={(event) => selectProduct(event.target.value)}
                  >
                    {productList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name || item.id}
                      </option>
                    ))}
                    <option value={ALL_PRODUCTS}>All products</option>
                  </Select>
                  <p
                    id="task-product-help"
                    className="line-clamp-3 text-xs text-fg-3"
                  >
                    {product
                      ? product.purpose || 'No purpose written yet.'
                      : 'Tasks from every product.'}
                  </p>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 max-sm:w-full">
                  <span
                    id="task-project-label"
                    className="text-[13px] font-medium"
                  >
                    Project
                  </span>
                  {!productId ? (
                    <p className="text-[13px] text-fg-3">
                      Choose a product to filter by project.
                    </p>
                  ) : projects.isError ? (
                    <ErrorState
                      compact
                      title="Couldn't load projects"
                      error={projects.error}
                      onRetry={() => projects.refetch()}
                      retrying={projects.isFetching}
                    />
                  ) : (
                    <>
                      <div
                        role="group"
                        aria-labelledby="task-project-label"
                        className="flex gap-2 max-md:-mx-4 max-md:overflow-x-auto max-md:px-4 max-md:pb-1 md:flex-wrap"
                      >
                        <ProjectChip
                          name="All projects"
                          count={visibleTasks.length}
                          caption={`Every task in ${product?.name ?? 'this product'}`}
                          selected={!projectId}
                          onClick={() => void setProjectParam(null)}
                        />
                        {chipProjects.map((item) => (
                          <ProjectChip
                            key={item.id}
                            name={item.name}
                            count={projectCounts.get(item.id) ?? 0}
                            caption={item.outcome || 'No expected outcome yet.'}
                            title={
                              item.outcome
                                ? `Outcome: ${item.outcome}`
                                : undefined
                            }
                            selected={item.id === projectId}
                            onClick={() => void setProjectParam(item.id)}
                          />
                        ))}
                      </div>
                      {project?.outcome ? (
                        <p className="text-xs text-fg-3 md:hidden">
                          Outcome: {project.outcome}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {productList.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <Button
                  size="sm"
                  className="md:hidden"
                  aria-expanded={filtersOpen}
                  aria-controls="task-filters"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <SlidersHorizontal />
                  Filters
                  {activeFilters > 0 ? (
                    <Badge tone="accent" className="h-5 px-1.5">
                      {activeFilters}
                    </Badge>
                  ) : null}
                </Button>
                <div
                  id="task-filters"
                  className={cn(
                    'flex flex-wrap items-center gap-x-4 gap-y-3 max-md:w-full max-md:rounded-xl max-md:border max-md:border-line max-md:bg-surface max-md:p-3',
                    !filtersOpen && 'max-md:hidden'
                  )}
                >
                  <SearchInput
                    className="w-full md:w-72"
                    aria-label="Search tasks"
                    placeholder="Search tasks by title or brief"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <label className="inline-flex min-h-9 items-center gap-2 text-[13px] text-fg-2">
                    <Switch
                      checked={showCancelled}
                      onCheckedChange={(checked) => {
                        setShowCancelled(checked)
                        if (!checked && mobileStatus === 'cancelled') {
                          setMobileStatus('backlog')
                        }
                      }}
                    />
                    Show cancelled
                  </label>
                </div>
                {tasks.data ? (
                  <span className="ml-auto text-[12.5px] text-fg-3">
                    {matching.length} {matching.length === 1 ? 'task' : 'tasks'}
                  </span>
                ) : null}
              </div>
            ) : null}

            {content}
          </div>
        </SplitMain>
        {taskId ? (
          <TaskDetail
            key={taskId}
            taskId={taskId}
            placeholder={selectedPlaceholder}
            products={productList}
            projects={projectList}
            executors={executors}
            onClose={() => void setTaskId(null)}
          />
        ) : null}
      </SplitLayout>

      {newKind === 'product' ? (
        <NewProductDialog
          onClose={closeDialog}
          onCreated={(created) => {
            const { returnTo, draft } = dialogContext
            if (returnTo === 'project') {
              // A project dialog opened from the task form returns there next.
              openDialog('project', {
                productId: created.id,
                draft,
                returnTo: draft ? 'task' : undefined
              })
              return
            }
            if (returnTo === 'task') {
              openDialog('task', { productId: created.id, draft })
              return
            }
            closeDialog()
            selectProduct(created.id)
          }}
        />
      ) : null}
      {newKind === 'project' ? (
        <NewProjectDialog
          products={listState.products}
          defaultProductId={dialogContext.productId ?? productId}
          onClose={closeDialog}
          onCreateProduct={() =>
            openDialog('product', {
              returnTo: 'project',
              draft: dialogContext.draft
            })
          }
          onCreated={(created) => {
            if (dialogContext.returnTo === 'task') {
              openDialog('task', {
                productId: created.product_id,
                projectId: created.id,
                draft: dialogContext.draft
              })
              return
            }
            closeDialog()
            void setProductParam(created.product_id)
            void setProjectParam(created.id)
          }}
        />
      ) : null}
      {newKind === 'task' ? (
        <NewTaskDialog
          products={listState.products}
          projects={listState.projects}
          executors={executors}
          defaultProductId={dialogContext.productId ?? productId}
          defaultProjectId={dialogContext.projectId ?? projectId}
          draft={dialogContext.draft}
          onClose={closeDialog}
          onCreateProduct={(draft) =>
            openDialog('product', { returnTo: 'task', draft })
          }
          onCreateProject={(forProduct, draft) =>
            openDialog('project', {
              productId: forProduct,
              returnTo: 'task',
              draft
            })
          }
          onCreated={(created) => {
            closeDialog()
            // Keep the new task visible on the board.
            if (
              productParam !== ALL_PRODUCTS &&
              created.product_id !== productId
            ) {
              selectProduct(created.product_id)
            } else if (projectId && created.project_id !== projectId) {
              void setProjectParam(null)
            }
            void setTaskId(created.id)
          }}
        />
      ) : null}
    </>
  )
}
