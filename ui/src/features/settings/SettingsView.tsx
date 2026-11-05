'use client'

import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { apiRequest, getErrorMessage, normalizeEndpoint } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/data'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageBody, PageHeader, PageScroll } from '@/components/ui/page'
import { SegmentedControl } from '@/components/ui/segmented'
import { useIdentityQuery } from '@/features/workspace/queries'
import { isValidUrl } from '@/lib/utils'
import { DEFAULT_ENDPOINT, useStore } from '@/store'

import packageJson from '../../../package.json'

function Section({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-[13px] text-fg-3">{description}</p>
      </div>
      {children}
    </Card>
  )
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' }
  | { status: 'error'; message: string }

function ConnectionSection() {
  const router = useRouter()
  const endpoint = useStore((state) => state.selectedEndpoint)
  const endpointIsCustom = useStore((state) => state.endpointIsCustom)
  const serverDefault = useStore((state) => state.serverDefaultEndpoint)
  const saveEndpoint = useStore((state) => state.saveEndpoint)
  const resetEndpoint = useStore((state) => state.resetEndpoint)
  const authToken = useStore((state) => state.authToken)
  const active = useStore((state) => state.isEndpointActive)
  const loading = useStore((state) => state.isEndpointLoading)
  const setMessages = useStore((state) => state.setMessages)
  const setSessionsData = useStore((state) => state.setSessionsData)
  const setSelectedModel = useStore((state) => state.setSelectedModel)

  const [draft, setDraft] = useState(endpoint)
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState<TestState>({ status: 'idle' })

  const validate = (): string | null => {
    const value = normalizeEndpoint(draft)
    if (!isValidUrl(value)) {
      setError('Enter a full URL, for example http://localhost:7777')
      return null
    }
    setError(null)
    return value
  }

  const runTest = async () => {
    const value = validate()
    if (!value) return
    setTest({ status: 'testing' })
    try {
      await apiRequest({ endpoint: value, authToken, userId: '' }, '/health', {
        withUser: false
      })
      setTest({ status: 'ok' })
    } catch (err) {
      setTest({ status: 'error', message: getErrorMessage(err, value) })
    }
  }

  /** Clears state that belongs to the previous host. */
  const switchHost = (message: string) => {
    setMessages([])
    setSessionsData(null)
    setSelectedModel('')
    setTest({ status: 'idle' })
    router.replace('/settings')
    toast.success(message)
  }

  const save = () => {
    const value = validate()
    if (!value) return
    if (value === normalizeEndpoint(endpoint)) {
      toast.success('Host unchanged')
      return
    }
    saveEndpoint(value)
    switchHost('Host saved. Reloading agents, teams and workflows.')
  }

  const switchToDefault = () => {
    resetEndpoint()
    switchHost('Using the default host. Reloading agents, teams and workflows.')
  }

  const defaultHost = serverDefault ?? DEFAULT_ENDPOINT
  const usingDefault =
    !endpointIsCustom ||
    normalizeEndpoint(endpoint) === normalizeEndpoint(defaultHost)

  const status = loading ? 'Connecting' : active ? 'Connected' : 'Offline'

  return (
    <Section
      title="Connection"
      description="The AgentOS server this UI talks to."
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
        noValidate
      >
        <Field
          label={
            <span className="flex items-center gap-2">
              AgentOS host
              <Badge tone={loading ? 'warn' : active ? 'ok' : 'bad'} dot>
                {status}
              </Badge>
            </span>
          }
          htmlFor="endpoint"
          error={error}
          help={
            <>
              {serverDefault ? (
                <>
                  Default for this deployment:{' '}
                  <span className="font-mono">{serverDefault}</span> (from
                  NEXT_PUBLIC_API_URL).{' '}
                </>
              ) : null}
              Changing the host clears the open chat and reloads agents, teams
              and workflows.
            </>
          }
        >
          <Input
            id="endpoint"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={draft}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby="endpoint-help"
            onChange={(event) => {
              setDraft(event.target.value)
              setTest({ status: 'idle' })
            }}
            className="font-mono text-[13px]"
          />
        </Field>
        {test.status === 'ok' ? (
          <p role="status" className="text-[13px] text-ok">
            The server responded. Save to switch to it.
          </p>
        ) : test.status === 'error' ? (
          <p role="alert" className="text-[13px] text-bad">
            {test.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={runTest} loading={test.status === 'testing'}>
            Test connection
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
          {usingDefault ? null : (
            <Button variant="ghost" onClick={switchToDefault}>
              Use default ({defaultHost})
            </Button>
          )}
        </div>
      </form>
    </Section>
  )
}

function TokenSection() {
  const authToken = useStore((state) => state.authToken)
  const setAuthToken = useStore((state) => state.setAuthToken)
  const [draft, setDraft] = useState(authToken)
  const [visible, setVisible] = useState(false)
  const hasEnvToken = Boolean(process.env.NEXT_PUBLIC_OS_SECURITY_KEY)

  return (
    <Section
      title="Auth token"
      description="Sent as a Bearer token with every request to AgentOS."
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setAuthToken(draft.trim())
          toast.success(draft.trim() ? 'Token saved' : 'Token cleared')
        }}
      >
        <Field
          label="Token"
          htmlFor="auth-token"
          help={
            hasEnvToken
              ? 'A token from NEXT_PUBLIC_OS_SECURITY_KEY is used when none is saved here.'
              : 'Leave empty when the server runs without authorization. NEXT_PUBLIC_OS_SECURITY_KEY can supply one at build time.'
          }
        >
          <div className="flex gap-2">
            <Input
              id="auth-token"
              type={visible ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={draft}
              placeholder="No token set"
              aria-describedby="auth-token-help"
              onChange={(event) => setDraft(event.target.value)}
              className="font-mono text-[13px]"
            />
            <Button
              variant="secondary"
              size="icon"
              aria-label={visible ? 'Hide token' : 'Show token'}
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            disabled={!authToken && !draft}
            onClick={() => {
              setDraft('')
              setAuthToken('')
              toast.success('Token cleared')
            }}
          >
            Clear
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={draft === authToken}
          >
            Save token
          </Button>
        </div>
      </form>
    </Section>
  )
}

function IdentitySection() {
  const userId = useStore((state) => state.userId)
  const identity = useIdentityQuery()
  const zeroTrust = identity.data?.is_authenticated ?? false

  return (
    <Section
      title="Operator identity"
      description="Who you are when talking to agents. Memories, profiles and chats are kept per user."
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-hover font-semibold uppercase">
          {userId.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-[13px] break-all">{userId}</span>
          <span className="text-xs text-fg-3">User id</span>
        </div>
        <Badge tone={zeroTrust ? 'ok' : 'neutral'}>
          {zeroTrust ? (
            <>
              <ShieldCheck aria-hidden className="size-3.5" />
              Zero Trust
            </>
          ) : (
            'Local user'
          )}
        </Badge>
      </div>
      <p className="text-[13px] text-fg-3">
        {zeroTrust
          ? 'Signed in through Cloudflare Access. Your email is your user id.'
          : identity.isError
            ? "Couldn't check your sign-in, so the default user id is used."
            : 'No Cloudflare Access sign-in was found, so the server’s DEFAULT_USER_ID (or "default") is used.'}
      </p>
    </Section>
  )
}

const subscribeNoop = () => () => {}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  // next-themes only knows the theme after mount.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
  const value = (mounted ? theme : 'dark') as 'dark' | 'light' | 'system'

  return (
    <Section
      title="Appearance"
      description="Choose how AgentOS looks on this device."
    >
      <SegmentedControl
        aria-label="Theme"
        value={value ?? 'dark'}
        onChange={setTheme}
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
          { value: 'system', label: 'System' }
        ]}
      />
    </Section>
  )
}

export function SettingsView() {
  const endpoint = useStore((state) => state.selectedEndpoint)
  const authToken = useStore((state) => state.authToken)

  return (
    <>
      <PageHeader
        title="Settings"
        description="Connection, identity and appearance."
      />
      <PageScroll>
        <PageBody className="max-w-3xl">
          {/* Keys reset the drafts when the saved values change. */}
          <ConnectionSection key={`endpoint-${endpoint}`} />
          <TokenSection key={`token-${authToken}`} />
          <IdentitySection />
          <AppearanceSection />
          <p className="text-xs text-fg-3">AgentOS UI v{packageJson.version}</p>
        </PageBody>
      </PageScroll>
    </>
  )
}
