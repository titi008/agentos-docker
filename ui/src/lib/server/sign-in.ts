/**
 * Sign-in through Cloudflare Access. Server side only: import it from route
 * handlers, never from client components.
 *
 * Cloudflare Access puts a signed assertion on every request it lets through to
 * this UI. When the assertion checks out, this server issues a short-lived
 * AgentOS token (RS256) for that person. The AgentOS API verifies it with the
 * matching public key in JWT_VERIFICATION_KEY, so the API never needs to know
 * how people log in.
 */
import { createPrivateKey, type KeyObject } from 'node:crypto'

import { createRemoteJWKSet, errors, jwtVerify, SignJWT } from 'jose'
import type { NextRequest } from 'next/server'

/** Environment variables, read at request time (the image is built before they are known). */
export const SIGN_IN_ENV = {
  teamDomain: 'CF_ACCESS_TEAM_DOMAIN',
  audience: 'CF_ACCESS_AUD',
  signingKey: 'AGENTOS_TOKEN_SIGNING_KEY',
  adminEmails: 'AGENTOS_ADMIN_EMAILS',
  userIds: 'AGENTOS_USER_IDS',
  memberScopes: 'AGENTOS_MEMBER_SCOPES'
} as const

/** Lifetime of an issued AgentOS token. The browser renews it before it runs out. */
export const TOKEN_TTL_SECONDS = 15 * 60

const TOKEN_ISSUER = 'agentos-ui'
const TOKEN_ALGORITHM = 'RS256'
const MIN_RSA_BITS = 2048

const ADMIN_SCOPES = ['agent_os:admin'] as const

/**
 * Everyone else Cloudflare Access lets in: run, read and edit, like Agno's
 * Member role, but no deletes, settings, service accounts or job queue.
 */
const DEFAULT_MEMBER_SCOPES = [
  'config:read',
  'system:read',
  'registry:read',
  'filesystem:read',
  'traces:read',
  'metrics:read',
  ...['agents', 'teams', 'workflows'].flatMap((resource) => [
    `${resource}:read`,
    `${resource}:run`,
    `${resource}:write`
  ]),
  ...[
    'sessions',
    'memories',
    'learnings',
    'knowledge',
    'components',
    'approvals',
    'schedules',
    'evals',
    'products',
    'projects',
    'tasks',
    'routines',
    'wiki',
    'decisions',
    'sources'
  ].flatMap((resource) => [`${resource}:read`, `${resource}:write`])
] as const

/** Subjects AgentOS keeps for its own identities and rejects in a JWT. */
const isReservedSubject = (subject: string) =>
  subject.startsWith('sa:') ||
  subject.startsWith('__oauth__:') ||
  subject === '__scheduler__'

export interface AccessSignIn {
  /** Cloudflare Access team origin, e.g. https://yourteam.cloudflareaccess.com */
  teamDomain: string
  /** Application Audience (AUD) tag of the Access application. */
  audience: string
  signingKey: KeyObject
  adminEmails: ReadonlySet<string>
  /** Email → AgentOS user id, for people whose history is stored under another id. */
  userIds: ReadonlyMap<string, string>
  memberScopes: readonly string[]
}

export type SignInSetup =
  | { status: 'off' }
  | { status: 'on'; signIn: AccessSignIn }
  | { status: 'error'; error: string }

export interface SignedInPerson {
  email: string
  userId: string
  isAdmin: boolean
}

/** A request that can't be signed in; `status` is the HTTP status to answer with. */
export class SignInError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SignInError'
    this.status = status
  }
}

const readEnv = (name: string) => (process.env[name] ?? '').trim()

const splitList = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeEmail = (email: string) => email.trim().toLowerCase()

function parseTeamDomain(value: string): string | null {
  const withScheme = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  // Plain http is only accepted for a local stand-in during tests.
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    return null
  }
  if (url.pathname !== '/' || url.search || url.hash) return null
  return url.origin
}

/** Accepts PEM, PEM with literal "\n" escapes, or base64-encoded PEM. */
function parseSigningKey(value: string): KeyObject | null {
  let pem = value.replace(/\\n/g, '\n')
  if (!pem.includes('-----BEGIN')) {
    pem = Buffer.from(pem, 'base64').toString('utf8')
  }
  try {
    const key = createPrivateKey(pem)
    const bits = key.asymmetricKeyDetails?.modulusLength ?? 0
    return key.asymmetricKeyType === 'rsa' && bits >= MIN_RSA_BITS ? key : null
  } catch {
    return null
  }
}

function parseUserIds(value: string): Map<string, string> | string {
  const userIds = new Map<string, string>()
  for (const entry of splitList(value)) {
    const separator = entry.lastIndexOf('=')
    const email = normalizeEmail(entry.slice(0, separator))
    const userId = entry.slice(separator + 1).trim()
    if (separator <= 0 || !email.includes('@') || !userId) {
      return `${SIGN_IN_ENV.userIds} entries must look like person@example.com=user-id.`
    }
    if (isReservedSubject(userId)) {
      return `${SIGN_IN_ENV.userIds} can't map to "${userId}": AgentOS reserves that user id.`
    }
    userIds.set(email, userId)
  }
  return userIds
}

function readSignInSetup(): SignInSetup {
  const teamDomainValue = readEnv(SIGN_IN_ENV.teamDomain)
  const audience = readEnv(SIGN_IN_ENV.audience)
  const signingKeyValue = readEnv(SIGN_IN_ENV.signingKey)

  const required: [string, string][] = [
    [SIGN_IN_ENV.teamDomain, teamDomainValue],
    [SIGN_IN_ENV.audience, audience],
    [SIGN_IN_ENV.signingKey, signingKeyValue]
  ]
  if (required.every(([, value]) => !value)) return { status: 'off' }

  const missing = required.filter(([, value]) => !value).map(([name]) => name)
  if (missing.length > 0) {
    return {
      status: 'error',
      error: `Cloudflare Access sign-in also needs ${missing.join(' and ')}.`
    }
  }

  const teamDomain = parseTeamDomain(teamDomainValue)
  if (!teamDomain) {
    return {
      status: 'error',
      error: `${SIGN_IN_ENV.teamDomain} must be your team domain, for example yourteam.cloudflareaccess.com.`
    }
  }

  const signingKey = parseSigningKey(signingKeyValue)
  if (!signingKey) {
    return {
      status: 'error',
      error: `${SIGN_IN_ENV.signingKey} must be an RSA private key (${MIN_RSA_BITS} bits or more) in PEM format.`
    }
  }

  const userIds = parseUserIds(readEnv(SIGN_IN_ENV.userIds))
  if (typeof userIds === 'string') return { status: 'error', error: userIds }

  const memberScopes = splitList(readEnv(SIGN_IN_ENV.memberScopes))

  return {
    status: 'on',
    signIn: {
      teamDomain,
      audience,
      signingKey,
      adminEmails: new Set(
        splitList(readEnv(SIGN_IN_ENV.adminEmails)).map(normalizeEmail)
      ),
      userIds,
      memberScopes:
        memberScopes.length > 0 ? memberScopes : [...DEFAULT_MEMBER_SCOPES]
    }
  }
}

let cachedSetup: SignInSetup | undefined

/** The sign-in configuration; environment variables don't change while the server runs. */
export function getSignInSetup(): SignInSetup {
  if (!cachedSetup) {
    cachedSetup = readSignInSetup()
    if (cachedSetup.status === 'error') console.warn(cachedSetup.error)
  }
  return cachedSetup
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

/** Cloudflare's signing keys for the team, cached and refreshed by jose. */
function accessKeys(teamDomain: string) {
  let keySet = keySets.get(teamDomain)
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', teamDomain), {
      timeoutDuration: 5000
    })
    keySets.set(teamDomain, keySet)
  }
  return keySet
}

/** Checks the Cloudflare Access assertion on the request and returns who it belongs to. */
export async function identifyRequest(
  signIn: AccessSignIn,
  request: NextRequest
): Promise<SignedInPerson> {
  const assertion =
    request.headers.get('cf-access-jwt-assertion') ??
    request.cookies.get('CF_Authorization')?.value
  if (!assertion) {
    throw new SignInError(
      401,
      'This request has no Cloudflare Access sign-in. Open the UI through its Cloudflare Access address.'
    )
  }

  let email: unknown
  try {
    const { payload } = await jwtVerify(
      assertion,
      accessKeys(signIn.teamDomain),
      {
        issuer: signIn.teamDomain,
        audience: signIn.audience,
        algorithms: ['RS256']
      }
    )
    email = payload.email
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new SignInError(401, 'Your Cloudflare Access sign-in has ended.')
    }
    if (
      error instanceof errors.JWKSTimeout ||
      !(error instanceof errors.JOSEError)
    ) {
      console.warn('Could not load the Cloudflare Access signing keys', error)
      throw new SignInError(
        503,
        "Couldn't reach Cloudflare to check your sign-in. Try again in a moment."
      )
    }
    console.warn(`Rejected a Cloudflare Access assertion (${error.code})`)
    throw new SignInError(
      401,
      "This Cloudflare Access sign-in isn't valid for this UI."
    )
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    throw new SignInError(
      403,
      'This sign-in has no email address (for example a Cloudflare service token), so it cannot use the UI.'
    )
  }

  // Lookups ignore case. The default user id keeps the email exactly as
  // Cloudflare sends it, as the cf-access-authenticated-user-email header did
  // before sign-in, so chats and memories saved under it stay with the person.
  const normalized = normalizeEmail(email)
  return {
    email: normalized,
    userId: signIn.userIds.get(normalized) ?? email.trim(),
    isAdmin: signIn.adminEmails.has(normalized)
  }
}

/** Issues the AgentOS token for a signed-in person. */
export async function issueAgentOSToken(
  signIn: AccessSignIn,
  person: SignedInPerson
): Promise<{ token: string; expiresAt: number }> {
  if (isReservedSubject(person.userId)) {
    throw new SignInError(
      403,
      `AgentOS reserves the user id "${person.userId}", so this person can't sign in with it.`
    )
  }
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS
  const token = await new SignJWT({
    scopes: person.isAdmin ? [...ADMIN_SCOPES] : [...signIn.memberScopes],
    email: person.email
  })
    .setProtectedHeader({ alg: TOKEN_ALGORITHM, typ: 'JWT' })
    .setSubject(person.userId)
    .setIssuer(TOKEN_ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(signIn.signingKey)
  return { token, expiresAt }
}
