'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

const floatingPanel =
  'z-50 animate-pop-in rounded-[10px] border border-line bg-raised text-fg shadow-pop'

/* Dropdown menu ---------------------------------------------------------- */

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuGroup = DropdownMenu.Group

export function MenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(floatingPanel, 'min-w-48 p-1', className)}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export function MenuItem({
  className,
  tone = 'default',
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & {
  tone?: 'default' | 'danger'
}) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover max-md:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0',
        tone === 'danger' ? 'text-bad' : 'text-fg',
        className
      )}
      {...props}
    />
  )
}

export function MenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn(
        'px-2.5 pt-2 pb-1 text-xs font-medium text-fg-3',
        className
      )}
      {...props}
    />
  )
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Separator>) {
  return (
    <DropdownMenu.Separator
      className={cn('my-1 h-px bg-line', className)}
      {...props}
    />
  )
}

/* Popover ---------------------------------------------------------------- */

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close
export const PopoverAnchor = PopoverPrimitive.Anchor

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(floatingPanel, 'p-2', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

/* Tooltip ---------------------------------------------------------------- */

export const TooltipProvider = TooltipPrimitive.Provider

/** Short hint on hover/focus. Never put essential information only here. */
export function Tooltip({
  content,
  children,
  side = 'top'
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs animate-fade-in rounded-md border border-line bg-raised px-2 py-1 text-xs text-fg shadow-pop"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
