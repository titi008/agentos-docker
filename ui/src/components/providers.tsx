'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { useState, type ReactNode } from 'react'

import { ApiError } from '@/api/client'
import { ConfirmProvider } from '@/components/ui/confirm'
import { TooltipProvider } from '@/components/ui/menu'
import { Toaster } from '@/components/ui/toaster'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // Retry network and server errors, never 4xx responses.
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false
          }
          return failureCount < 2
        }
      },
      mutations: { retry: false }
    }
  })
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      themes={['dark', 'light']}
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <TooltipProvider delayDuration={300}>
            <ConfirmProvider>{children}</ConfirmProvider>
            <Toaster />
          </TooltipProvider>
        </NuqsAdapter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
