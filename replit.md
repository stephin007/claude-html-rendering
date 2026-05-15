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

- DB schema: `lib/db/src/schema/prototypes.ts` — prototypes + comments tables
- API contract: `lib/api-spec/openapi.yaml`
- API routes: `artifacts/api-server/src/routes/prototypes.ts`
- Frontend pages: `artifacts/framelink/src/pages/`

## Architecture decisions

- Coordinates for comment bubbles stored as percentages (x/y as floats 0-1) so they render correctly at any screen size
- HTML content stored as text in PostgreSQL — no object storage needed for MVP
- Comments polled every 3 seconds (refetchInterval) for real-time feel without websockets
- No auth — share links are public by UUID; anyone with the link can view + comment

## Product

- Upload page (`/`): drag-and-drop HTML file upload, recent uploads list
- Review page (`/view/:id`): iframe rendering of the HTML design, comment overlay with click-to-pin numbered bubbles, right panel with comment list and "Copy all for Claude" button

## User preferences

- Raw editorial aesthetic: DM Mono font, #0a0a0a background, #5b7cf6 accent, brutalist/no-rounded-corners
- Use existing PostgreSQL database (not Supabase)

## Gotchas

- After editing the OpenAPI spec, always run codegen then `typecheck:libs` before running the API server typecheck
- The comment overlay must be `pointer-events: none` when comment mode is OFF
