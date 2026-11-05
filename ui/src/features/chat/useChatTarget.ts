'use client'

import { hashKey, useQueryClient } from '@tanstack/react-query'
import { parseAsString, useQueryStates } from 'nuqs'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

import { useApi } from '@/api/client'
import { WORKSPACE_KEY } from '@/features/workspace/queries'
import { useStore, type ChatLocation, type ChatMode } from '@/store'

import { useSessionOwner } from './queries'
import {
  agentTarget,
  defaultTarget,
  teamTarget,
  workflowTarget,
  type ChatTarget
} from './targets'

const chatParams = {
  agent: parseAsString,
  team: parseAsString,
  workflow: parseAsString,
  session: parseAsString,
  db_id: parseAsString
}

/**
 * - `connecting`: the first health check is still running
 * - `offline`: AgentOS can't be reached
 * - `loading`: agents, teams and workflows are still loading
 * - `empty`: the server has nothing to chat with
 * - `missing`: the URL names an id the server doesn't know
 * - `ready`: `target` is set
 */
export type ChatTargetStatus =
  'connecting' | 'offline' | 'loading' | 'empty' | 'missing' | 'ready'

function targetParams(target: ChatTarget) {
  return {
    agent: target.kind === 'agent' ? target.id : null,
    team: target.kind === 'team' ? target.id : null,
    workflow: target.kind === 'workflow' ? target.id : null,
    db_id: target.dbId
  }
}

/** True once the shell's agents, teams and workflows queries have settled. */
function useWorkspaceListsSettled(): boolean {
  const qc = useQueryClient()
  const { key } = useApi()
  const hashes = useMemo(
    () =>
      ['agents', 'teams', 'workflows'].map((name) =>
        hashKey(key(WORKSPACE_KEY, name))
      ),
    [key]
  )
  const subscribe = useCallback(
    (onChange: () => void) => qc.getQueryCache().subscribe(onChange),
    [qc]
  )
  const getSnapshot = () =>
    hashes.every((hash) => {
      const status = qc.getQueryCache().get(hash)?.state.status
      return status === 'success' || status === 'error'
    })
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/**
 * The agent, team or workflow the chat talks to, read from the URL
 * (`?agent=`, `?team=` or `?workflow=`, plus `session` and `db_id`) and
 * validated against the lists the app shell loads. With no target in the
 * URL it restores the last chat or picks the first available target.
 */
export function useChatTarget() {
  const [params, setParams] = useQueryStates(chatParams)
  const agents = useStore((state) => state.agents)
  const teams = useStore((state) => state.teams)
  const workflows = useStore((state) => state.workflows)
  const isEndpointActive = useStore((state) => state.isEndpointActive)
  const isEndpointLoading = useStore((state) => state.isEndpointLoading)
  const activeChat = useStore((state) => state.activeChat)
  const listsSettled = useWorkspaceListsSettled()

  const targets = useMemo(
    () => [
      ...teams.map(teamTarget),
      ...agents.map(agentTarget),
      ...workflows.map(workflowTarget)
    ],
    [agents, teams, workflows]
  )

  const kind: ChatMode | null = params.agent
    ? 'agent'
    : params.team
      ? 'team'
      : params.workflow
        ? 'workflow'
        : null
  const id = kind ? params[kind] : null
  const target =
    (kind && id
      ? targets.find((item) => item.kind === kind && item.id === id)
      : null) ?? null

  const ready = isEndpointActive && listsSettled
  const status: ChatTargetStatus = target
    ? 'ready'
    : isEndpointLoading
      ? 'connecting'
      : !isEndpointActive
        ? 'offline'
        : !listsSettled
          ? 'loading'
          : targets.length === 0
            ? 'empty'
            : kind && id
              ? 'missing'
              : 'loading'

  const sessionId = params.session
  const dbId = target?.dbId ?? params.db_id ?? null

  // Links that carry only `?session=`: ask the server who owns the session.
  const owner = useSessionOwner(!kind && ready ? sessionId : null, params.db_id)

  useEffect(() => {
    if (kind || !ready || targets.length === 0) return
    const select = (next: ChatTarget, session: string | null = null): void => {
      void setParams({ ...targetParams(next), session }, { history: 'replace' })
    }
    if (sessionId) {
      if (owner.isPending) return
      const found = owner.data
        ? targets.find(
            (item) =>
              item.kind === owner.data?.kind && item.id === owner.data.id
          )
        : undefined
      if (found) {
        select(found, sessionId)
        return
      }
    }
    const previous = activeChat
      ? targets.find(
          (item) => item.kind === activeChat.kind && item.id === activeChat.id
        )
      : undefined
    if (previous) {
      select(previous, activeChat?.sessionId ?? null)
      return
    }
    const first = defaultTarget(targets)
    if (first) select(first)
  }, [
    kind,
    ready,
    targets,
    sessionId,
    owner.isPending,
    owner.data,
    activeChat,
    setParams
  ])

  /** Starts a new chat with another target (adds a history entry). */
  const selectTarget = useCallback(
    (next: ChatTarget) =>
      setParams({ ...targetParams(next), session: null }, { history: 'push' }),
    [setParams]
  )

  /** Puts a session in the URL (`push` when the operator opened it). */
  const setSession = useCallback(
    (session: string | null, history: 'push' | 'replace' = 'replace') =>
      setParams({ session }, { history }),
    [setParams]
  )

  const location = useMemo<ChatLocation | null>(
    () =>
      target ? { kind: target.kind, id: target.id, sessionId, dbId } : null,
    [target, sessionId, dbId]
  )

  return {
    /** Kind and id named in the URL, even when unknown to the server. */
    requested: kind && id ? { kind, id } : null,
    target,
    targets,
    status,
    location,
    selectTarget,
    setSession
  }
}
