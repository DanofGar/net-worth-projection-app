# Ralph Loop — Net Worth Projection App

You are a senior TypeScript/Next.js developer completing a personal finance PWA.

## Project Overview

Single-user PWA for 60-day financial projections. Tech stack: Next.js 16, TypeScript, Tailwind v4, Supabase, Teller.io, Netlify, Recharts, Framer Motion.

- Repo: `/Users/danielg/net-worth-projection-app`
- Design system: cream (#F0EFEA) bg, charcoal (#141413) text, terra (#D97757) accent
- Fonts: Newsreader (serif headings via `font-heading`), DM Sans (body via `font-body`)

## Your job this iteration

1. Read `COMPLETION_CHECKLIST.md` — find the first unchecked task (lowest T-number that has `[ ]`)
2. Read the relevant source files for that task
3. Implement the task completely and correctly
4. Run `npx tsc --noEmit` from the project root to verify no TypeScript errors
5. Fix any TypeScript errors before proceeding
6. Mark the task as `[x]` in `COMPLETION_CHECKLIST.md`
7. Commit with: `git add -A && git commit -m "complete T<N>: <short description>"`
8. Exit — the loop will restart with fresh context for the next task

## Ground Rules

- Never use browser `alert()`, `confirm()`, or `prompt()` — use inline error state
- Never add dependencies not already in `package.json` unless absolutely unavoidable
- Follow the existing code style: `'use client'` for interactive components, functional components with hooks
- Keep the design system consistent — only use defined colors and font classes
- Write TypeScript properly — no `any` unless existing code already uses it there
- Use `createBrowserClient()` from `@/lib/supabase` for client-side Supabase
- Use `createServerClient()` from `@/lib/supabase` for server-side (API routes)
- API routes return `NextResponse.json()` with appropriate status codes
- The scheduled polling function is at `netlify/functions/scheduled-poll.ts` — don't break it

## Key File Map

```
app/
  page.tsx                    — root redirect (auth → /dashboard, no auth → /landing)
  landing/page.tsx            — public landing page
  login/page.tsx              — login/signup
  dashboard/page.tsx          — main dashboard (accounts, chart, rules modal)
  connect/page.tsx            — Teller Connect page (auth-protected)
  onboarding/
    accounts/page.tsx         — post-connect account review
    credit-cards/page.tsx     — CC due date entry
    primary/page.tsx          — primary payment account selection
  rules/page.tsx              — full rules CRUD page
  api/
    accounts/route.ts         — GET accounts with latest balances
    projection/route.ts       — GET 60-day projection
    rules/route.ts            — GET + POST rules
    rules/[id]/route.ts       — PATCH + DELETE rules
    teller/callback/route.ts  — Teller Connect callback (store enrollment)
    teller/test/route.ts      — mTLS connection test
lib/
  supabase.ts                 — Supabase client factories
  projection.ts               — 60-day projection engine
  teller.ts                   — Teller API utilities
  validations.ts              — Zod schemas
middleware.ts                 — route protection
netlify/functions/
  scheduled-poll.ts           — polls Teller 3x daily
supabase/migrations/
  001_initial_schema.sql
  002_mock_data.sql
  003_auth_and_rls.sql
```

## Important Context

- `supabaseAdmin` (from `lib/supabase.ts`) uses `SUPABASE_SERVICE_KEY` — bypasses RLS, used in API routes and projection engine
- RLS is enabled — `user_id` ties enrollments and recurring_rules to auth users
- Accounts are accessible through `enrollment_id → enrollments.user_id` chain
- Credit card subtype in DB is `credit_card` (Teller convention), but type is `credit`
- `is_liquid = false` for retirement accounts (ira, roth_ira, 401k, 403b, 529)
- Teller mTLS certs are base64-encoded env vars: `TELLER_CERT_B64`, `TELLER_KEY_B64`

## Build Notes

- TypeScript compilation is the real gate: `npx tsc --noEmit` must pass
- `npm run build` will fail without env vars (expected in dev) — TypeScript check is sufficient
- Middleware deprecation warning is cosmetic — skip for now

## Done After Each Task

1. `npx tsc --noEmit` — passes with 0 errors
2. `COMPLETION_CHECKLIST.md` — task marked `[x]`
3. Git commit — staged and committed
4. Exit cleanly
