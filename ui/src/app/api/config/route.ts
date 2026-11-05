import { NextResponse } from 'next/server'

import { isValidUrl } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Environment variable with the AgentOS host this deployment points at. It is
 * looked up by a computed key on purpose: Next.js inlines literal
 * `process.env.NEXT_PUBLIC_*` reads at build time, but the image is built
 * before the deployment's environment is known.
 */
const DEFAULT_ENDPOINT_ENV = 'NEXT_PUBLIC_API_URL'

export interface RuntimeConfigResponse {
  /** Host used until the operator saves another one in Settings; null when unset. */
  default_endpoint: string | null
}

export function GET() {
  const raw = (process.env[DEFAULT_ENDPOINT_ENV] ?? '')
    .trim()
    .replace(/\/+$/, '')
  const body: RuntimeConfigResponse = {
    default_endpoint: raw && isValidUrl(raw) ? raw : null
  }
  if (raw && !body.default_endpoint) {
    console.warn(
      `${DEFAULT_ENDPOINT_ENV} is not a valid http(s) URL and was ignored: ${raw}`
    )
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
