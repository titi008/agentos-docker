'use client'

import type { ComponentProps } from 'react'

import { Select } from '@/components/ui/input'

import type { ModelOption } from './types'

function groupByProvider(models: ModelOption[]) {
  const groups = new Map<string, ModelOption[]>()
  for (const model of models) {
    const provider = model.provider || 'Other'
    groups.set(provider, [...(groups.get(provider) ?? []), model])
  }
  return [...groups.entries()]
}

interface ModelSelectProps extends Omit<
  ComponentProps<'select'>,
  'value' | 'onChange' | 'children'
> {
  models: ModelOption[]
  value: string
  onValueChange: (value: string) => void
  /** The model saved on the server; labelled "(current)" and always listed. */
  current?: string
  currentProvider?: string
}

/**
 * Model picker grouped by provider. A saved model the palette does not list
 * is still offered (and selected), never silently replaced by the first one.
 */
export function ModelSelect({
  models,
  value,
  onValueChange,
  current,
  currentProvider,
  ...props
}: ModelSelectProps) {
  const options = [...models]
  for (const [id, provider] of [
    [current, currentProvider],
    [value, undefined]
  ] as const) {
    if (id && !options.some((model) => model.id === id)) {
      options.push({ id, provider: provider || 'Not in the server list' })
    }
  }

  return (
    <Select
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      {...props}
    >
      {value ? null : (
        <option value="" disabled>
          Select a model
        </option>
      )}
      {groupByProvider(options).map(([provider, group]) => (
        <optgroup key={provider} label={provider}>
          {group.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id === current ? `${model.id} (current)` : model.id}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}
