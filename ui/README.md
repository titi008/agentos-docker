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

### Authentication

- **Auth token**: entered in Settings and stored in the browser's local storage,
  sent as `Authorization: Bearer <token>`. Set `NEXT_PUBLIC_OS_SECURITY_KEY` at build
  time to provide a default token.
- **Operator identity**: `/api/auth/me` reads the Cloudflare Access email header
  (`cf-access-authenticated-user-email`) when the UI runs behind Cloudflare Zero
  Trust; otherwise it uses `DEFAULT_USER_ID` (or `default`). The id is sent as
  `X-User-Id` and scopes memories, profiles and chats.

## Structure

```text
src/
  app/                 Routes (one per page) and the /api/auth/me handler
  components/
    shell/             App shell: sidebar, phone top bar and menu, ⌘K palette, nav config
    ui/                Shared components built on the design tokens
  features/<area>/     One folder per area: chat, approvals, company, automations,
                       studio, knowledge, monitoring, settings, workspace (bootstrap queries)
  api/client.ts        Typed request helper (`useApi`) that surfaces errors as ApiError
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

## Docker

`Dockerfile` builds a standalone production image on Node 24:

```sh
docker build -t agentos-ui .
docker run -p 3000:3000 agentos-ui
```

## License

[MIT](./LICENSE)
