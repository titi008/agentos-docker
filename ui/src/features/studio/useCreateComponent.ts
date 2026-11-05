'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { getErrorMessage, useApi } from '@/api/client'

import { capitalize, componentHref, KIND_LABEL } from './lib'
import { useInvalidateStudio } from './queries'
import type { StudioComponent, StudioKind } from './types'

/** Body of `POST /components` (`ComponentCreate`). */
export interface ComponentCreateBody {
  name: string
  component_type: StudioKind
  description?: string
  stage: 'published'
  config: Record<string, unknown>
}

/**
 * Creates a Studio component and publishes it as version 1. The toast offers
 * to open the new component's page.
 */
export function useCreateComponent(kind: StudioKind) {
  const api = useApi()
  const router = useRouter()
  const invalidate = useInvalidateStudio()
  const noun = KIND_LABEL[kind].one

  return useMutation({
    mutationFn: (body: ComponentCreateBody) =>
      api.request<StudioComponent>('/components', {
        method: 'POST',
        json: body
      }),
    onSuccess: (component) => {
      toast.success(`${capitalize(noun)} created`, {
        description: component.name ?? component.component_id,
        action: {
          label: 'Open',
          onClick: () => router.push(componentHref(component.component_id))
        }
      })
      return invalidate()
    },
    onError: (error) =>
      toast.error(`Couldn't create the ${noun}`, {
        description: getErrorMessage(error, api.ctx.endpoint)
      })
  })
}
