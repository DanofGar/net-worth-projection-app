# Completion Checklist

Track progress across Ralph loop iterations. Update this file after each task.

## Status Key
- [ ] Not started
- [x] Complete

---

## Phase 1: Infrastructure & Dev Experience

- [ ] **T1** — Fix Next.js 16 middleware deprecation: rename `middleware.ts` → `proxy.ts` (or suppress if just a cosmetic warning per Next.js docs). Verify build still works.
- [x] **T2** — Create `supabase/migrations/004_assign_mock_data.sql` — assigns mock enrollment to first user so devs can test without connecting a real bank.
- [x] **T3** — Fixed `lib/supabase.ts`: removed module-level throws, use placeholder URL so Supabase client doesn't crash at build time when env vars are absent. Build now passes without `.env.local`.

## Phase 2: Core UX — High Impact

- [x] **T4** — Added **manual balance refresh** to dashboard:
  - Created `POST /api/accounts/refresh` endpoint — polls Teller for all user enrollments, inserts new balance records
  - Added "Sync Balances" button to dashboard header with loading state

- [x] **T5** — Added **"last synced" timestamp** to account cards:
  - `/api/accounts` now returns `last_synced` (polled_at) per account
  - Each account card shows "Synced Xm/h/d ago" below the balance

- [x] **T6** — Replaced **`alert()` calls** with inline error UI:
  - `app/connect/page.tsx`: handleSuccess now sets `connectError` state
  - Error renders as styled red banner below the Connect button
  - Also hooked `onError` callback to set the same error state

- [x] **T7** — Add **account deletion** capability:
  - Add `DELETE /api/accounts/[id]` endpoint (deletes account and its balances, cascades from schema)
  - Add a delete button (trash icon) on each account card in dashboard, with confirmation UI (inline, no browser confirm())
  - After deletion, refetch accounts and projection

## Phase 3: First-Time User Flow

- [x] **T8** — Improve **new user onboarding flow**:
  - After successful signup (in `app/login/page.tsx`), redirect to `/connect` instead of `/dashboard`
  - Show clear "Step 1 of 3: Connect Your Bank" progress indicator on `/connect` page for new users (account count === 0)
  - `app/dashboard/page.tsx` empty state: replace plain button with a guided 3-step visual (Connect → Configure → Profit)

## Phase 4: PWA

- [x] **T9** — Added **web app manifest** for PWA installability:
  - Created `public/manifest.json` (name, colors, icons, standalone display)
  - Created SVG icons at `public/icons/icon-192.svg` and `icon-512.svg` (terra bg, $ sign)
  - Added manifest, themeColor, and appleWebApp metadata to `app/layout.tsx`

## Phase 5: Polish

- [x] **T10** — **Skeleton loading states** for dashboard:
  - Replace "Loading projection..." text in chart area with a skeleton rectangle (animated pulse)
  - Replace account card loading state with skeleton card outlines
  - Use pure Tailwind `animate-pulse` — no extra libraries

- [x] **T11** — **Mobile responsiveness audit**:
  - Dashboard header (too many buttons on mobile) — collapse to a hamburger menu or stack buttons
  - Chart: verify ResponsiveContainer works on 375px width
  - Account cards grid: already uses responsive grid, but verify padding/font sizes on mobile

- [x] **T12** — **Time frame controls for Net Worth** mode (currently only Cash Flow has 30/45 day options):
  - Add 15/30/60 day selector for Net Worth mode as well
  - Currently timeFrame state only affects cash_flow display — wire it to net_worth too

## Phase 6: Production Readiness

- [x] **T13** — **ENV template validation**: add a startup check (in `lib/supabase.ts`) that throws a clear dev-mode error if required env vars are missing, with a list of which ones
- [ ] **T14** — **Netlify deployment validation**: add a `netlify.toml` `[build]` section with `command = "npm run build"` and `publish = ".next"`, verify scheduled function cron syntax matches Netlify format
- [ ] **T15** — **Update README** with correct deployment steps, env var table, and actual Supabase migration order

---

## Notes for Loop

- After each task, run `npx tsc --noEmit` to check TypeScript
- Then commit with message: `complete T<N>: <short description>`
- Update this file before committing
- The build requires env vars to collect page data — TypeScript check is the real gate
