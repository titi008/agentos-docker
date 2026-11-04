'use client'

import * as React from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { useStore } from '@/store'
import { useQueryState } from 'nuqs'
import Icon from '@/components/ui/icon'
import { useEffect } from 'react'
import useChatActions from '@/hooks/useChatActions'

export function EntitySelector() {
  const { mode, agents, teams, workflows, setMessages, setSelectedModel } =
    useStore()

  const { focusChatInput } = useChatActions()
  const [agentId, setAgentId] = useQueryState('agent', {
    parse: (value) => value || undefined,
    history: 'push'
  })
  const [teamId, setTeamId] = useQueryState('team', {
    parse: (value) => value || undefined,
    history: 'push'
  })
  const [workflowId, setWorkflowId] = useQueryState('workflow', {
    parse: (value) => value || undefined,
    history: 'push'
  })
  const [, setSessionId] = useQueryState('session')

  const currentEntities =
    mode === 'workflow' ? workflows : mode === 'team' ? teams : agents
  const currentValue =
    mode === 'workflow' ? workflowId : mode === 'team' ? teamId : agentId
  const placeholder =
    mode === 'workflow'
      ? 'Select Workflow'
      : mode === 'team'
        ? 'Select Team'
        : 'Select Agent'

  useEffect(() => {
    if (currentValue && currentEntities.length > 0) {
      const entity = currentEntities.find((item) => item.id === currentValue)
      if (entity) {
        if (mode === 'workflow') {
          setWorkflowId(entity.id)
          setSelectedModel('Workflow Pipeline')
        } else {
          setSelectedModel((entity as { model?: { model?: string } }).model?.model || '')
          if (mode === 'team') {
            setTeamId(entity.id)
          }
        }
        focusChatInput()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue, currentEntities, setSelectedModel, mode])

  const handleOnValueChange = (value: string) => {
    const newValue = value === currentValue ? null : value
    const selectedEntity = currentEntities.find((item) => item.id === newValue)

    if (mode === 'workflow') {
      setWorkflowId(newValue)
      setAgentId(null)
      setTeamId(null)
      setSelectedModel('Workflow Pipeline')
    } else if (mode === 'team') {
      setTeamId(newValue)
      setAgentId(null)
      setWorkflowId(null)
      const teamEntity = selectedEntity as { model?: { model?: string; provider?: string } }
      setSelectedModel(
        teamEntity?.model?.model || teamEntity?.model?.provider || ''
      )
    } else {
      setAgentId(newValue)
      setTeamId(null)
      setWorkflowId(null)
      const agentEntity = selectedEntity as { model?: { model?: string; provider?: string } }
      setSelectedModel(
        agentEntity?.model?.model || agentEntity?.model?.provider || ''
      )
    }

    setMessages([])
    setSessionId(null)
    focusChatInput()
  }

  if (currentEntities.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="h-9 w-full rounded-xl border border-primary/15 bg-primaryAccent text-xs font-medium uppercase opacity-50">
          <SelectValue placeholder={`No ${mode}s Available`} />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select
      value={currentValue || ''}
      onValueChange={(value) => handleOnValueChange(value)}
    >
      <SelectTrigger className="h-9 w-full rounded-xl border border-primary/15 bg-primaryAccent text-xs font-medium uppercase">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-none bg-primaryAccent font-dmmono shadow-lg">
        {currentEntities.map((entity, index) => (
          <SelectItem
            className="cursor-pointer"
            key={`${entity.id}-${index}`}
            value={entity.id}
          >
            <div className="flex items-center gap-3 text-xs font-medium uppercase">
              <Icon type={'user'} size="xs" />
              {entity.name || entity.id}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
