'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  count?: number
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
  className?: string
  /** Stretch segments to fill the width (phones). */
  fill?: boolean
}

/** Single-choice control (radio group) with arrow-key navigation. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  fill = false,
  ...props
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={props['aria-label']}
      className={cn(
        'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[9px] border border-line bg-hover p-[3px]',
        fill && 'flex w-full',
        className
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap text-fg-2 transition-colors hover:text-fg max-md:min-h-9',
              fill && 'flex-1',
              selected && 'bg-surface text-fg shadow-sm'
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn(
                  'tabular-nums',
                  selected ? 'text-fg-2' : 'text-fg-3'
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
