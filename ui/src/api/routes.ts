export const APIRoutes = {
  GetAgents: (agentOSUrl: string) => `${agentOSUrl}/agents`,
  AgentRun: (agentOSUrl: string) => `${agentOSUrl}/agents/{agent_id}/runs`,
  Status: (agentOSUrl: string) => `${agentOSUrl}/health`,
  GetSessions: (agentOSUrl: string) => `${agentOSUrl}/sessions`,
  GetSession: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${sessionId}/runs`,

  DeleteSession: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${sessionId}`,

  GetTeams: (agentOSUrl: string) => `${agentOSUrl}/teams`,
  TeamRun: (agentOSUrl: string, teamId: string) =>
    `${agentOSUrl}/teams/${teamId}/runs`,
  DeleteTeamSession: (agentOSUrl: string, teamId: string, sessionId: string) =>
    `${agentOSUrl}/v1//teams/${teamId}/sessions/${sessionId}`,

  // Observability & Traces
  GetTraces: (agentOSUrl: string) => `${agentOSUrl}/traces`,
  GetTrace: (agentOSUrl: string, traceId: string) =>
    `${agentOSUrl}/traces/${traceId}`,
  GetMetrics: (agentOSUrl: string) => `${agentOSUrl}/metrics`,
  RefreshMetrics: (agentOSUrl: string) => `${agentOSUrl}/metrics/refresh`,
  GetEvalRuns: (agentOSUrl: string) => `${agentOSUrl}/eval-runs`,
  GetPricing: (agentOSUrl: string) => `${agentOSUrl}/api/pricing`,
  UpdatePricing: (agentOSUrl: string) => `${agentOSUrl}/api/pricing`,
  GetCosts: (agentOSUrl: string) => `${agentOSUrl}/api/costs`,

  // Memory & Learnings
  GetMemories: (agentOSUrl: string) => `${agentOSUrl}/memories`,
  CreateMemory: (agentOSUrl: string) => `${agentOSUrl}/memories`,
  UpdateMemory: (agentOSUrl: string, memoryId: string) =>
    `${agentOSUrl}/memories/${memoryId}`,
  DeleteMemory: (agentOSUrl: string, memoryId: string) =>
    `${agentOSUrl}/memories/${memoryId}`,
  GetLearnings: (agentOSUrl: string) => `${agentOSUrl}/learnings`,
  DeleteLearning: (agentOSUrl: string, learningId: string) =>
    `${agentOSUrl}/learnings/${learningId}`,

  // Knowledge Base
  GetKnowledgeContent: (agentOSUrl: string) =>
    `${agentOSUrl}/knowledge/content`,
  UploadKnowledgeContent: (agentOSUrl: string) =>
    `${agentOSUrl}/knowledge/content`,
  DeleteKnowledgeContent: (agentOSUrl: string, contentId: string) =>
    `${agentOSUrl}/knowledge/content/${contentId}`,
  SearchKnowledge: (agentOSUrl: string) => `${agentOSUrl}/knowledge/search`,

  // Schedules
  GetSchedules: (agentOSUrl: string) => `${agentOSUrl}/schedules`,
  EnableSchedule: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${scheduleId}/enable`,
  DisableSchedule: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${scheduleId}/disable`,
  TriggerSchedule: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${scheduleId}/trigger`,
  GetScheduleRuns: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${scheduleId}/runs`,

  // Job Queue
  GetQueueJobs: (agentOSUrl: string) => `${agentOSUrl}/queue/jobs`,
  RequeueJob: (agentOSUrl: string, jobId: string) =>
    `${agentOSUrl}/queue/jobs/${jobId}/requeue`,
  GetQueueStats: (agentOSUrl: string) => `${agentOSUrl}/queue/stats`,

  // Approvals
  GetApprovals: (agentOSUrl: string) => `${agentOSUrl}/approvals`,
  GetApprovalsCount: (agentOSUrl: string) => `${agentOSUrl}/approvals/count`,
  ResolveApproval: (agentOSUrl: string, approvalId: string) =>
    `${agentOSUrl}/approvals/${approvalId}/resolve`,

  // Company Tasks
  GetCompanyProducts: (agentOSUrl: string) => `${agentOSUrl}/company/products`,
  CreateCompanyProduct: (agentOSUrl: string) => `${agentOSUrl}/company/products`,
  GetCompanyProjects: (agentOSUrl: string) => `${agentOSUrl}/company/projects`,
  CreateCompanyProject: (agentOSUrl: string) => `${agentOSUrl}/company/projects`,
  GetCompanyTasks: (agentOSUrl: string) => `${agentOSUrl}/company/tasks`,
  CreateCompanyTask: (agentOSUrl: string) => `${agentOSUrl}/company/tasks`,
  TransitionCompanyTask: (agentOSUrl: string, taskId: string) =>
    `${agentOSUrl}/company/tasks/${taskId}/transitions`,

  // Company Wiki & Playbook
  GetCompanyWikiList: (agentOSUrl: string, productId?: string) =>
    productId
      ? `${agentOSUrl}/company/products/${productId}/wiki`
      : `${agentOSUrl}/company/wiki`,
  GetCompanyWikiPage: (agentOSUrl: string, path: string, productId?: string) =>
    productId
      ? `${agentOSUrl}/company/products/${productId}/wiki/${path}`
      : `${agentOSUrl}/company/wiki/${path}`,
  SaveCompanyWikiPage: (agentOSUrl: string, path: string, productId?: string) =>
    productId
      ? `${agentOSUrl}/company/products/${productId}/wiki/${path}`
      : `${agentOSUrl}/company/wiki/${path}`,

  // Workflows
  GetWorkflows: (agentOSUrl: string) => `${agentOSUrl}/workflows`,
  GetWorkflow: (agentOSUrl: string, workflowId: string) =>
    `${agentOSUrl}/workflows/${workflowId}`,
  WorkflowRun: (agentOSUrl: string, workflowId: string) =>
    `${agentOSUrl}/workflows/${workflowId}/runs`,
  GetWorkflowRuns: (agentOSUrl: string, workflowId: string) =>
    `${agentOSUrl}/workflows/${workflowId}/runs`,

  // Studio Components
  GetComponents: (agentOSUrl: string) => `${agentOSUrl}/components`,
  CreateComponent: (agentOSUrl: string) => `${agentOSUrl}/components`,
  GetComponent: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${componentId}`,
  UpdateComponent: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${componentId}`,
  DeleteComponent: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${componentId}`,
  GetComponentConfigs: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${componentId}/configs`,
  CreateComponentConfig: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${componentId}/configs`,
  SetCurrentComponentConfig: (
    agentOSUrl: string,
    componentId: string,
    version: number | string
  ) => `${agentOSUrl}/components/${componentId}/configs/${version}/set-current`,

  // Registry
  GetRegistry: (agentOSUrl: string) => `${agentOSUrl}/registry`,

  // Filesystem
  GetFilesystemFiles: (agentOSUrl: string) => `${agentOSUrl}/filesystem/files`,
  GetFilesystemEntries: (agentOSUrl: string) =>
    `${agentOSUrl}/filesystem/entries`,
  GetFilesystemContent: (agentOSUrl: string) =>
    `${agentOSUrl}/filesystem/content`,
  SearchFilesystem: (agentOSUrl: string) => `${agentOSUrl}/filesystem/search`,

  // Models
  GetModels: (agentOSUrl: string) => `${agentOSUrl}/api/models`,
  UpdateAgentModel: (agentOSUrl: string, agentId: string) =>
    `${agentOSUrl}/api/agents/${agentId}/model`,
  UpdateTeamModel: (agentOSUrl: string, teamId: string) =>
    `${agentOSUrl}/api/teams/${teamId}/model`
}
