'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            '!rounded-xl !border !border-line !bg-raised !text-fg !shadow-pop !font-sans',
          description: '!text-fg-2',
          actionButton: '!bg-accent-fill !text-white',
          cancelButton: '!bg-hover !text-fg'
        }
      }}
    />
  )
}
