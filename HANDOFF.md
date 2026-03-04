# Session Handoff — Net Worth Projection App

## Mission

Build this app to near-production quality in a single overnight Huntley loop session. By the time Daniel wakes up, the repo should have: a full test suite, all open bugs fixed, missing features added, database hardened, and the whole thing building clean.

This is a personal finance app used by one person (Daniel). The bar is: does it actually work, does it look right, can I trust the numbers. Everything else is secondary.

## Execution Method: Huntley Loop

Geoffrey Huntley's pattern. A bash loop runs PROMPT.md through Claude repeatedly — each iteration gets fresh context, reads state from disk, does one unit of work, commits, exits. Loop restarts. Progress lives in files and git, not in any agent's memory.

The loop command (run from project root):
```bash
while :; do cat PROMPT.md | ~/.bun/bin/bun x claude --dangerously-skip-permissions; done
```

This session's job (Opus) is to:
1. Design the full gate sequence
2. Write PROMPT.md — the single file every iteration will read
3. Write PROGRESS.md — initial state so the first iteration knows where to start
4. Confirm the plan with Daniel, then hand off

---

## Project

**Repo:** `DanofGar/net-worth-projection-app`
**Local path:** `~/Projects/net-worth-app/finance-dashboard`
**GitHub:** `https://github.com/DanofGar/net-worth-projection-app`
**Deployed:** Netlify at dgautomate.dev (not the main site — separate app)

**Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + RLS), Teller.io (mTLS bank API), Recharts, Framer Motion, Netlify Functions (scheduled polling)

**Package manager:** npm currently — migrate to Bun as Gate 1. Bun is installed at `~/.bun/bin/bun`.

---

## What Exists Today

### Completed features
- Full authentication flow (Supabase Auth)
- Teller Connect integration (mTLS, sandbox + production)
- Multi-step onboarding (accounts → credit cards → primary account)
- 60-day projection engine (`lib/projection.ts`) — net worth and cash flow modes
- Dashboard with Recharts area chart, account cards, rules modal
- Scheduled Netlify function (polls Teller 3x daily)
- Supabase schema + migrations (4 migrations written)
- Design system: cream/charcoal/terra-cotta, Newsreader serif + DM Sans

### Zero tests
No test framework installed. No test files exist anywhere. Starting from scratch.

### Key files
```
lib/projection.ts          — 60-day projection engine (has embedded DB calls)
lib/supabase.ts            — Supabase client factories + DB type definitions
lib/teller.ts              — Teller mTLS fetch wrapper
lib/validations.ts         — Zod schemas for all API inputs
middleware.ts              — Route protection
app/dashboard/page.tsx     — Main dashboard (client component, ~400 lines)
app/api/projection/route.ts
app/api/rules/route.ts
app/api/rules/[id]/route.ts
app/api/accounts/route.ts
app/api/accounts/[id]/route.ts
app/api/accounts/refresh/route.ts
app/api/teller/callback/route.ts
netlify/functions/scheduled-poll.ts
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_mock_data.sql
supabase/migrations/003_auth_and_rls.sql   — RLS policies written but NOT confirmed applied
supabase/migrations/004_assign_mock_data.sql
```

---

## Database State (Live)

Supabase project: `wngcgwldgvqqngnbqhbs.supabase.co`
Confirmed accessible via service key:
- `enrollments`: 1 row
- `accounts`: 8 rows (mock data)
- `balances`: 8 rows (mock data)
- `recurring_rules`: 2 rows

**Known issue:** `user_id` column on `enrollments` and `recurring_rules` is nullable — migration 003 adds it but doesn't enforce NOT NULL until mock data is assigned. RLS status unknown — confirm before enabling in tests.

---

## Open GitHub Issues (all 7 are open)

| # | Label | Description |
|---|-------|-------------|
| 1 | enhancement | Default view: Cash Flow as primary, Net Worth secondary |
| 2 | bug | Y-axis currency labels clipped (e.g. `$10,000` cut off) |
| 3 | enhancement | Account sections: replace horizontal rows with bordered columns |
| 4 | bug | X-axis date labels collide when switching 15/30/60-day timeframes |
| 5 | bug | Date picker fields: entire field should open calendar, not just icon |
| 6 | enhancement | UI iteration: spawn multiple agents with distinct visual styles |
| 7 | enhancement | Complex test data suite + error handling edge cases |

Issues 1–5 and 7 should be addressed in this session. Issue 6 (parallel UI agents) is a separate multi-agent task — skip for now.

---

## TODO.md Backlog

### Security
- [ ] Enable RLS on all tables (policies written in migration 003, need to confirm applied)

### Features
- [ ] Recurring rules management UI (currently only accessible via DB)
- [ ] Account edit/delete
- [ ] Manual balance refresh button
- [ ] Transaction history view
- [ ] Export projections as CSV

### Technical debt
- [ ] Comprehensive error handling + user feedback
- [ ] Loading states for all async operations
- [ ] Unit tests for projection engine
- [ ] Integration tests
- [ ] Query optimization

### Documentation
- [ ] API documentation
- [ ] Troubleshooting guide

---

## Test Strategy (pre-decided)

**Unit tests:** Vitest + `@testing-library/react`. Mock Supabase client entirely.
**Integration tests:** Real Supabase project (test data, separate from mock rows).
**E2E/Visual tests:** Playwright — page flow tests + visual snapshot baselines.
**No Gemini visual QA** (cost optimization decision).

### Key testing challenge
`lib/projection.ts` has Supabase calls embedded inside `generateProjection()`. The pure math logic is mixed with DB fetches. Options:
1. Extract pure calculation logic into a separate function, test that in isolation
2. Mock `supabaseAdmin` at the module level in tests
Opus should decide which approach and apply it consistently.

---

## Environment

All env vars confirmed present in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY`
- `NEXT_PUBLIC_TELLER_APP_ID` / `NEXT_PUBLIC_TELLER_ENV` (fixed — was `sandbox # or 'production'`, now just `sandbox`)
- `TELLER_CERT_B64` / `TELLER_KEY_B64`

Teller cert: valid PEM, CN = App ID, expires Jan 2029.

Pre-flight check script: `scripts/preflight-check.mjs` — run `node scripts/preflight-check.mjs` to verify.

---

## Git State

```
branch: main
last commit: "Add design assets: wireframes, mockups, and brand identity"
existing branch: Front-End-UI-changes-to-Dashboard (stale, don't use)
```

The Huntley loop should work on a new branch: `build/overnight-comprehensive`.

---

## Daniel's Priorities (in order)

### 1. Connectivity and accurate data — non-negotiable
The app must reliably connect to real bank accounts via Teller and display balances accurately. The chart must reflect actual values. Numbers must be readable — no clipping, no collision, no squishing. This is the whole point of the app. Everything else is secondary to this.

### 2. Smooth, functional UI
- Navigation must work. Every button must do what it says. No broken states on rapid clicking or unexpected navigation paths.
- Loading states everywhere async operations exist. No blank screens, no silent failures.
- Transitions should feel snappy, not janky. Framer Motion is already in the stack — use it where it earns its place.
- The chart is the centerpiece. It should be legible at a glance: clear Y-axis labels (no clipping), readable X-axis dates (no collision), correct scale.

### 3. State management and auth robustness
- Login state must be solid. User should be able to: sign in, sign out, reset password, stay logged in across browser sessions.
- Session expiry must be handled gracefully — redirect to login, not a broken screen.
- After connecting a bank, state should update immediately without requiring a full page reload.
- Supabase RLS must actually protect data. The `user_id` associations must be enforced.

### 4. Feature enrichment — Opus decides what's worth including
Beyond what's already built, Opus should think through what a real personal finance app needs and propose what fits this scope. Starting points to consider:
- **Balance history view** — not just current balance, but a sparkline or mini chart showing how each account has trended over recent polling periods
- **Transaction-level detail** — Teller provides transactions on accounts; if accessible in sandbox/development, surface them
- **Credit score** — apps like Mint/Credit Karma pull this. Teller does not provide it natively, but some Teller account subtypes (credit cards) expose credit limit and balance. Consider a "credit utilization" indicator as a proxy. Full credit score integration would require a separate API (Experian, TransUnion) and is likely out of scope — but Opus should call this out explicitly.
- **Net worth trend** — show how net worth has changed day-over-day since the app started polling, not just the projection forward
- **Recurring rules UI** — currently only editable in the DB. A real CRUD interface for adding income, expenses, and one-time events is essential for the projection to be meaningful.
- **Manual refresh** — a button to trigger balance polling on demand, not just wait for the scheduled function
- **Account management** — ability to disconnect/reconnect banks, see when each was last synced
- **CSV export** — download projection data
- Opus is not limited to this list. If there are other things a solo personal finance app typically needs, include them.

### 5. Testing priorities
The test suite should cover what actually breaks in financial apps. Think adversarially:
- Auth: sign in, sign out, password reset, expired session, protected routes without auth
- Data integrity: what happens with zero accounts, zero balances, mismatched user_id
- Chart rendering: does it degrade gracefully with 1 data point? 0 data points? Very large/small values?
- Projection math: known inputs → verify exact outputs (weekly/biweekly/monthly rules, CC autopay deduction, liquid vs total net worth)
- Rapid interaction: clicking refresh multiple times, switching view modes quickly, navigating away mid-load
- Visual snapshots: baseline screenshots for dashboard, empty state, onboarding steps

---

## Constraints & Preferences

- **Bun first:** Migrate from npm to Bun in Gate 1. All subsequent commands use `bun`.
- **No Gemini calls** during the loop (cost).
- **Commit frequently** — after every meaningful change, not just at gates.
- **PROGRESS.md is the source of truth** — every iteration reads it first, updates it last.
- **No backward-compat hacks** — if something is unused, delete it.
- **No over-engineering** — minimum complexity for current requirements.
- Daniel's writing/code style: direct, no filler, no superlatives.

---

## What Opus Needs to Produce

### Step 1: Feature and scope audit
Before designing gates, Opus should read the codebase and think through:
- What features are worth adding given the priority order above
- What the credit score / credit utilization situation actually is with Teller's API
- Whether transaction history is accessible and worth surfacing
- What the projection engine needs to display historical net worth trend (it currently only projects forward)
- Any architectural concerns (e.g. the embedded DB calls in projection.ts)

### Step 2: Gate sequence
Ordered list of gates with unambiguous completion criteria. Each gate = one unit of Huntley loop work. Gates should be sized so each can realistically complete in one iteration without context window overflow.

Suggested gate categories (Opus should refine, reorder, split, or merge as needed):
- Setup (Bun migration, test framework install, branch creation)
- Database hardening (RLS enforcement, user_id NOT NULL, migration verification)
- Projection engine refactor (extract pure calc logic for testability)
- Unit tests (projection math, Zod validations, utility functions)
- API route tests (all routes, mocked auth + DB)
- Bug fixes (issues #1–5 from GitHub)
- Feature: balance history / net worth trend
- Feature: recurring rules UI
- Feature: transaction history (if Teller provides it)
- Feature: account management (disconnect/reconnect, last-synced display)
- Feature: manual refresh + loading states
- Feature: CSV export
- Feature: auth hardening (password reset, session expiry handling)
- Component tests (React Testing Library)
- E2E tests (Playwright: auth flows, dashboard, onboarding)
- Visual snapshots (Playwright: dashboard, empty state, mobile viewport)
- Final: lint clean, build clean, README update

### Step 3: Write PROMPT.md to disk
At `~/Projects/net-worth-app/finance-dashboard/PROMPT.md`. Every Huntley iteration reads this file. It must:
- Tell Claude to read PROGRESS.md first to find the current gate
- Define what "done" means for each gate clearly enough that any fresh Claude can verify completion
- Instruct Claude to commit after every meaningful change (not just at gate boundaries)
- Instruct Claude to update PROGRESS.md with: gate completed, what was done, any blockers, next gate
- Instruct Claude to exit after completing one gate (not to continue into the next)
- Include enough project context that a fresh Claude doesn't need to read this HANDOFF.md

### Step 4: Write initial PROGRESS.md to disk
At `~/Projects/net-worth-app/finance-dashboard/PROGRESS.md`. Seeds Gate 1 as the current gate.

### Step 5: Confirm with Daniel
Present the gate sequence for approval. Do not start the loop until Daniel says go.
