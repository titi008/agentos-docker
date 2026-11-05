'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ChecklistOption {
  value: string
  label: ReactNode
  description?: ReactNode
  badge?: ReactNode
  disabled?: boolean
}

interface ChecklistProps {
  /** Id of the element that labels the group. */
  labelledBy: string
  describedBy?: string
  options: ChecklistOption[]
  selected: string[]
  onToggle: (value: string, checked: boolean) => void
  /** Shown when `options` is empty (e.g. nothing matches the search). */
  emptyText: ReactNode
  invalid?: boolean
  className?: string
}

/** Scrollable list of checkboxes, each with a label, description and badge. */
export function Checklist({
  labelledBy,
  describedBy,
  options,
  selected,
  onToggle,
  emptyText,
  invalid = false,
  className
}: ChecklistProps) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(
        'max-h-60 overflow-y-auto rounded-[10px] border bg-surface',
        invalid ? 'border-bad' : 'border-line-strong',
        className
      )}
    >
      {options.length === 0 ? (
        <p className="px-3 py-6 text-center text-[13px] text-fg-3">
          {emptyText}
        </p>
      ) : (
        options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-start gap-2.5 border-t border-line px-3 py-2.5 first:border-t-0 max-md:min-h-11',
              option.disabled
                ? 'cursor-not-allowed opacity-60'
                : 'cursor-pointer hover:bg-hover'
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-accent-fill"
              checked={selected.includes(option.value)}
              disabled={option.disabled}
              onChange={(event) => onToggle(option.value, event.target.checked)}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13.5px] text-fg">
                {option.label}
              </span>
              {option.description ? (
                <span className="truncate text-[12.5px] text-fg-3">
                  {option.description}
                </span>
              ) : null}
            </span>
            {option.badge}
          </label>
        ))
      )}
    </div>
  )
}
