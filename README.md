# Framelink

HTML prototype review tool — upload an HTML file, get a shareable link, drop numbered comment bubbles directly on the design. Built for design-to-developer handoff without needing a Figma license or a screen-share call.

**Live:** https://framelinkreview.vercel.app

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Environment variables](#environment-variables)
- [Dev commands](#dev-commands)
- [Database](#database)
- [API layer](#api-layer)
- [Adding a new feature (PR guide)](#adding-a-new-feature-pr-guide)
- [Frontend conventions](#frontend-conventions)
- [Architecture decisions](#architecture-decisions)
- [Deployment](#deployment)
- [Gotchas](#gotchas)

---

## Prerequisites

- **Node.js 24+**
- **pnpm 10+** (`npm i -g pnpm`)
- A **PostgreSQL** database (local or remote — Neon, Railway, etc.)

---

## Local setup

```bash
# 1. Clone and install
git clone https://github.com/stephin007/claude-html-rendering
cd claude-html-rendering
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET, etc. (see Environment variables below)

# 3. Push the DB schema
pnpm run db:push

# 4. Create the session table (connect-pg-simple requires this manually)
# Run this SQL against your database once:
# CREATE TABLE IF NOT EXISTS "session" (
#   "sid" varchar NOT NULL COLLATE "default",
#   "sess" json NOT NULL,
#   "expire" timestamp(6) NOT NULL,
#   PRIMARY KEY ("sid")
# );
# CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

# 5. Start both servers
pnpm run dev:api   # API on http://localhost:8080
pnpm run dev:web   # Frontend on http://localhost:5173
```

---

## Project structure

```
/
├── api/                        # Vercel serverless function entry point
│   └── index.ts                # Re-exports Express app for Vercel
├── artifacts/
│   ├── api-server/             # Express API server
│   │   ├── src/
│   │   │   ├── app.ts          # Express app setup (middleware, session, CORS)
│   │   │   ├── index.ts        # Standalone server entry (dev / self-hosted)
│   │   │   ├── routes/
│   │   │   │   ├── index.ts    # Route aggregator
│   │   │   │   ├── auth.ts     # POST /auth/register, /auth/login, /auth/logout, GET /auth/me
│   │   │   │   ├── prototypes.ts  # All /projects, /prototypes, /comments routes
│   │   │   │   └── health.ts   # GET /healthz
│   │   │   ├── middlewares/
│   │   │   │   └── requireAuth.ts
│   │   │   └── lib/
│   │   │       ├── analytics.ts   # OpenPanel server-side SDK instance
│   │   │       ├── logger.ts      # Pino logger
│   │   │       └── thumbnail.ts   # Playwright screenshot helper
│   │   ├── build.mjs           # esbuild bundler config
│   │   └── tsconfig.json
│   ├── framelink/              # React frontend (Vite)
│   │   └── src/
│   │       ├── main.tsx        # App entry — initialises OpenPanel
│   │       ├── App.tsx         # Router + auth gate
│   │       ├── pages/
│   │       │   ├── Landing.tsx       # / (unauthenticated)
│   │       │   ├── Home.tsx          # / (authenticated) — upload + recent files
│   │       │   ├── ProjectDetail.tsx # /project/:id
│   │       │   ├── View.tsx          # /view/:id — iframe + comment overlay
│   │       │   ├── SignIn.tsx        # /sign-in
│   │       │   ├── SignUp.tsx        # /sign-up
│   │       │   └── not-found.tsx     # 404
│   │       ├── context/
│   │       │   └── AuthContext.tsx   # Auth state (user, isLoading, signOut, refetch)
│   │       ├── hooks/
│   │       │   ├── useAuth.ts        # Fetches /api/auth/me, handles signOut
│   │       │   ├── useTitle.ts       # document.title helper
│   │       │   ├── use-mobile.tsx    # Breakpoint detection
│   │       │   └── use-toast.ts      # Toast notifications
│   │       ├── components/ui/        # shadcn/ui component library (57 components)
│   │       └── lib/
│   │           ├── analytics.ts      # OpenPanel browser SDK instance
│   │           └── utils.ts          # cn() classname helper
│   └── mockup-sandbox/         # Isolated sandbox for mockup experiments (not deployed)
├── lib/
│   ├── db/                     # Drizzle ORM — schema, pool, migrations
│   │   └── src/
│   │       ├── schema/
│   │       │   └── prototypes.ts  # All table definitions + Zod insert schemas
│   │       └── index.ts           # Exports: db, pool, all table refs
│   ├── api-spec/               # OpenAPI 3.1 spec + Orval codegen config
│   │   └── openapi.yaml
│   ├── api-zod/                # Generated Zod schemas (from openapi.yaml)
│   │   └── src/generated/
│   ├── api-client-react/       # Generated React Query hooks (from openapi.yaml)
│   │   └── src/generated/
│   └── scripts/                # Utility scripts
├── vercel.json                 # Vercel build config
├── pnpm-workspace.yaml         # Workspace + dependency catalog
└── tsconfig.base.json          # Shared TS config (moduleResolution: bundler)
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 24, TypeScript 5.9 |
| Package manager | pnpm 10 (workspaces) |
| API | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 (`zod/v4`), `drizzle-zod` |
| Sessions | `express-session` + `connect-pg-simple` (stored in Postgres) |
| Auth | Email/password, bcryptjs (cost 12) |
| API contract | OpenAPI 3.1 → Orval codegen → typed hooks + Zod schemas |
| Frontend build | Vite 7 + `@vitejs/plugin-react`, TailwindCSS 4 |
| Frontend router | wouter |
| Data fetching | TanStack Query 5 |
| UI components | shadcn/ui (Radix primitives) |
| API bundle | esbuild (ESM bundle for Vercel, standalone `index.mjs`) |
| Analytics | OpenPanel (`@openpanel/web` + `@openpanel/sdk`) |
| Logging | Pino + pino-http |
| Rate limiting | `express-rate-limit` |
| Deployment | Vercel (Vite framework, Fluid Compute for the API) |

---

## Environment variables

Copy `.env.example` → `.env` and fill in every value.

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | API server, db push | PostgreSQL connection string (pooled, e.g. Neon pooler URL) |
| `SESSION_SECRET` | API server | Random 64-byte hex string. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ALLOWED_ORIGINS` | API server | Comma-separated list of allowed CORS origins, e.g. `http://localhost:5173,https://framelinkreview.vercel.app` |
| `VITE_OPENPANEL_CLIENT_ID` | Frontend | OpenPanel public client ID (safe to expose in browser) |
| `OPENPANEL_CLIENT_ID` | API server | Same client ID, server-side reference |
| `OPENPANEL_CLIENT_SECRET` | API server | OpenPanel client secret — never expose to the browser |
| `NODE_ENV` | API server | `development` locally, `production` on Vercel (set automatically) |
| `PORT` | API server | Port for standalone server (default: 8080) |
| `API_PORT` | Frontend dev proxy | Port the Vite proxy forwards `/api/*` to (default: 8080) |

---

## Dev commands

Run from the **repo root**:

```bash
pnpm run dev:api          # Start Express API server (port 8080, hot-reloaded via tsx)
pnpm run dev:web          # Start Vite dev server (port 5173, proxies /api/* → :8080)

pnpm run build            # typecheck + build all packages (what Vercel runs)
pnpm run typecheck        # Full type check across all workspace packages
pnpm run db:push          # Push schema changes to DB (dev only — never use on prod)

# Codegen (run after editing lib/api-spec/openapi.yaml)
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs   # Always run this after codegen
```

---

## Database

### Schema (`lib/db/src/schema/prototypes.ts`)

```
users           — id, email, passwordHash, createdAt
projects        — id, name, ownerId → users.id, createdAt
prototypes      — id, projectId → projects.id, htmlContent (text), fileName,
                  projectName (denormalised), thumbnail (base64 png), createdAt
comments        — id, prototypeId → prototypes.id, x (float 0–100), y (float 0–100),
                  text, resolved (bool), authorEmail, thumbnail, createdAt
session         — managed by connect-pg-simple (NOT in Drizzle schema)
```

### Adding a column

1. Add the column to `lib/db/src/schema/prototypes.ts`
2. Run `pnpm run db:push` (dev) — this diffs and applies the change
3. Update the Zod insert schema in the same file if needed
4. If the column is exposed via the API, update `lib/api-spec/openapi.yaml` then run codegen

### Migrations

There is no migration file system — `drizzle-kit push` is used for dev. For production schema changes, apply raw SQL manually against the production database before deploying code that depends on the new column.

---

## API layer

### Route overview

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | — | Health check |
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/logout` | — | Logout |
| GET | `/api/auth/me` | — | Current session user |
| GET | `/api/projects` | required | List own projects |
| POST | `/api/projects` | required | Create project |
| GET | `/api/projects/:id` | required | Project + its prototypes |
| PATCH | `/api/projects/:id` | required | Rename project |
| DELETE | `/api/projects/:id` | required | Delete project |
| GET | `/api/prototypes` | — | List all prototypes (public) |
| POST | `/api/prototypes` | required | Upload prototype |
| GET | `/api/prototypes/:id` | — | Get prototype (public) |
| PATCH | `/api/prototypes/:id` | required | Rename prototype |
| DELETE | `/api/prototypes/:id` | required | Delete prototype |
| GET | `/api/prototypes/:id/comments` | — | List comments (public) |
| POST | `/api/prototypes/:id/comments` | — | Add comment (public) |
| PATCH | `/api/comments/:id/resolve` | required | Toggle resolved |
| PATCH | `/api/comments/:id` | required | Edit comment text |
| DELETE | `/api/comments/:id` | required | Delete comment |

### Adding a new API route

1. **Write the route** in `artifacts/api-server/src/routes/prototypes.ts` (or create a new file and register it in `routes/index.ts`)
2. **Add Zod validation** inline using types from `@workspace/api-zod` or define new ones
3. **Add OpenPanel tracking** for write operations: `void op.track({ name: "event_name", profileId, properties: {...} })`
4. **Update the OpenAPI spec** in `lib/api-spec/openapi.yaml`
5. **Run codegen**: `pnpm --filter @workspace/api-spec run codegen && pnpm run typecheck:libs`
6. **Use the generated hook** in the frontend from `@workspace/api-client-react`

---

## Adding a new feature (PR guide)

### Checklist before opening a PR

- [ ] `pnpm run typecheck` passes with zero errors
- [ ] `pnpm run build` completes successfully
- [ ] New API routes have input validation (Zod `safeParse`) and return consistent `{ error: string }` shapes on failure
- [ ] Write operations track an OpenPanel event (server-side in the route handler)
- [ ] New DB columns are added to both the Drizzle schema and the OpenAPI spec
- [ ] Codegen has been re-run if the OpenAPI spec changed
- [ ] No secrets or `.env` values are hardcoded anywhere

### Adding a new page

1. Create `artifacts/framelink/src/pages/MyPage.tsx`
2. Add the route in `artifacts/framelink/src/App.tsx` using wouter's `<Route path="/my-path" component={MyPage} />`
3. Wrap with `<Route>` inside the auth gate if the page requires login (follow the pattern in `App.tsx`)
4. Use `useTitle("Page name")` at the top of the component

### Adding a new UI component

- Drop it in `artifacts/framelink/src/components/` (feature components) or `components/ui/` (shadcn primitives)
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes
- Follow the existing aesthetic: DM Mono font, `#0a0a0a` background, `#5b7cf6` accent, no rounded corners

### Adding analytics to a new action

**Frontend** (user-triggered events):
```ts
import { op } from "@/lib/analytics";
op.track("event_name", { key: "value" });
```

**Backend** (fire-and-forget, doesn't block the response):
```ts
import { op } from "../lib/analytics";
void op.track({ name: "event_name", profileId: req.session.userId, properties: { key: "value" } });
```

### Modifying the session or auth

- Session schema extensions live in the `declare module "express-session"` block in `routes/auth.ts`
- `requireAuth` middleware is in `artifacts/api-server/src/middlewares/requireAuth.ts` — keep it simple, just check `req.session.userId`

---

## Frontend conventions

- **Routing:** wouter (`useLocation`, `useRoute`, `Link` from `"wouter"`)
- **Auth state:** `useAuthContext()` from `@/context/AuthContext` — never fetch `/api/auth/me` directly in a component
- **API calls:** prefer generated hooks from `@workspace/api-client-react`; fall back to `fetch` for simple one-off calls
- **Styling:** Tailwind 4 utility classes; design tokens in `tailwind.config` / CSS variables in `index.css`
- **Path aliases:** `@/` resolves to `src/`, `@assets/` resolves to `attached_assets/`
- **No comments in code** unless explaining a non-obvious invariant

---

## Architecture decisions

**Comment coordinates** — stored as `x`/`y` floats 0–100 (percentages of the full iframe content area). The iframe is expanded to its full `scrollHeight` after load so comments anchor to the prototype content, not the visible viewport. This means comment pins survive scroll position changes.

**HTML stored in Postgres** — no object storage (S3, R2, etc.) needed for MVP. Full HTML content is stored as `text`. If files grow large, this will need a rethink.

**No websockets** — comments are polled every 3 seconds via TanStack Query's `refetchInterval`. Good enough for MVP, avoids infrastructure complexity.

**Auth** — email/password with bcryptjs (cost 12), sessions stored in Postgres. 30-day cookie, `httpOnly`, `secure` in production, `sameSite: "strict"`. No JWT — sessions are stateful and revokable.

**Ownership scoping** — `projects.owner_id` references `users.id`. All project and prototype mutations verify ownership before proceeding. Public share links (view + comments) work without auth.

**API contract via OpenAPI** — `lib/api-spec/openapi.yaml` is the source of truth. Orval generates both the Zod schemas (`lib/api-zod`) and the React Query hooks (`lib/api-client-react`). Do not edit generated files by hand.

**Vercel deployment** — the Express app is pre-built by esbuild into `artifacts/api-server/dist/app.mjs` during the build step. `api/index.ts` re-exports it for Vercel's `@vercel/node` runtime. The frontend (Vite) builds to `dist/` at repo root. `vercel.json` handles routing, cache headers, and rewrites.

**Module format** — the repo root `package.json` has `"type": "module"` so `api/index.ts` is compiled as ESM by Vercel (required to import the `.mjs` bundle). All workspace packages define their own `type` independently.

---

## Deployment

Deployment is automatic on push to `main` via Vercel GitHub integration.

**Build steps (what Vercel runs):**
```bash
pnpm install
pnpm --filter @workspace/api-server run build   # esbuild → dist/app.mjs
pnpm --filter @workspace/framelink run build     # Vite → dist/
```

**Required Vercel env vars** (set via `vercel env add` or the Vercel dashboard):

```
DATABASE_URL
SESSION_SECRET
ALLOWED_ORIGINS
VITE_OPENPANEL_CLIENT_ID
OPENPANEL_CLIENT_ID
OPENPANEL_CLIENT_SECRET
```

To deploy manually:
```bash
vercel          # preview deployment
vercel --prod   # production
```

---

## Gotchas

**Codegen order matters** — after editing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` then `pnpm run typecheck:libs` before running the API server typecheck. Skipping this causes stale type errors.

**Session table is not managed by Drizzle** — `drizzle.config.ts` uses `tablesFilter: ["!session"]` to prevent `db:push` from dropping the `connect-pg-simple` session table. If you're setting up a fresh database, create it manually with the SQL in the [Local setup](#local-setup) section.

**Comment overlay pointer-events** — the comment bubble overlay must have `pointer-events: none` when comment mode is OFF so users can interact with the prototype inside the iframe. Switch to `pointer-events: auto` only when comment mode is ON.

**Vite env vars** — only variables prefixed with `VITE_` are exposed to the browser bundle. Never put secrets in `VITE_` variables.

**esbuild externals** — if you add a new npm package that uses native Node.js addons (e.g. `.node` files), add it to the `external` array in `artifacts/api-server/build.mjs`.

**pnpm lockfile** — Vercel uses `--frozen-lockfile`. Always commit `pnpm-lock.yaml` after adding or updating dependencies. Run `pnpm install` locally and commit the updated lockfile.

**Rate limits** — auth routes are limited to 10 req/15 min per IP; all other API routes to 200 req/15 min. Keep this in mind when writing tests that hit the API in a loop.
