import { ChevronDown, Search } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-lg border border-line-strong bg-surface text-sm text-fg transition-colors outline-none placeholder:text-fg-3 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type ?? 'text'}
      className={cn(fieldBase, 'h-9 px-3 max-md:min-h-11', className)}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(fieldBase, 'min-h-20 resize-y px-3 py-2.5', className)}
      {...props}
    />
  )
}

/** Native select styled to match inputs; native keeps it accessible and mobile friendly. */
export function Select({
  className,
  children,
  ...props
}: ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select
        className={cn(
          fieldBase,
          'h-9 appearance-none truncate pr-9 pl-3 max-md:min-h-11'
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-3"
      />
    </div>
  )
}

/** Search input with a leading icon. Pass `aria-label` or pair it with a label. */
export function SearchInput({
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3"
      />
      <Input type="search" className="pl-9" {...props} />
    </div>
  )
}
