# Framelink

HTML prototype review tool — upload an HTML file, get a shareable link, drop numbered comment bubbles directly on the design.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/framelink run dev` — run the frontend (port 22081)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, wouter routing, TanStack Query

## Where things live

- DB schema: `lib/db/src/schema/prototypes.ts` — prototypes + comments + users tables
- API contract: `lib/api-spec/openapi.yaml`
- API routes: `artifacts/api-server/src/routes/prototypes.ts`, `auth.ts`
- Auth middleware: `artifacts/api-server/src/middlewares/requireAuth.ts`
- Frontend pages: `artifacts/framelink/src/pages/`
- Auth context: `artifacts/framelink/src/context/AuthContext.tsx`

## Architecture decisions

- Coordinates for comment bubbles stored as percentages (x/y as floats 0-1) so they render correctly at any screen size
- HTML content stored as text in PostgreSQL — no object storage needed for MVP
- Comments polled every 3 seconds (refetchInterval) for real-time feel without websockets
- Auth: email/password with bcrypt (cost 12), sessions stored in Postgres via connect-pg-simple, 30-day cookies
- Projects are owner-scoped: `projects.owner_id` references `users.id`; GET/DELETE /api/projects filter strictly by the session user — no cross-user data leakage
- Public routes: GET /api/prototypes/:id, GET /api/prototypes/:id/comments, POST /api/prototypes/:id/comments (share links work without auth)
- Protected routes (requireAuth): GET/POST/DELETE /api/projects, POST/DELETE /api/prototypes, PATCH/DELETE /api/comments
- Session table (`session`) must exist in Postgres — created manually via SQL (connect-pg-simple's `createTableIfMissing` is broken in production builds). `drizzle.config.ts` uses `tablesFilter: ["!session"]` so push never drops it

## Product

- Landing page (`/`): public-facing hero for unauthenticated users
- Upload page (`/`): drag-and-drop HTML file upload, recent uploads list (authenticated)
- Review page (`/view/:id`): iframe rendering of the HTML design, comment overlay with click-to-pin numbered bubbles, right panel with comment list and "Copy all for Claude" button
- Sign in (`/sign-in`) / Sign up (`/sign-up`): email+password auth forms

## User preferences

- Raw editorial aesthetic: DM Mono font, #0a0a0a background, #5b7cf6 accent, brutalist/no-rounded-corners
- Use existing PostgreSQL database (not Supabase)

## Gotchas

- After editing the OpenAPI spec, always run codegen then `typecheck:libs` before running the API server typecheck
- The comment overlay must be `pointer-events: none` when comment mode is OFF
