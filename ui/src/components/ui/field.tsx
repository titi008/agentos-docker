import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Label({
  className,
  required,
  children,
  ...props
}: ComponentProps<'label'> & { required?: boolean }) {
  return (
    <label
      className={cn('text-[13px] font-medium text-fg', className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-accent" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  )
}

interface FieldProps {
  label: ReactNode
  htmlFor: string
  required?: boolean
  help?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * Label + control + help/error text. Give the control `id={htmlFor}` and
 * `aria-describedby={`${htmlFor}-help`}` when help or error is present.
 */
export function Field({
  label,
  htmlFor,
  required,
  help,
  error,
  className,
  children
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-help`} className="text-[12.5px] text-bad">
          {error}
        </p>
      ) : help ? (
        <p id={`${htmlFor}-help`} className="text-[12.5px] text-fg-3">
          {help}
        </p>
      ) : null}
    </div>
  )
}

/** Legend explaining the required-field marker; place it once per form. */
export function RequiredLegend({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-fg-3', className)}>
      <span className="text-accent" aria-hidden>
        *
      </span>{' '}
      Required
    </p>
  )
}
