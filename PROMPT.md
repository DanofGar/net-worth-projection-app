# PROMPT.md — Net Worth App Huntley Loop

## First Step Every Iteration

Read `PROGRESS.md`. It tells you the current gate, what's done, any blockers, and notes from previous iterations. Do not skip this.

Then find your current gate in the Gate Definitions section below and execute it.

After completing the gate: update PROGRESS.md, commit, and exit. Do not start the next gate.

---

## Project Context

**Path:** ~/Projects/net-worth-app/finance-dashboard
**Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + RLS), Teller.io (mTLS bank API), Recharts, Framer Motion, Netlify Functions
**Package manager:** Bun (after Gate 0). Binary at `~/.bun/bin/bun`.
**Branch:** `build/overnight-comprehensive`

### Key Files

```
lib/projection.ts          — 60-day projection engine (DB calls + math mixed together)
lib/supabase.ts            — Supabase client factories + DB types
lib/teller.ts              — Teller mTLS fetch wrapper (only /accounts and /balances used)
lib/validations.ts         — Zod schemas (tellerCallbackSchema exists but unused in callback route)
middleware.ts              — Route protection (uses getSession, should use getUser)
app/dashboard/page.tsx     — Main dashboard (~715 lines, client component)
app/rules/page.tsx         — Full CRUD rules page (already built, needs polish)
app/api/projection/route.ts
app/api/rules/route.ts     — GET list, POST create
app/api/rules/[id]/route.ts — GET, PATCH, DELETE
app/api/accounts/route.ts  — GET all accounts (has N+1 balance query)
app/api/teller/callback/route.ts — POST (doesn't validate with existing Zod schema)
netlify/functions/scheduled-poll.ts — 3x daily polling (duplicates lib/teller.ts code)
supabase/migrations/       — 4 migrations (001-004)
```

**Missing files (need to be created):**
- `app/api/accounts/[id]/route.ts` — account update/delete
- `app/api/accounts/refresh/route.ts` — manual balance refresh

### Database Schema (key tables)

```sql
balances: id, account_id, ledger (decimal NOT NULL), available (decimal nullable), polled_at
accounts: id, enrollment_id, teller_account_id, name, type, subtype, last_four, is_liquid, is_primary_payment, payment_day_of_month
enrollments: id, teller_enrollment_id, access_token, institution, institution_name, user_id (added in 003), last_polled_at
recurring_rules: id, name, amount, frequency, anchor_date, end_date, active, user_id (added in 003)
```

### Design System

- Colors: cream `#F0EFEA`, charcoal `#141413`, terra cotta `#D97757`, border `#E6E4DD`
- Fonts: Newsreader (headings), DM Sans (body)
- Defined as CSS variables in `app/globals.css` via Tailwind v4 `@theme`
- Use CSS variable names (`text-cream`, `bg-charcoal`, `text-terra`, `border-border-subtle`), not hardcoded hex

### Teller API Reference (for Gates 7-8)

```
GET /accounts                         — list all accounts for enrollment
GET /accounts/:id/balances            — { ledger, available } (strings, one can be null)
GET /accounts/:id/transactions        — list transactions (supports count, from_id, start_date, end_date params)
DELETE /accounts/:id                  — disconnect account
Base URL: https://api.teller.io
Auth: Basic (access_token as username, empty password)
mTLS: required for dev/prod, not sandbox
```

---

## Protocol

### Each Iteration

1. Read PROGRESS.md
2. Identify current gate
3. Execute the gate. Commit after each meaningful change.
4. Run `bun run build` at end of gate (for any gate that modifies source code)
5. Update PROGRESS.md:
   - Mark current gate DONE with 1-2 line summary
   - Set next gate number as current
   - Add any blockers or discoveries to Notes
6. Commit PROGRESS.md update
7. Exit

### Commit Messages

Format: `gate-N: description`
Example: `gate-3: fix y-axis label clipping with left margin and compact formatter`

### If Something Breaks

Fix it before moving on. If a build fails, fix it. If a test fails, fix it. If truly stuck, note it as a BLOCKER in PROGRESS.md and exit.

### Conventions

- Bun for all commands (`bun install`, `bun run`, `bunx`)
- No backward-compat hacks — delete unused code
- No over-engineering — minimum complexity for current needs
- Fix issues you discover even if not in current gate scope (within reason)
- Use CSS variable names for design tokens, not hardcoded hex values

---

## Gate Definitions

### Gate 0: Setup & Bun Migration

**Do:**
- Create branch `build/overnight-comprehensive` from main
- Delete `package-lock.json`
- Run `bun install`
- Install dev deps: `vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react`
- Install Playwright: `bun add -d @playwright/test` then `bunx playwright install chromium`
- Create `vitest.config.ts` (jsdom env, `@/*` path alias matching tsconfig)
- Create `playwright.config.ts` (chromium only, baseURL `http://localhost:3000`)
- Add scripts to package.json: `"test": "vitest"`, `"test:run": "vitest run"`, `"test:e2e": "playwright test"`
- Verify `bun run build` succeeds
- Commit all

**Done when:** Branch exists, bun.lock present, `bun run build` passes, test configs exist.

---

### Gate 1: Database & Security Hardening

**Do:**
- Fix `middleware.ts`: replace `supabase.auth.getSession()` with `supabase.auth.getUser()`. Supabase docs recommend `getUser()` for server-side verification because `getSession()` trusts the cookie without server validation.
- Fix `app/api/teller/callback/route.ts`: validate body with `tellerCallbackSchema.safeParse()` from `lib/validations.ts`. Return 400 with error details on validation failure. The schema already exists but is never called.
- Create `supabase/migrations/005_enforce_not_null.sql`:
  ```sql
  ALTER TABLE enrollments ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE recurring_rules ALTER COLUMN user_id SET NOT NULL;
  ```
- Fix N+1 in `app/api/accounts/route.ts`: currently does one balance query per account. Instead, fetch all latest balances in a single query (select all where account_id IN [...], order by polled_at desc), then match to accounts in memory. Mirror the approach used in `lib/projection.ts`.
- Build must pass.

**Done when:** Middleware uses `getUser()`, callback validates input, migration 005 exists, accounts route uses batch balance query.

---

### Gate 2: Projection Engine Refactor

**Do:**
- In `lib/projection.ts`:
  - Extract a pure function `calculateProjection(input)` that takes pre-fetched data (accounts, latest balances, active rules, config: days/viewMode/scope) and returns `ProjectionResult`. This is the day-by-day simulation loop + all pure math.
  - Export `ruleAppliesToDate(rule, date): boolean` (currently private)
  - Keep `generateProjection(userId, days, viewMode, scope)` as a thin wrapper: fetch from DB → call `calculateProjection()` → return
  - Fix the balance query: add `.limit()` or a better approach to prevent fetching all historical balance rows. Currently fetches ALL rows then deduplicates in memory.
- Export relevant types: `ProjectionPoint`, `ProjectionResult`, `ViewMode`, `Scope`
- No behavior changes. Output must be identical before and after.
- Build must pass.

**Done when:** `calculateProjection` is an exported pure function, `ruleAppliesToDate` is exported, balance query is bounded.

---

### Gate 3: Chart & Display Bug Fixes

**GitHub Issues:** #1, #2, #4, plus timeframe state bug.

**Do:**
- **Issue #1 (default view):** Change default `viewMode` from `'net_worth'` to `'cash_flow'`. Cash Flow should be the left/primary pill button.
- **Issue #2 (Y-axis clipping):** Currency labels like "$10,000" clip at left edge. Fix by: increasing chart left margin in `<AreaChart margin={}>` AND formatting large values compactly (e.g., "$10K" for thousands). Use a custom `tickFormatter` on YAxis.
- **Issue #4 (X-axis collision):** Date labels collide on timeframe changes. Fix by: using `interval` prop on XAxis that adapts to timeframe length, or reducing tick count. Labels must be readable at all timeframe options.
- **Timeframe bug:** `timeFrame` defaults to 15 but: (a) no 15-day button exists, (b) timeframe controls only show in cash flow mode. Fix: show timeframe controls in both view modes. Provide options: 15, 30, 45, 60 days.
- Build must pass.

**Done when:** Chart is legible at all timeframes in both modes. No clipping, no collision.

---

### Gate 4: UI Layout Fixes + Dashboard Cleanup

**GitHub Issues:** #3, #5, plus technical bugs.

**Do:**
- **Issue #3 (account layout):** Replace horizontal account rows with bordered column cards. Group into sections: Checking & Savings, Credit Cards, Retirement. Each card: account name, institution (if available), last four, current balance, type/subtype badge.
- **Issue #5 (date picker):** In rules forms, make the entire date input field clickable to open the calendar, not just the icon. Apply to both anchor_date and end_date fields. Use `onClick` on the container to trigger the input's `showPicker()`.
- **Fix double fetch:** `fetchProjection` runs inside `fetchAccounts` callback AND in a `useEffect` watching `accounts.length`. Remove the duplicate. Fetch projection once after accounts load.
- **Fix client creation:** `createBrowserClient()` is called in the component body on every render (dashboard and rules page). Move to `useMemo` or module scope.
- Build must pass.

**Done when:** Account cards are columnar with sections, date pickers fully clickable, no double fetch, client memoized.

---

### Gate 5: Loading States & Error Handling

**Do:**
- Add loading skeleton for chart area (pulsing placeholder matching chart dimensions)
- Add loading skeleton for account cards section
- Add loading skeleton for projection value display
- Create a toast/notification component (Framer Motion, auto-dismiss after 4s) for success/error feedback
- Replace `console.error` calls in client-side code with user-visible toast notifications
- Add error state on dashboard: error card with description and retry button (not just a red `<p>` tag)
- Add disabled/loading state on async buttons (refresh, save rule, sign out)
- Build must pass.

**Done when:** All async operations have visible loading indicators. Errors show user-friendly toasts. Buttons disable during async work.

---

### Gate 6: Rules UI Polish & Dashboard Integration

**Context:** `/rules/page.tsx` already has full CRUD (list, create, edit, delete, toggle active). This gate is about integration and polish.

**Do:**
- Dashboard's "Manage Rules" button should navigate to `/rules` instead of opening the create-only modal. Remove the modal from dashboard, or repurpose as "Quick Add" and rename accordingly.
- On rules page: fix `createBrowserClient()` called in component body (same issue as dashboard)
- On rules page: replace `getSession()` auth check with `getUser()`
- Add income/expense visual distinction: income rules (positive amounts) get a green accent, expenses (negative) get a red accent — applied consistently in the rules list
- Verify all frequency types display correctly: weekly, biweekly, monthly, once
- Build must pass.

**Done when:** Dashboard links to `/rules`. Rules page has consistent styling and fixed auth/client issues.

---

### Gate 7: Manual Refresh & Account Management

**Do:**
- Refactor `netlify/functions/scheduled-poll.ts`: import `getTellerAgent` and `tellerFetch` from `lib/teller.ts` instead of the copy-pasted duplicates. The Netlify function imports from lib need to work — test the import path.
- Create `app/api/accounts/refresh/route.ts`: POST handler. For all user's accounts, fetch fresh balances from Teller, insert balance rows. Requires auth. Returns updated balances.
- Create `app/api/accounts/[id]/route.ts`:
  - PATCH: update `is_primary_payment`, `is_liquid`, `payment_day_of_month`
  - DELETE: remove account from local DB. Optionally call Teller DELETE endpoint.
- Dashboard: add "Refresh Balances" button in header with loading state
- Account cards: show "Last updated: X ago" (from latest balance `polled_at` or enrollment `last_polled_at`)
- Account cards: add disconnect/remove button with confirmation dialog
- Build must pass.

**Done when:** Refresh button works, accounts show last-updated time, accounts can be disconnected.

---

### Gate 8: Transaction History

**Do:**
- Add to `lib/teller.ts`: `tellerFetchTransactions(accountId, accessToken, params?)` — calls `GET /accounts/:id/transactions`. Params: `count` (default 50), `from_id` (pagination).
- Create `app/api/accounts/[id]/transactions/route.ts`: GET handler. Fetches transactions from Teller on demand. Requires auth. Verify account belongs to user's enrollment. Supports `count` and `from_id` query params.
- Create transaction history UI: expandable section per account card, or a slide-out panel. Display each transaction: date, description, amount (green for credits, red for debits), category badge, status (pending/posted).
- Add "Load more" button for pagination (passes `from_id` of last transaction).
- Handle Teller 401 gracefully: show "Bank connection expired. Reconnect?" instead of generic error.
- Build must pass.

**Done when:** Clicking an account shows its transactions from Teller, with pagination and error handling.

---

### Gate 9: Net Worth Trend (Historical)

**Do:**
- Create `app/api/history/route.ts`: GET handler. Query `balances` table, join through `accounts` → `enrollments` for user scoping. Group by date (truncate `polled_at` to day). For each day: sum `ledger` across all accounts for total net worth (credit accounts as negative), sum only `is_liquid` accounts for liquid net worth. Return `{ date, netWorth, liquidNetWorth }[]`.
- Add historical section to dashboard: either a second chart below the projection, or a tab/toggle between "Projection" and "History".
- Use same Recharts AreaChart styling (colors, fonts, grid) for visual consistency.
- Show change indicator: "+$X,XXX since [earliest date]" or percentage change.
- If less than 2 days of data, show "Not enough history yet" message.
- Build must pass.

**Done when:** Dashboard shows historical net worth trend from stored balance data.

---

### Gate 10: Credit Utilization Display

**Do:**
- For credit card accounts (`type === 'credit'`), compute: `credit_limit = ledger + available` (only when both are non-null). `utilization = ledger / credit_limit`.
- Display on credit card account cards: utilization %, small progress bar. Color coding: green (<30%), yellow (30-50%), orange (50-75%), red (>75%).
- Format: "$X,XXX / $Y,YYY (ZZ%)" or similar compact display.
- If `available` is null (can't compute limit), show balance only, no utilization bar.
- Note: `ledger` and `available` are stored as decimals in the `balances` table. Teller returns them as strings but the callback/polling code should already parse them.
- Build must pass.

**Done when:** Credit card cards show utilization bar/percentage when data is available. Degrades gracefully when incomplete.

---

### Gate 11: Auth Hardening

**Do:**
- Check if password reset pages exist. If not, create:
  - `/app/reset-password/page.tsx` — form to enter email, calls `supabase.auth.resetPasswordForEmail()`
  - `/app/update-password/page.tsx` — form to set new password after clicking email link, calls `supabase.auth.updateUser({ password })`
- Add "Forgot password?" link on login page pointing to `/reset-password`
- Session expiry: detect expired/invalid sessions and redirect to login with a "Session expired" message (not a broken white screen). Check both middleware and client-side.
- Verify sign-out clears all state and redirects to login.
- Add loading states on login, sign-up, reset forms.
- Build must pass.

**Done when:** Password reset works end-to-end. Expired sessions redirect gracefully. Auth forms have loading states.

---

### Gate 12: CSV Export

**Do:**
- Add "Export CSV" button on dashboard near the chart (or in a toolbar area).
- Generate CSV from current projection data. Columns: Date, Projected Balance, Rules Applied (comma-separated names of rules that triggered that day).
- Client-side generation: build CSV string, create Blob, use `URL.createObjectURL()` + anchor click for download.
- Filename: `projection-{viewMode}-{days}d-{YYYY-MM-DD}.csv`
- Build must pass.

**Done when:** Button downloads a properly formatted CSV of the current projection.

---

### Gate 13: Unit Tests — Projection Engine

**Do:**
- Create `lib/__tests__/projection.test.ts`
- Test `calculateProjection`:
  - Known inputs (checking + credit accounts, weekly/monthly rules) → verify exact output values
  - Zero accounts → empty/zero projection
  - Zero rules → flat line (balance stays constant)
  - Negative starting balance → handled correctly
  - CC autopay deduction → correct amount and timing
  - `liquid` scope → only liquid accounts included
  - `total` scope → all accounts included
  - `net_worth` vs `cash_flow` mode differences
- Test `ruleAppliesToDate`:
  - Weekly: hits every 7 days from anchor
  - Biweekly: every 14 days
  - Monthly: same day each month
  - Once: only on anchor date
  - Edge: past anchor, future anchor, end_date boundary
- `bun run test:run` — all pass.

**Done when:** All projection tests pass.

---

### Gate 14: Unit Tests — API Routes & Validations

**Do:**
- Create `lib/__tests__/validations.test.ts`:
  - Each Zod schema: valid → passes, missing required → fails, wrong type → fails, boundary values
- Create API route tests (co-located or in `__tests__/` dirs):
  - Mock `createServerClient` → return fake Supabase client
  - Mock `supabaseAdmin` for admin routes
  - Test: success, 401 (no auth), 400 (bad input), 404 (not found), 500 (server error)
  - Cover: projection, rules (GET/POST), rules/[id] (GET/PATCH/DELETE), accounts, teller callback
- `bun run test:run` — all pass.

**Done when:** All validation and route tests pass.

---

### Gate 15: Component Tests

**Do:**
- Test dashboard rendering with mocked fetch responses
- Test: chart area renders, account cards render, view mode toggle works, scope toggle works, timeframe buttons work
- Test empty state: no accounts → appropriate messaging
- Test rules page: form validation, submit, edit, delete
- Test error state: API failure → error display
- Use `@testing-library/react` + `@testing-library/user-event`
- Mock `fetch` globally or per-test
- `bun run test:run` — all pass.

**Done when:** Component tests pass covering primary interactions.

---

### Gate 16: E2E & Visual Tests — Playwright

**Do:**
- Create `e2e/` directory
- Configure Playwright `webServer` to start dev server (`bun run dev`)
- Tests (design around not having real auth credentials):
  - `auth.spec.ts`: login page loads, form renders, invalid submission shows validation
  - `dashboard.spec.ts`: if auth is available, verify dashboard loads with chart and accounts
  - `navigation.spec.ts`: page navigation between routes works
- Visual snapshots:
  - Login page (desktop)
  - Dashboard (desktop, 1280x720) — if accessible
  - Dashboard (mobile, 375x812) — if accessible
- Mark tests that require real auth as `test.skip` with a note about setup
- `bun run test:e2e` — passing tests pass.

**Done when:** Playwright config works, E2E files exist, non-auth-dependent tests pass, visual snapshots captured.

---

### Gate 17: Final Polish

**Do:**
- `bun run lint` — fix all errors
- `bun run build` — zero errors
- `bun tsc --noEmit` — zero type errors
- Remove dead code: unused imports, unused variables, stale schemas
- Check for hardcoded hex colors in Recharts config (dashboard) — replace with CSS variable values
- Delete stale doc files (ASSESSMENT_AND_FIXES.md, CLAUDE_ASSESSMENT_SUMMARY.md, NEXT_STEPS.md, CONTEXT.md) after confirming nothing essential in them
- Review TODO comments in code — resolve or remove if addressed
- Update README.md: features list, setup with Bun, env var requirements, how to run tests
- Final commit

**Done when:** Clean lint, clean build, clean types, README current, no dead code.

---

## Scope Notes

**Credit Score:** Teller does not provide credit scores at any tier. Full credit score requires Experian/TransUnion/Equifax APIs with separate enrollment and compliance. Out of scope. Gate 10 implements credit utilization as a useful proxy using balance data Teller already provides.

**Transaction Storage:** Gate 8 fetches transactions on demand from Teller. No local storage table. This avoids a new migration and sync job. If persistent transaction history is needed later, add a `transactions` table and sync during the scheduled poll.

**Cut Lines (if session runs long):**
- Gates 0-12: Core app. All should complete.
- Gates 13-17: Testing and polish. Important but the app works without them.
- Lowest-priority features within 0-12: Gate 10 (credit utilization) and Gate 12 (CSV export).
