'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from '@/store'
import {
  getApprovalsAPI,
  getApprovalsCountAPI,
  resolveApprovalAPI,
  getSchedulesAPI,
  enableScheduleAPI,
  disableScheduleAPI,
  triggerScheduleAPI,
  getScheduleRunsAPI,
  getQueueJobsAPI,
  requeueJobAPI,
  getQueueStatsAPI,
  getCompanyProductsAPI,
  getCompanyProjectsAPI,
  getCompanyTasksAPI,
  createCompanyTaskAPI,
  transitionCompanyTaskAPI
} from '@/api/os'
import {
  ApprovalResponse,
  ScheduleResponse,
  ScheduleRunResponse,
  QueueJobSchema,
  CompanyProduct,
  CompanyProject,
  CompanyTask
} from '@/types/os'
import {
  ShieldCheck,
  Calendar,
  Layers,
  Briefcase,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Plus,
  CheckCircle2,
  XCircle,
  X,
  Check
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { toast } from 'sonner'

dayjs.extend(relativeTime)

export const OperationsView = () => {
  const {
    selectedEndpoint,
    authToken,
    pendingApprovalsCount,
    setPendingApprovalsCount,
    operationsTab: activeTab,
    setOperationsTab: setActiveTab
  } = useStore()

  // Approvals state
  const [approvals, setApprovals] = useState<ApprovalResponse[]>([])
  const [isApprovalsLoading, setIsApprovalsLoading] = useState(false)

  // Schedules state
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([])
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(false)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [scheduleRuns, setScheduleRuns] = useState<ScheduleRunResponse[]>([])
  const [isRunsLoading, setIsRunsLoading] = useState(false)

  // Queue state
  const [queueJobs, setQueueJobs] = useState<QueueJobSchema[]>([])
  const [queueStats, setQueueStats] = useState<Record<string, number> | null>(null)
  const [isQueueLoading, setIsQueueLoading] = useState(false)

  // Company Tasks state
  const [products, setProducts] = useState<CompanyProduct[]>([])
  const [projects, setProjects] = useState<CompanyProject[]>([])
  const [tasks, setTasks] = useState<CompanyTask[]>([])
  const [isTasksLoading, setIsTasksLoading] = useState(false)
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('ALL')
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskBrief, setNewTaskBrief] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')

  const fetchApprovals = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsApprovalsLoading(true)
    try {
      const [list, count] = await Promise.all([
        getApprovalsAPI(selectedEndpoint, authToken),
        getApprovalsCountAPI(selectedEndpoint, authToken)
      ])
      setApprovals(list)
      setPendingApprovalsCount(count)
    } finally {
      setIsApprovalsLoading(false)
    }
  }, [selectedEndpoint, authToken, setPendingApprovalsCount])

  const fetchSchedules = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsSchedulesLoading(true)
    try {
      const res = await getSchedulesAPI(selectedEndpoint, authToken)
      setSchedules(res)
    } finally {
      setIsSchedulesLoading(false)
    }
  }, [selectedEndpoint, authToken])

  const fetchQueue = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsQueueLoading(true)
    try {
      const [jobs, stats] = await Promise.all([
        getQueueJobsAPI(selectedEndpoint, authToken),
        getQueueStatsAPI(selectedEndpoint, authToken)
      ])
      setQueueJobs(jobs)
      setQueueStats(stats)
    } finally {
      setIsQueueLoading(false)
    }
  }, [selectedEndpoint, authToken])

  const fetchTasks = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsTasksLoading(true)
    try {
      const [prods, projs, ts] = await Promise.all([
        getCompanyProductsAPI(selectedEndpoint, authToken),
        getCompanyProjectsAPI(selectedEndpoint, authToken),
        getCompanyTasksAPI(selectedEndpoint, authToken)
      ])
      setProducts(prods)
      setProjects(projs)
      setTasks(ts)
      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id)
      }
      if (projs.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projs[0].id)
      }
    } finally {
      setIsTasksLoading(false)
    }
  }, [selectedEndpoint, authToken, selectedProductId, selectedProjectId])

  useEffect(() => {
    if (activeTab === 'approvals') fetchApprovals()
    if (activeTab === 'schedules') fetchSchedules()
    if (activeTab === 'queue') fetchQueue()
    if (activeTab === 'tasks') fetchTasks()
  }, [activeTab, fetchApprovals, fetchSchedules, fetchQueue, fetchTasks])

  const handleResolveApproval = async (id: string, status: 'approved' | 'rejected') => {
    const ok = await resolveApprovalAPI(selectedEndpoint, id, status, authToken)
    if (ok) fetchApprovals()
  }

  const handleToggleSchedule = async (schedule: ScheduleResponse) => {
    const action = schedule.enabled ? disableScheduleAPI : enableScheduleAPI
    const ok = await action(selectedEndpoint, schedule.id, authToken)
    if (ok) {
      toast.success(`Schedule ${schedule.enabled ? 'disabled' : 'enabled'}`)
      fetchSchedules()
    } else {
      toast.error('Failed to change schedule state')
    }
  }

  const handleTriggerSchedule = async (id: string) => {
    await triggerScheduleAPI(selectedEndpoint, id, authToken)
  }

  const handleViewScheduleRuns = async (scheduleId: string) => {
    setSelectedScheduleId(scheduleId)
    setIsRunsLoading(true)
    try {
      const runs = await getScheduleRunsAPI(selectedEndpoint, scheduleId, authToken)
      setScheduleRuns(runs)
    } finally {
      setIsRunsLoading(false)
    }
  }

  const handleRequeueJob = async (jobId: string) => {
    const ok = await requeueJobAPI(selectedEndpoint, jobId, authToken)
    if (ok) fetchQueue()
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !selectedProductId) return
    const ok = await createCompanyTaskAPI(
      selectedEndpoint,
      selectedProductId,
      selectedProjectId || (projects[0]?.id || 'default'),
      newTaskTitle.trim(),
      newTaskBrief.trim(),
      authToken
    )
    if (ok) {
      setNewTaskTitle('')
      setNewTaskBrief('')
      setIsCreateTaskOpen(false)
      fetchTasks()
    }
  }

  const handleTransitionTask = async (taskId: string, targetStatus: string) => {
    const ok = await transitionCompanyTaskAPI(
      selectedEndpoint,
      taskId,
      targetStatus,
      `Moved to ${targetStatus} from UI`,
      authToken
    )
    if (ok) fetchTasks()
  }

  const filteredTasks = tasks.filter((t) => {
    if (taskFilterStatus !== 'ALL' && t.status !== taskFilterStatus) return false
    return true
  })

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background text-foreground font-dmmono">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 px-3 md:px-6 py-3 md:py-4">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-primary">
            <Briefcase className="size-5" /> Operations & Command Center
          </h1>
          <p className="text-xs text-muted">
            Manage approvals, recurring routines, background job queues, and company tasks.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded-xl border border-primary/15 bg-accent/40 p-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'approvals'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <ShieldCheck className="size-3.5" /> Approvals
            {pendingApprovalsCount > 0 && (
              <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'schedules'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Calendar className="size-3.5" /> Schedules & Routines
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'queue'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Layers className="size-3.5" /> Job Queue
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'tasks'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Briefcase className="size-3.5" /> Company Tasks
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* APPROVALS TAB */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Human-in-the-Loop Approval Inbox
                </h2>
                <p className="text-xs text-muted">
                  Agents pause here when requiring explicit operator sign-off before running external actions.
                </p>
              </div>

              <button
                onClick={fetchApprovals}
                disabled={isApprovalsLoading}
                className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                <RefreshCw
                  className={`size-3.5 ${isApprovalsLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            <div className="space-y-3">
              {approvals.length === 0 ? (
                <div className="rounded-xl border border-primary/15 bg-accent/20 p-8 text-center text-xs text-muted">
                  <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-400 opacity-60" />
                  {isApprovalsLoading
                    ? 'Loading approvals...'
                    : 'All clear! No pending actions require approval at this time.'}
                </div>
              ) : (
                approvals.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-col md:flex-row md:items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300 uppercase">
                          Action Required
                        </span>
                        <span className="font-semibold text-primary text-xs">
                          {app.tool_name || 'Agent Action'}
                        </span>
                      </div>

                      {app.tool_args && (
                        <pre className="mt-1 max-w-xl overflow-auto rounded bg-black/40 p-2 text-[11px] text-zinc-300">
                          {JSON.stringify(app.tool_args, null, 2)}
                        </pre>
                      )}

                      <div className="text-[10px] text-muted">
                        Session: {app.session_id} | Created:{' '}
                        {app.created_at ? dayjs(app.created_at * 1000).fromNow() : 'recent'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResolveApproval(app.id, 'rejected')}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                      >
                        <XCircle className="size-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => handleResolveApproval(app.id, 'approved')}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 transition"
                      >
                        <Check className="size-3.5" /> Approve Action
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SCHEDULES TAB */}
        {activeTab === 'schedules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Automated Routines & Cron Schedules
                </h2>
                <p className="text-xs text-muted">
                  Periodic background routines executed by Company Manager or scheduled agents.
                </p>
              </div>

              <button
                onClick={fetchSchedules}
                disabled={isSchedulesLoading}
                className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                <RefreshCw
                  className={`size-3.5 ${isSchedulesLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {schedules.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-primary/15 bg-accent/20 p-8 text-center text-xs text-muted">
                  {isSchedulesLoading
                    ? 'Loading schedules...'
                    : 'No schedules registered. The declared `agentos-maintenance` routine will appear here once Company Manager initializes.'}
                </div>
              ) : (
                schedules.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col justify-between rounded-xl border border-primary/15 bg-accent/30 p-4 space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary text-xs">
                          {s.name}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                            s.enabled
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400'
                          }`}
                        >
                          {s.enabled ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>

                      {s.description && (
                        <p className="mt-1 text-xs text-muted line-clamp-2">
                          {s.description}
                        </p>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted">
                        <div>
                          Cron: <span className="text-foreground">{s.cron_expr || 'daily'}</span>
                        </div>
                        <div>
                          Timezone: <span className="text-foreground">{s.timezone}</span>
                        </div>
                        {s.next_run_at && (
                          <div className="col-span-2">
                            Next Run:{' '}
                            <span className="text-foreground">
                              {dayjs(s.next_run_at * 1000).format('MMM D, HH:mm')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-primary/10 pt-2 text-xs">
                      <button
                        onClick={() => handleViewScheduleRuns(s.id)}
                        className="text-primary hover:underline text-[11px]"
                      >
                        Run History &rarr;
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTriggerSchedule(s.id)}
                          className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/20 transition"
                        >
                          <Play className="size-3" /> Run Now
                        </button>
                        <button
                          onClick={() => handleToggleSchedule(s)}
                          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition ${
                            s.enabled
                              ? 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10'
                              : 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                          }`}
                        >
                          {s.enabled ? (
                            <>
                              <Pause className="size-3" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="size-3" /> Enable
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* QUEUE TAB */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Durable PostgreSQL Job Queue
                </h2>
                <p className="text-xs text-muted">
                  Guarantees resilient background agent execution and dead-letter recovery.
                </p>
              </div>

              <button
                onClick={fetchQueue}
                disabled={isQueueLoading}
                className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                <RefreshCw
                  className={`size-3.5 ${isQueueLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            {/* Queue KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-primary/15 bg-accent/30 p-3.5">
                <span className="text-[10px] uppercase text-muted">Queued / Pending</span>
                <div className="mt-1 text-xl font-bold text-foreground">
                  {queueStats?.queued ?? 0}
                </div>
              </div>
              <div className="rounded-xl border border-primary/15 bg-accent/30 p-3.5">
                <span className="text-[10px] uppercase text-muted">Running</span>
                <div className="mt-1 text-xl font-bold text-blue-400">
                  {queueStats?.running ?? 0}
                </div>
              </div>
              <div className="rounded-xl border border-primary/15 bg-accent/30 p-3.5">
                <span className="text-[10px] uppercase text-muted">Completed</span>
                <div className="mt-1 text-xl font-bold text-emerald-400">
                  {queueStats?.completed ?? 0}
                </div>
              </div>
              <div className="rounded-xl border border-primary/15 bg-accent/30 p-3.5">
                <span className="text-[10px] uppercase text-muted">Failed / Dead-Letter</span>
                <div className="mt-1 text-xl font-bold text-rose-400">
                  {queueStats?.failed ?? 0}
                </div>
              </div>
            </div>

            {/* Queue Jobs Table */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Durable Job Queue Table"
              className="overflow-x-auto rounded-xl border border-primary/15 bg-accent/20"
            >
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-primary/10 bg-background/90 backdrop-blur text-muted uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Job ID</th>
                    <th className="px-4 py-3 font-medium">Component</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Attempts</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {queueJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted">
                        {isQueueLoading
                          ? 'Loading jobs...'
                          : 'Queue is currently clear. No background jobs pending.'}
                      </td>
                    </tr>
                  ) : (
                    queueJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-accent/30 transition">
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                              job.status === 'completed'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : job.status === 'failed'
                                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                            }`}
                          >
                            {job.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted">
                          {job.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 font-medium text-primary">
                          {job.component_id}
                        </td>
                        <td className="px-4 py-3 text-muted">{job.job_type}</td>
                        <td className="px-4 py-3 text-muted">
                          {job.attempt} / {job.max_attempts}
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {job.created_at ? dayjs(job.created_at * 1000).fromNow() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {job.status === 'failed' && (
                            <button
                              onClick={() => handleRequeueJob(job.id)}
                              className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-[10px] text-primary hover:bg-accent/80 transition ml-auto"
                            >
                              <RotateCcw className="size-3" /> Requeue
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMPANY TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Company Products, Projects & Tasks
                </h2>
                <p className="text-xs text-muted">
                  The solopreneur backlog, routines, and work proposals governed by Company Manager.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchTasks}
                  disabled={isTasksLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  <RefreshCw
                    className={`size-3.5 ${isTasksLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>

                <button
                  onClick={() => setIsCreateTaskOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-background hover:bg-primary/90 transition shadow-sm"
                >
                  <Plus className="size-3.5" /> Propose Task
                </button>
              </div>
            </div>

            {/* Task Status Filter Bar */}
            <div className="flex rounded-xl border border-primary/15 bg-accent/30 p-1 text-xs w-fit">
              {['ALL', 'backlog', 'ready', 'in_progress', 'done'].map((st) => (
                <button
                  key={st}
                  onClick={() => setTaskFilterStatus(st)}
                  className={`rounded-lg px-3 py-1 text-[11px] capitalize ${
                    taskFilterStatus === st
                      ? 'bg-primary/20 text-primary font-semibold'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Tasks Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTasks.length === 0 ? (
                <div className="col-span-3 rounded-xl border border-primary/15 bg-accent/20 p-8 text-center text-xs text-muted">
                  {isTasksLoading
                    ? 'Loading tasks...'
                    : 'No tasks found. Propose a task or let the `agentos-maintenance` routine propose maintenance work!'}
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col justify-between rounded-xl border border-primary/15 bg-accent/30 p-4 space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase border ${
                            task.status === 'done'
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : task.status === 'in_progress'
                              ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                              : task.status === 'ready'
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400'
                          }`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>

                        {task.executor_id && (
                          <span className="text-[10px] text-muted truncate max-w-[120px]">
                            {task.executor_id}
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 text-xs font-semibold text-foreground">
                        {task.title}
                      </h4>

                      {task.brief && (
                        <p className="mt-1 text-[11px] text-muted line-clamp-3">
                          {task.brief}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-primary/10 pt-2 text-[10px] text-muted">
                      <span>
                        {task.created_at
                          ? dayjs(task.created_at * 1000).fromNow()
                          : ''}
                      </span>

                      {/* State transitions */}
                      <div className="flex items-center gap-1.5">
                        {task.status === 'backlog' && (
                          <button
                            onClick={() => handleTransitionTask(task.id, 'ready')}
                            className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                          >
                            Mark Ready &rarr;
                          </button>
                        )}
                        {task.status === 'ready' && (
                          <button
                            onClick={() => handleTransitionTask(task.id, 'in_progress')}
                            className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] text-blue-300 hover:bg-blue-500/20"
                          >
                            Start &rarr;
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => handleTransitionTask(task.id, 'done')}
                            className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
                          >
                            Mark Done ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Runs Modal */}
      {selectedScheduleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl font-dmmono">
            <div className="flex items-center justify-between border-b border-primary/15 pb-3">
              <h3 className="text-sm font-semibold text-primary">
                Schedule Run History
              </h3>
              <button
                onClick={() => setSelectedScheduleId(null)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
              {scheduleRuns.length === 0 ? (
                <p className="text-center py-6 text-xs text-muted">
                  {isRunsLoading ? 'Loading runs...' : 'No runs recorded for this schedule yet.'}
                </p>
              ) : (
                scheduleRuns.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-primary/10 bg-accent/30 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Attempt #{r.attempt}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          r.status === 'SUCCESS'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.error && (
                      <p className="text-rose-300 text-[11px]">{r.error}</p>
                    )}
                    <div className="text-[10px] text-muted">
                      {r.triggered_at
                        ? dayjs(r.triggered_at * 1000).format('MMM D, YYYY HH:mm:ss')
                        : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl font-dmmono">
            <div className="flex items-center justify-between border-b border-primary/15 pb-3">
              <h3 className="text-sm font-semibold text-primary">
                Propose Company Task
              </h3>
              <button
                onClick={() => setIsCreateTaskOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              {products.length > 0 && (
                <div>
                  <label className="text-xs text-muted uppercase">Company Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-muted uppercase">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audit Agno 3.12 release notes for maintenance"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase">Brief / Objective</label>
                <textarea
                  rows={4}
                  placeholder="Detailed instructions or acceptance criteria for the task..."
                  value={newTaskBrief}
                  onChange={(e) => setNewTaskBrief(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-primary/20 bg-accent/40 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTaskOpen(false)}
                  className="rounded-xl border border-primary/15 px-4 py-2 text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-background hover:bg-primary/90"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
