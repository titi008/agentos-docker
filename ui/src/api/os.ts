import { toast } from 'sonner'

import { APIRoutes } from './routes'

import {
  AgentDetails,
  Sessions,
  TeamDetails,
  TraceSummary,
  TraceDetail,
  MetricsResponse,
  EvalSchema,
  UserMemorySchema,
  LearningResponse,
  ContentResponseSchema,
  VectorSearchResult,
  ScheduleResponse,
  ScheduleRunResponse,
  QueueJobSchema,
  ApprovalResponse,
  CompanyProduct,
  CompanyProject,
  CompanyTask
} from '@/types/os'

// Helper function to create headers with optional auth token
const createHeaders = (authToken?: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  return headers
}

export const getAgentsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<AgentDetails[]> => {
  const url = APIRoutes.GetAgents(endpoint)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Failed to fetch  agents: ${response.statusText}`)
      return []
    }
    const data = await response.json()
    return data
  } catch {
    toast.error('Error fetching  agents')
    return []
  }
}

export const getStatusAPI = async (
  base: string,
  authToken?: string
): Promise<number> => {
  const response = await fetch(APIRoutes.Status(base), {
    method: 'GET',
    headers: createHeaders(authToken)
  })
  return response.status
}

export const getAllSessionsAPI = async (
  base: string,
  type: 'agent' | 'team',
  componentId: string,
  dbId: string,
  authToken?: string
): Promise<Sessions | { data: [] }> => {
  try {
    const url = new URL(APIRoutes.GetSessions(base))
    url.searchParams.set('type', type)
    url.searchParams.set('component_id', componentId)
    url.searchParams.set('db_id', dbId)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken)
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { data: [] }
      }
      throw new Error(`Failed to fetch sessions: ${response.statusText}`)
    }
    return response.json()
  } catch {
    return { data: [] }
  }
}

export const getSessionAPI = async (
  base: string,
  type: 'agent' | 'team',
  sessionId: string,
  dbId?: string,
  authToken?: string
) => {
  // build query string
  const queryParams = new URLSearchParams({ type })
  if (dbId) queryParams.append('db_id', dbId)

  const response = await fetch(
    `${APIRoutes.GetSession(base, sessionId)}?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: createHeaders(authToken)
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.statusText}`)
  }

  return response.json()
}

export const deleteSessionAPI = async (
  base: string,
  dbId: string,
  sessionId: string,
  authToken?: string
) => {
  const queryParams = new URLSearchParams()
  if (dbId) queryParams.append('db_id', dbId)
  const response = await fetch(
    `${APIRoutes.DeleteSession(base, sessionId)}?${queryParams.toString()}`,
    {
      method: 'DELETE',
      headers: createHeaders(authToken)
    }
  )
  return response
}

export const getTeamsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<TeamDetails[]> => {
  const url = APIRoutes.GetTeams(endpoint)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Failed to fetch  teams: ${response.statusText}`)
      return []
    }
    const data = await response.json()

    return data
  } catch {
    toast.error('Error fetching  teams')
    return []
  }
}

export const deleteTeamSessionAPI = async (
  base: string,
  teamId: string,
  sessionId: string,
  authToken?: string
) => {
  const response = await fetch(
    APIRoutes.DeleteTeamSession(base, teamId, sessionId),
    {
      method: 'DELETE',
      headers: createHeaders(authToken)
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to delete team session: ${response.statusText}`)
  }
  return response
}

// ---------------------------------------------------------------------------
// Observability: Traces, Metrics & Evals
// ---------------------------------------------------------------------------

export const getTracesAPI = async (
  endpoint: string,
  authToken?: string,
  page: number = 1,
  limit: number = 20
): Promise<{ data: TraceSummary[]; meta?: Record<string, unknown> }> => {
  try {
    const url = new URL(APIRoutes.GetTraces(endpoint))
    url.searchParams.set('page', page.toString())
    url.searchParams.set('limit', limit.toString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Failed to fetch traces: ${response.statusText}`)
      return { data: [] }
    }
    const result = await response.json()
    return Array.isArray(result) ? { data: result } : result
  } catch {
    toast.error('Error fetching traces')
    return { data: [] }
  }
}

export const getTraceDetailAPI = async (
  endpoint: string,
  traceId: string,
  authToken?: string
): Promise<TraceDetail | null> => {
  try {
    const response = await fetch(APIRoutes.GetTrace(endpoint, traceId), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Failed to fetch trace details: ${response.statusText}`)
      return null
    }
    return response.json()
  } catch {
    toast.error('Error fetching trace details')
    return null
  }
}

export const getMetricsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<MetricsResponse | null> => {
  try {
    const response = await fetch(APIRoutes.GetMetrics(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return null
    }
    return response.json()
  } catch {
    return null
  }
}

export const refreshMetricsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.RefreshMetrics(endpoint), {
      method: 'POST',
      headers: createHeaders(authToken)
    })
    return response.ok
  } catch {
    return false
  }
}

export const getEvalRunsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<EvalSchema[]> => {
  try {
    const response = await fetch(APIRoutes.GetEvalRuns(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Memory & Learnings
// ---------------------------------------------------------------------------

export const getMemoriesAPI = async (
  endpoint: string,
  authToken?: string,
  search?: string
): Promise<UserMemorySchema[]> => {
  try {
    const url = new URL(APIRoutes.GetMemories(endpoint))
    if (search) url.searchParams.set('search_content', search)
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const createMemoryAPI = async (
  endpoint: string,
  memory: string,
  topics?: string[],
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.CreateMemory(endpoint), {
      method: 'POST',
      headers: createHeaders(authToken),
      body: JSON.stringify({ memory, topics: topics || [] })
    })
    if (!response.ok) {
      toast.error('Failed to create memory')
      return false
    }
    toast.success('Memory saved')
    return true
  } catch {
    toast.error('Error creating memory')
    return false
  }
}

export const updateMemoryAPI = async (
  endpoint: string,
  memoryId: string,
  memory: string,
  topics?: string[],
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.UpdateMemory(endpoint, memoryId), {
      method: 'PATCH',
      headers: createHeaders(authToken),
      body: JSON.stringify({ memory, topics: topics || [] })
    })
    if (!response.ok) {
      toast.error('Failed to update memory')
      return false
    }
    toast.success('Memory updated')
    return true
  } catch {
    toast.error('Error updating memory')
    return false
  }
}

export const deleteMemoryAPI = async (
  endpoint: string,
  memoryId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.DeleteMemory(endpoint, memoryId), {
      method: 'DELETE',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error('Failed to delete memory')
      return false
    }
    toast.success('Memory deleted')
    return true
  } catch {
    toast.error('Error deleting memory')
    return false
  }
}

export const getLearningsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<LearningResponse[]> => {
  try {
    const response = await fetch(APIRoutes.GetLearnings(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const deleteLearningAPI = async (
  endpoint: string,
  learningId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.DeleteLearning(endpoint, learningId),
      {
        method: 'DELETE',
        headers: createHeaders(authToken)
      }
    )
    return response.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Knowledge Base
// ---------------------------------------------------------------------------

export const getKnowledgeContentAPI = async (
  endpoint: string,
  authToken?: string
): Promise<ContentResponseSchema[]> => {
  try {
    const response = await fetch(APIRoutes.GetKnowledgeContent(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const uploadKnowledgeTextAPI = async (
  endpoint: string,
  name: string,
  textContent: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const url = new URL(APIRoutes.UploadKnowledgeContent(endpoint))
    url.searchParams.set('name', name)
    url.searchParams.set('text_content', textContent)

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error(`Upload failed: ${response.statusText}`)
      return false
    }
    toast.success('Document uploaded to knowledge base')
    return true
  } catch {
    toast.error('Error uploading document')
    return false
  }
}

export const deleteKnowledgeContentAPI = async (
  endpoint: string,
  contentId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.DeleteKnowledgeContent(endpoint, contentId),
      {
        method: 'DELETE',
        headers: createHeaders(authToken)
      }
    )
    if (!response.ok) {
      toast.error('Failed to delete document')
      return false
    }
    toast.success('Document deleted')
    return true
  } catch {
    toast.error('Error deleting document')
    return false
  }
}

export const searchKnowledgeAPI = async (
  endpoint: string,
  query: string,
  authToken?: string
): Promise<VectorSearchResult[]> => {
  try {
    const response = await fetch(APIRoutes.SearchKnowledge(endpoint), {
      method: 'POST',
      headers: createHeaders(authToken),
      body: JSON.stringify({ query, max_results: 5 })
    })
    if (!response.ok) {
      toast.error('Search failed')
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    toast.error('Error querying knowledge base')
    return []
  }
}

// ---------------------------------------------------------------------------
// Operations: Schedules, Queue, Approvals & Company
// ---------------------------------------------------------------------------

export const getSchedulesAPI = async (
  endpoint: string,
  authToken?: string
): Promise<ScheduleResponse[]> => {
  try {
    const response = await fetch(APIRoutes.GetSchedules(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const enableScheduleAPI = async (
  endpoint: string,
  scheduleId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.EnableSchedule(endpoint, scheduleId),
      {
        method: 'POST',
        headers: createHeaders(authToken)
      }
    )
    return response.ok
  } catch {
    return false
  }
}

export const disableScheduleAPI = async (
  endpoint: string,
  scheduleId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.DisableSchedule(endpoint, scheduleId),
      {
        method: 'POST',
        headers: createHeaders(authToken)
      }
    )
    return response.ok
  } catch {
    return false
  }
}

export const triggerScheduleAPI = async (
  endpoint: string,
  scheduleId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.TriggerSchedule(endpoint, scheduleId),
      {
        method: 'POST',
        headers: createHeaders(authToken)
      }
    )
    if (!response.ok) {
      toast.error('Failed to trigger schedule')
      return false
    }
    toast.success('Schedule triggered')
    return true
  } catch {
    toast.error('Error triggering schedule')
    return false
  }
}

export const getScheduleRunsAPI = async (
  endpoint: string,
  scheduleId: string,
  authToken?: string
): Promise<ScheduleRunResponse[]> => {
  try {
    const response = await fetch(
      APIRoutes.GetScheduleRuns(endpoint, scheduleId),
      {
        method: 'GET',
        headers: createHeaders(authToken)
      }
    )
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const getQueueJobsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<QueueJobSchema[]> => {
  try {
    const response = await fetch(APIRoutes.GetQueueJobs(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const requeueJobAPI = async (
  endpoint: string,
  jobId: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.RequeueJob(endpoint, jobId), {
      method: 'POST',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      toast.error('Failed to requeue job')
      return false
    }
    toast.success('Job requeued')
    return true
  } catch {
    toast.error('Error requeuing job')
    return false
  }
}

export const getQueueStatsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<Record<string, number> | null> => {
  try {
    const response = await fetch(APIRoutes.GetQueueStats(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return null
    }
    return response.json()
  } catch {
    return null
  }
}

export const getApprovalsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<ApprovalResponse[]> => {
  try {
    const response = await fetch(APIRoutes.GetApprovals(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.approvals || result.data || []
  } catch {
    return []
  }
}

export const getApprovalsCountAPI = async (
  endpoint: string,
  authToken?: string
): Promise<number> => {
  try {
    const response = await fetch(APIRoutes.GetApprovalsCount(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return 0
    }
    const result = await response.json()
    return typeof result.count === 'number' ? result.count : 0
  } catch {
    return 0
  }
}

export const resolveApprovalAPI = async (
  endpoint: string,
  approvalId: string,
  status: 'approved' | 'rejected',
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.ResolveApproval(endpoint, approvalId),
      {
        method: 'POST',
        headers: createHeaders(authToken),
        body: JSON.stringify({ status })
      }
    )
    if (!response.ok) {
      toast.error(`Failed to ${status} approval`)
      return false
    }
    toast.success(`Approval ${status}`)
    return true
  } catch {
    toast.error('Error resolving approval')
    return false
  }
}

export const getCompanyProductsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<CompanyProduct[]> => {
  try {
    const response = await fetch(APIRoutes.GetCompanyProducts(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const getCompanyProjectsAPI = async (
  endpoint: string,
  authToken?: string
): Promise<CompanyProject[]> => {
  try {
    const response = await fetch(APIRoutes.GetCompanyProjects(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const getCompanyTasksAPI = async (
  endpoint: string,
  authToken?: string
): Promise<CompanyTask[]> => {
  try {
    const response = await fetch(APIRoutes.GetCompanyTasks(endpoint), {
      method: 'GET',
      headers: createHeaders(authToken)
    })
    if (!response.ok) {
      return []
    }
    const result = await response.json()
    return Array.isArray(result) ? result : result.data || []
  } catch {
    return []
  }
}

export const createCompanyTaskAPI = async (
  endpoint: string,
  productId: string,
  projectId: string,
  title: string,
  brief?: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(APIRoutes.CreateCompanyTask(endpoint), {
      method: 'POST',
      headers: createHeaders(authToken),
      body: JSON.stringify({
        product_id: productId,
        project_id: projectId,
        title,
        brief,
        status: 'backlog'
      })
    })
    if (!response.ok) {
      toast.error('Failed to create task')
      return false
    }
    toast.success('Task created')
    return true
  } catch {
    toast.error('Error creating task')
    return false
  }
}

export const transitionCompanyTaskAPI = async (
  endpoint: string,
  taskId: string,
  targetStatus: string,
  reason: string,
  authToken?: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      APIRoutes.TransitionCompanyTask(endpoint, taskId),
      {
        method: 'POST',
        headers: createHeaders(authToken),
        body: JSON.stringify({ target: targetStatus, reason })
      }
    )
    if (!response.ok) {
      toast.error('Failed to transition task')
      return false
    }
    toast.success(`Task moved to ${targetStatus}`)
    return true
  } catch {
    toast.error('Error transitioning task')
    return false
  }
}
