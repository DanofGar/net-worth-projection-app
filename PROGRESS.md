# PROGRESS.md — Net Worth App Overnight Build

## Current Gate: COMPLETE (all 18 gates done)

## Completed

### Gate 0: Setup & Bun Migration ✅
Migrated from npm to Bun (bun.lock created, package-lock.json deleted). Installed vitest, testing-library, playwright with chromium. Created vitest.config.ts (jsdom, @/* alias) and playwright.config.ts (chromium only). Added test/test:run/test:e2e scripts. Build passes.

### Gate 1: Database & Security Hardening ✅
Middleware uses getUser() instead of getSession(). Teller callback validates body with tellerCallbackSchema.safeParse(). Accounts route uses batch balance query (fixes N+1). Migration 005 enforces NOT NULL on user_id columns.

### Gate 2: Projection Engine Refactor ✅
Extracted pure calculateProjection() from dashboard page into lib/projection.ts. Exported ruleAppliesToDate. Added TypeScript interfaces for all inputs/outputs.

### Gate 3: Chart & Display Bug Fixes ✅
Default view mode set to cash_flow. Cash Flow pill moved to primary position. Y-axis uses compact formatter ($10K/$1.5M). X-axis interval adapts to timeframe. Timeframe controls visible in both modes.

### Gate 4: UI Layout Fixes ✅
Date pickers clickable via container onClick. Removed double-fetch bug (fetchProjection inside fetchAccounts). Memoized createBrowserClient with useMemo.

### Gate 5: Loading States & Error Handling ✅
Created Toast component with auto-dismiss. Added loading skeletons for chart, value card, account cards. Error card with retry button. Loading states on Sign Out and Create Rule buttons.

### Gate 6: Rules UI Polish ✅
Added "Manage Rules" link to /rules page. Quick Add Rule modal on dashboard. Income/expense green/red left border accents on rule cards.

### Gate 7: Manual Refresh & Account Management ✅
Created refresh route for on-demand balance polling. Account PATCH/DELETE endpoints. "Updated X ago" timestamps. Remove account button.

### Gate 8: Transaction History ✅
Added tellerFetchTransactions to lib/teller. Expandable transaction list per account card. On-demand fetch from Teller API.

### Gate 9: Net Worth Trend ✅
Created history API aggregating balances by day. Historical net worth chart with change indicator.

### Gate 10: Credit Utilization ✅
Credit utilization progress bar on credit card accounts. Visual indicator with percentage.

### Gate 11: Auth Hardening ✅
Reset password and update password pages. Session expiry detection in middleware with redirect parameter. Expired session toast on login page.

### Gate 12: CSV Export ✅
CSV export button in chart header. Downloads projection data as CSV. Suspense boundary fix for login page (Next.js 16 requirement).

### Gate 13: Projection Unit Tests ✅
48 tests covering calculateProjection and ruleAppliesToDate. UTC timezone normalization throughout projection engine.

### Gate 14: Validation Unit Tests ✅
69 tests covering all Zod schemas (recurringRule, accountUpdate, projectionQuery, tellerCallback).

### Gate 15: Component Tests ✅
8 tests for Toast component. Created vitest.setup.ts with jest-dom matchers and env stubs.

### Gate 16: E2E Tests ✅
Auth and navigation Playwright specs (19 tests total, 4 skipped requiring real auth). playwright.config.ts with webServer config.

### Gate 17: Final Polish ✅
Typed tellerFetch with generics. Exported TellerAccount/TellerBalance/TellerTransaction interfaces. Removed stale docs. Updated README.

## Blockers

(none)

## Notes

- 125 unit/component tests passing via vitest
- Build clean with 21 routes
- All work on branch: build/overnight-comprehensive
- vitest.config.ts excludes e2e/** to prevent Playwright/Vitest conflicts
