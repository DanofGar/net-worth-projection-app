# PROGRESS.md — Net Worth App Overnight Build

## Current Gate: 1

## Completed

### Gate 0: Setup & Bun Migration ✅
Migrated from npm to Bun (bun.lock created, package-lock.json deleted). Installed vitest, testing-library, playwright with chromium. Created vitest.config.ts (jsdom, @/* alias) and playwright.config.ts (chromium only). Added test/test:run/test:e2e scripts. Build passes.

## Blockers

(none)

## Notes

- Next.js 16.1.3 warns that "middleware" convention is deprecated in favor of "proxy". Not blocking but worth noting for Gate 1 middleware work.
- Bun binary at ~/.bun/bin/bun confirmed working.
