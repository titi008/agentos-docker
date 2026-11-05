import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

interface SwitchProps extends Omit<
  ComponentProps<'button'>,
  'onChange' | 'role'
> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** Accessible on/off switch. Always pair it with a visible label or `aria-label`. */
export function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent-fill' : 'bg-line-strong',
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-[3px] size-3.5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-3.5'
        )}
      />
    </button>
  )
}
