# PROGRESS.md — Net Worth App Overnight Build

## Current Gate: 2

## Completed

### Gate 0: Setup & Bun Migration ✅
Migrated from npm to Bun (bun.lock created, package-lock.json deleted). Installed vitest, testing-library, playwright with chromium. Created vitest.config.ts (jsdom, @/* alias) and playwright.config.ts (chromium only). Added test/test:run/test:e2e scripts. Build passes.

### Gate 1: Database & Security Hardening ✅
Middleware uses getUser() instead of getSession(). Teller callback validates body with tellerCallbackSchema.safeParse(). Accounts route uses batch balance query (fixes N+1). Migration 005 enforces NOT NULL on user_id columns.

## Blockers

(none)

## Notes

- Next.js 16.1.3 warns that "middleware" convention is deprecated in favor of "proxy". Not blocking.
- Bun binary at ~/.bun/bin/bun confirmed working.
- The balance batch query pattern in accounts/route.ts now mirrors projection.ts approach.
