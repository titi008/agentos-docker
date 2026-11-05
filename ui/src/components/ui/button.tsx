import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-medium whitespace-nowrap transition-colors',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    'max-md:min-h-11'
  ],
  {
    variants: {
      variant: {
        primary:
          'border-accent-fill bg-accent-fill text-white hover:brightness-110',
        secondary: 'border-line-strong bg-surface text-fg hover:bg-hover',
        ghost:
          'border-transparent bg-transparent text-fg-2 hover:bg-hover hover:text-fg',
        danger: 'border-line-strong bg-surface text-bad hover:bg-bad-soft',
        destructive:
          'border-bad-fill bg-bad-fill text-white hover:brightness-110'
      },
      size: {
        sm: 'h-8 px-2.5 text-[12.5px] [&_svg]:size-3.5',
        md: 'h-9 px-3.5 text-[13.5px] [&_svg]:size-4',
        icon: 'size-9 p-0 max-md:min-w-11 [&_svg]:size-4',
        'icon-sm': 'size-8 p-0 max-md:min-w-11 [&_svg]:size-4'
      }
    },
    defaultVariants: { variant: 'secondary', size: 'md' }
  }
)

export interface ButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Shows a spinner, disables the button and keeps its width stable. */
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className)
  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
}
