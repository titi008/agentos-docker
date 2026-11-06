import { NextResponse, type NextRequest } from 'next/server'

import {
  getSignInSetup,
  identifyRequest,
  SignInError
} from '@/lib/server/sign-in'

export const dynamic = 'force-dynamic'

export interface OperatorIdentityResponse {
  user_id: string
  /** Set when the person signed in through Cloudflare Access. */
  email: string | null
  is_admin: boolean
  is_authenticated: boolean
  /**
   * cloudflare_access: verified sign-in, this UI issues the AgentOS tokens.
   * cloudflare_zero_trust: Cloudflare's email header, not verified (token entered in Settings).
   * default: DEFAULT_USER_ID, or "default".
   */
  source: 'cloudflare_access' | 'cloudflare_zero_trust' | 'default'
}

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest) {
  const setup = getSignInSetup()

  if (setup.status === 'error') {
    return NextResponse.json(
      { detail: setup.error },
      { status: 500, headers: noStore }
    )
  }

  if (setup.status === 'on') {
    try {
      const person = await identifyRequest(setup.signIn, request)
      const body: OperatorIdentityResponse = {
        user_id: person.userId,
        email: person.email,
        is_admin: person.isAdmin,
        is_authenticated: true,
        source: 'cloudflare_access'
      }
      return NextResponse.json(body, { headers: noStore })
    } catch (error) {
      if (error instanceof SignInError) {
        return NextResponse.json(
          { detail: error.message },
          { status: error.status, headers: noStore }
        )
      }
      throw error
    }
  }

  // No sign-in configured: the token comes from Settings, so this id is only a label.
  const cfEmail = request.headers
    .get('cf-access-authenticated-user-email')
    ?.trim()
  const body: OperatorIdentityResponse = {
    user_id: cfEmail || process.env.DEFAULT_USER_ID || 'default',
    email: cfEmail || null,
    is_admin: false,
    is_authenticated: Boolean(cfEmail),
    source: cfEmail ? 'cloudflare_zero_trust' : 'default'
  }
  return NextResponse.json(body, { headers: noStore })
}
