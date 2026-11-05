import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-muted-soft text-fg-2',
        ok: 'bg-ok-soft text-ok',
        warn: 'bg-warn-soft text-warn',
        bad: 'bg-bad-soft text-bad',
        info: 'bg-info-soft text-info',
        accent: 'bg-accent-soft text-accent'
      }
    },
    defaultVariants: { tone: 'neutral' }
  }
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export interface BadgeProps
  extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  /** Prefix a status dot in the badge colour. */
  dot?: boolean
}

export function Badge({
  className,
  tone,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  )
}

/** Small bordered chip for metadata such as file names, projects or tools. */
export function Chip({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] max-w-full shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12.5px] whitespace-nowrap text-fg-2 [&_svg]:size-3.5 [&_svg]:shrink-0',
        className
      )}
      {...props}
    />
  )
}
