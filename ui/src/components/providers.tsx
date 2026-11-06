'use client'

import {
  QueryCache,
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { useState, type ReactNode } from 'react'

import { ApiError } from '@/api/client'
import { ConfirmProvider } from '@/components/ui/confirm'
import { TooltipProvider } from '@/components/ui/menu'
import { Toaster } from '@/components/ui/toaster'
import { SESSION_TOKEN_KEY } from '@/features/workspace/queries'
import { useStore } from '@/store'

/** A 401 on a token older than this renews it; a fresh one being refused is a setup problem. */
const TOKEN_RENEW_ON_401_AFTER_MS = 60_000

function createQueryClient() {
  const client: QueryClient = new QueryClient({
    // When signed in, a 401 usually means the token expired (a laptop that slept).
    queryCache: new QueryCache({
      onError: (error) => {
        if (!(error instanceof ApiError) || error.status !== 401) return
        if (!useStore.getState().signIn) return
        const token = client.getQueryState(SESSION_TOKEN_KEY)
        if (
          token?.status === 'success' &&
          Date.now() - token.dataUpdatedAt > TOKEN_RENEW_ON_401_AFTER_MS
        ) {
          void client.invalidateQueries({ queryKey: SESSION_TOKEN_KEY })
        }
      }
    }),
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
  return client
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
