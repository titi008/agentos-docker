import { NextResponse, type NextRequest } from 'next/server'

import {
  getSignInSetup,
  identifyRequest,
  issueAgentOSToken,
  SignInError
} from '@/lib/server/sign-in'

export const dynamic = 'force-dynamic'

export interface SessionTokenResponse {
  /** Bearer token for the AgentOS API. */
  token: string
  /** Expiry, in seconds since the epoch. */
  expires_at: number
  user_id: string
  email: string
  is_admin: boolean
}

const noStore = { 'Cache-Control': 'no-store' }

const fail = (status: number, detail: string) =>
  NextResponse.json({ detail }, { status, headers: noStore })

/** Issues a short-lived AgentOS token to the person Cloudflare Access signed in. */
export async function GET(request: NextRequest) {
  const setup = getSignInSetup()
  if (setup.status === 'off') {
    return fail(404, 'Sign-in is not configured on this UI server.')
  }
  if (setup.status === 'error') return fail(500, setup.error)

  try {
    const person = await identifyRequest(setup.signIn, request)
    const { token, expiresAt } = await issueAgentOSToken(setup.signIn, person)
    const body: SessionTokenResponse = {
      token,
      expires_at: expiresAt,
      user_id: person.userId,
      email: person.email,
      is_admin: person.isAdmin
    }
    return NextResponse.json(body, { headers: noStore })
  } catch (error) {
    if (error instanceof SignInError) return fail(error.status, error.message)
    throw error
  }
}
