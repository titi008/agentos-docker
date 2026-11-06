'use client'

import { LogIn, ShieldExclamationPoint, WifiOff } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  SignInRequiredError,
  useHealthQuery,
  useRuntimeConfigQuery,
  useSessionTokenQuery
} from '@/features/workspace/queries'
import { useStore } from '@/store'

function Banner({
  icon,
  message,
  children
}: {
  icon: ReactNode
  message: ReactNode
  children?: ReactNode
}) {
  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-bad/40 bg-bad-soft px-4 py-2.5 text-[13px] md:px-6 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-bad"
    >
      {icon}
      <p className="min-w-0 flex-1 text-fg">{message}</p>
      {children ? <div className="flex gap-2">{children}</div> : null}
    </div>
  )
}

/** Shown above every page while signing in fails or the AgentOS server can't be reached. */
export function ConnectionBanner() {
  const health = useHealthQuery()
  const config = useRuntimeConfigQuery()
  const signIn = useStore((state) => state.signIn)
  const token = useSessionTokenQuery(signIn === 'cloudflare_access')
  const endpoint = useStore((state) => state.selectedEndpoint)

  const signInError = config.data?.sign_in_error
  if (signInError) {
    return (
      <Banner
        icon={<ShieldExclamationPoint aria-hidden />}
        message={`Sign-in isn't set up correctly on the UI server. ${signInError}`}
      />
    )
  }

  if (signIn && token.error instanceof SignInRequiredError) {
    return (
      <Banner icon={<LogIn aria-hidden />} message={token.error.message}>
        {/* A full page load goes through Cloudflare Access, which shows its login. */}
        <Button size="sm" onClick={() => window.location.reload()}>
          Sign in again
        </Button>
      </Banner>
    )
  }

  if (signIn && token.isError && !token.data) {
    return (
      <Banner
        icon={<ShieldExclamationPoint aria-hidden />}
        message={token.error.message}
      >
        <Button
          size="sm"
          onClick={() => token.refetch()}
          loading={token.isFetching}
        >
          Retry
        </Button>
      </Banner>
    )
  }

  if (health.status !== 'error') return null

  return (
    <Banner
      icon={<WifiOff aria-hidden />}
      message={getErrorMessage(health.error, endpoint)}
    >
      <Button
        size="sm"
        onClick={() => health.refetch()}
        loading={health.isFetching}
      >
        Retry
      </Button>
      <Button size="sm" variant="ghost" asChild>
        <Link href="/settings">Settings</Link>
      </Button>
    </Banner>
  )
}
