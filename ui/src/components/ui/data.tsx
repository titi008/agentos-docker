import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-line bg-surface', className)}
      {...props}
    />
  )
}

/** Wide tables scroll sideways inside this box instead of the page. */
export function TableWrap({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-xl border border-line bg-surface',
        className
      )}
      {...props}
    />
  )
}

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <table
      className={cn(
        'w-full min-w-[720px] border-collapse text-[13px]',
        className
      )}
      {...props}
    />
  )
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap text-fg-3',
        className
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      className={cn(
        'border-b border-line px-4 py-3 align-middle [tr:last-child>&]:border-b-0',
        className
      )}
      {...props}
    />
  )
}

export function Tr({
  className,
  selected,
  ...props
}: ComponentProps<'tr'> & { selected?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-hover',
        selected && 'bg-accent-soft hover:bg-accent-soft',
        className
      )}
      aria-selected={selected || undefined}
      {...props}
    />
  )
}

export interface KeyValueItem {
  label: ReactNode
  value: ReactNode
}

/** Definition list; stacks label above value on phones. */
export function KeyValueList({
  items,
  className
}: {
  items: KeyValueItem[]
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[132px_minmax(0,1fr)]',
        className
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="contents">
          <dt className="text-fg-3 max-sm:mt-1">{item.label}</dt>
          <dd className="min-w-0 break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Stat tile used for KPIs and filter cards. */
export function Stat({
  label,
  value,
  hint,
  className
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col gap-1 p-4', className)}>
      <span className="text-[12.5px] text-fg-3">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      {hint ? <span className="text-xs text-fg-3">{hint}</span> : null}
    </Card>
  )
}
