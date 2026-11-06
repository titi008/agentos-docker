# AgentOS UI

The operator interface for this AgentOS: chat with agents, teams and workflows,
approve paused actions, run the company backlog and wiki, manage schedules and the
job queue, build components in Studio, curate knowledge and memories, and monitor
traces, costs and evaluations.

## Stack

- Next.js 16 (App Router, Turbopack) and React 19
- Tailwind CSS 4 (CSS-first configuration in `src/app/globals.css`, no `tailwind.config`)
- TanStack Query for server state, zustand for client state, nuqs for URL state
- Radix primitives, cmdk, sonner, lucide-react
- TypeScript 6, ESLint 9 (flat config), Prettier with the Tailwind plugin

Node.js 20.9+ (24 recommended) and pnpm 12 (pinned through `packageManager`; run
`corepack enable` once).

## Getting started

```sh
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:3000. The UI connects to `http://localhost:7777` by default;
change the host and auth token under **Settings**.

### Default AgentOS host

Set `NEXT_PUBLIC_API_URL` (for example `https://agentos.example.com`) on the UI
server to choose the host every browser starts with. It is read at request time by
`/api/config`, so it works for a prebuilt image: set it on the running container,
no rebuild needed. `compose.coolify.yaml` passes `AGENTOS_URL` through it. A host an
operator saves in Settings takes precedence for that browser; **Use default** in
Settings returns to the deployment's host. Unset or invalid values fall back to
`http://localhost:7777`.

### Authentication

The UI authenticates to AgentOS in one of two ways.

#### Sign in with Cloudflare Access

Recommended for production. Cloudflare Access handles login for the UI. The UI
server checks Cloudflare's signed assertion on each request and issues a
15-minute AgentOS token (RS256) for that person; the browser keeps it in memory
and renews it. The AgentOS API verifies the token with `JWT_VERIFICATION_KEY`
and enforces Agno's per-endpoint scopes, so it runs with `RUNTIME_ENV=prd` and
no `OS_SECURITY_KEY`. The API never needs to know how people log in, so another
login method can replace Cloudflare later without changing it.

1. Run `pnpm signing-key`. It writes `.keys/agentos-ui-signing-key.pem` (secret)
   and `.keys/agentos-verification-key.pem` (public) and prints no key contents.
   Delete both files once they are stored in your deployment's settings.
2. In Cloudflare Zero Trust, open **Access → Applications**, add a self-hosted
   application for the UI's hostname, and allow the people who may use it.
   Protect the UI only, not the AgentOS API: Slack, MCP clients and the scheduler
   call the API without a browser. The UI's DNS record must be proxied through
   Cloudflare. Copy the application's **Application Audience (AUD) tag** and your
   team domain (`<team>.cloudflareaccess.com`).
3. On the UI service, set:

   | Variable | Value |
   | --- | --- |
   | `CF_ACCESS_TEAM_DOMAIN` | Your team domain, for example `yourteam.cloudflareaccess.com` |
   | `CF_ACCESS_AUD` | The application's AUD tag |
   | `AGENTOS_TOKEN_SIGNING_KEY` | The private key: the PEM file's contents, or the file base64-encoded on one line |
   | `AGENTOS_ADMIN_EMAILS` | Comma-separated emails that get `agent_os:admin` (full access, including the job queue) |
   | `AGENTOS_USER_IDS` | Optional `email=user-id` pairs that keep history stored under another id, for example `you@example.com=default` |
   | `AGENTOS_MEMBER_SCOPES` | Optional; replaces the scopes everyone else gets |

4. On the AgentOS API, set `RUNTIME_ENV=prd` and `JWT_VERIFICATION_KEY` to the
   public key (the full multiline PEM), remove `OS_SECURITY_KEY`, and redeploy
   both services.

People Cloudflare lets in who are not admins get member scopes: run, read and
edit agents, teams, workflows, chats, memories, knowledge and Company work, but
no deletes, settings, service accounts or job queue. Memories and chats are kept
per user id, and each person's id is their email exactly as Cloudflare sends it,
unless `AGENTOS_USER_IDS` maps it. A UI already behind Cloudflare Access used the
same email before sign-in, so that history carries over without a mapping. Map
an email only to keep history saved under another id, such as `default` from a
UI that ran without Access. Settings shows who is signed in and links to
Cloudflare's sign-out.
A token saved in Settings earlier is removed from the browser once sign-in is on.

To rotate the key, create a new pair, update both services and redeploy; open
tabs renew their token on the next request.

#### Auth token in Settings

Used when the variables above are not set: the token entered in Settings (for
example the server's `OS_SECURITY_KEY`) is stored in the browser and sent as
`Authorization: Bearer <token>`. `NEXT_PUBLIC_OS_SECURITY_KEY` at build time
provides a default. Suitable for local development; a security key is one shared
credential with full access, so prefer sign-in for a public deployment.

#### Operator identity

Signed-in people get their user id with the token. Otherwise `/api/auth/me` reads
the Cloudflare Access email header (`cf-access-authenticated-user-email`) or uses
`DEFAULT_USER_ID` (or `default`). The UI sends the id as `X-User-Id` with chat,
memory and profile requests; with sign-in on, the API uses the token's id instead.

## Structure

```text
src/
  app/                 Routes (one per page) and the /api/config, /api/auth/me and
                       /api/auth/token handlers
  components/
    shell/             App shell: sidebar, phone top bar and menu, ⌘K palette, nav config
    ui/                Shared components built on the design tokens
  features/<area>/     One folder per area: chat, approvals, company, automations,
                       studio, knowledge, monitoring, settings, workspace (bootstrap queries)
  api/client.ts        Typed request helper (`useApi`) that surfaces errors as ApiError
  lib/server/          Server-only code: Cloudflare Access sign-in and token issuing
  hooks/               Chat streaming hooks
  store.ts             Connection, workspace and chat state (connection is persisted)
```

Routes: `/` chat, `/approvals`, `/company/{tasks,wiki}`, `/automations/{schedules,queue}`,
`/studio/{agents,teams,workflows,registry}`, `/studio/components/<id>`,
`/knowledge/{documents,files,memories,profiles}`, `/monitoring/{traces,usage,evals}`,
`/settings`. Chat targets are deep-linkable with `?agent=`, `?team=` or `?workflow=`
plus `?session=`.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server on port 3000 |
| `pnpm build` / `pnpm start` | Production build (standalone output) and server |
| `pnpm validate` | ESLint, Prettier check and TypeScript, as CI runs them |
| `pnpm lint:fix`, `pnpm format:fix` | Apply lint and formatting fixes |
| `pnpm signing-key` | Create the key pair for Cloudflare Access sign-in |

## Docker

`Dockerfile` builds a standalone production image on Node 24:

```sh
docker build -t agentos-ui .
docker run -p 3000:3000 agentos-ui
```

## License

[MIT](./LICENSE)
