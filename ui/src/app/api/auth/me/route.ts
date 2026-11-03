import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const headerList = await headers()
  const cfEmail = headerList.get('cf-access-authenticated-user-email')
  const defaultUser = process.env.DEFAULT_USER_ID || 'default'

  const userId = cfEmail?.trim() || defaultUser

  return NextResponse.json({
    user_id: userId,
    is_authenticated: Boolean(cfEmail),
    source: cfEmail ? 'cloudflare_zero_trust' : 'default'
  })
}
