import { NextResponse } from 'next/server'

import { getSignInSetup } from '@/lib/server/sign-in'
import { isValidUrl } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Environment variable with the AgentOS host this deployment points at. It is
 * looked up by a computed key on purpose: Next.js inlines literal
 * `process.env.NEXT_PUBLIC_*` reads at build time, but the image is built
 * before the deployment's environment is known.
 */
const DEFAULT_ENDPOINT_ENV = 'NEXT_PUBLIC_API_URL'

export type SignInMode = 'cloudflare_access'

export interface RuntimeConfigResponse {
  /** Host used until the operator saves another one in Settings; null when unset. */
  default_endpoint: string | null
  /** How people sign in; null when the auth token is entered in Settings. */
  sign_in: SignInMode | null
  /** Why sign-in is configured but unusable (names the variables, never their values). */
  sign_in_error: string | null
}

export function GET() {
  const raw = (process.env[DEFAULT_ENDPOINT_ENV] ?? '')
    .trim()
    .replace(/\/+$/, '')
  const defaultEndpoint = raw && isValidUrl(raw) ? raw : null
  if (raw && !defaultEndpoint) {
    console.warn(
      `${DEFAULT_ENDPOINT_ENV} is not a valid http(s) URL and was ignored: ${raw}`
    )
  }

  const signIn = getSignInSetup()
  const body: RuntimeConfigResponse = {
    default_endpoint: defaultEndpoint,
    sign_in: signIn.status === 'on' ? 'cloudflare_access' : null,
    sign_in_error: signIn.status === 'error' ? signIn.error : null
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
