# Net Worth Projection App

A single-user PWA for 60-day financial projections. Connects to banks via Teller.io, polls 3x daily, stores data in Supabase, and provides two projection modes: Net Worth (total or liquid) and Cash Flow (primary account with CC autopay deductions).

## Documentation

- **[CONTEXT.md](./CONTEXT.md)** - Current project state, architecture decisions, and implementation details
- **[CHANGELOG.md](./CHANGELOG.md)** - History of all changes made to the project
- **[TODO.md](./TODO.md)** - Future improvements and planned features
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** - Next steps guide and solutions for connecting unsupported banks (like SoFi)
- **[SANDBOX_VS_PRODUCTION.md](./SANDBOX_VS_PRODUCTION.md)** - Guide explaining sandbox vs production environments and why real bank credentials fail in sandbox

## Features

- **Bank Integration**: Connect accounts via Teller.io with mTLS authentication
- **Automated Polling**: Scheduled balance updates 3x daily (6am, 12pm, 6pm ET)
- **Projection Modes**:
  - Net Worth: Total or Liquid (excludes retirement accounts), 15/30/60 day window
  - Cash Flow: Primary payment account with credit card autopay deductions, 30/45 day window
- **Onboarding Flow**: Capture credit card due dates and primary payment account
- **PWA**: Installable, with web app manifest and icons
- **Design System**: Warm cream background, charcoal text, terra-cotta accents, Newsreader serif headings, DM Sans body

## Setup

### 1. Environment Variables

Create a `.env.local` file in the project root. All variables are required.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key — bypasses RLS, server-side only |
| `NEXT_PUBLIC_TELLER_APP_ID` | Your Teller application ID from the Teller dashboard |
| `NEXT_PUBLIC_TELLER_ENV` | Teller environment: `sandbox` or `development` |
| `TELLER_CERT_B64` | Base64-encoded Teller mTLS certificate (`certificate.pem`) |
| `TELLER_KEY_B64` | Base64-encoded Teller mTLS private key (`private_key.key`) |

To encode Teller certificates to base64:

```bash
cat certificate.pem | base64 | tr -d '\n'   # paste as TELLER_CERT_B64
cat private_key.key | base64 | tr -d '\n'   # paste as TELLER_KEY_B64
```

### 2. Supabase Setup

Run the migrations **in order** in your Supabase SQL editor (Dashboard → SQL Editor):

| Order | File | Purpose |
|---|---|---|
| 1 | `supabase/migrations/001_initial_schema.sql` | Creates all tables and indexes |
| 2 | `supabase/migrations/002_mock_data.sql` | *(Optional)* Inserts 8 test accounts |
| 3 | `supabase/migrations/003_auth_and_rls.sql` | Adds auth columns and RLS policies |
| 4 | `supabase/migrations/004_assign_mock_data.sql` | *(Optional)* Assigns mock data to first signed-in user |

Migrations 2 and 4 are only needed for local testing without a real bank connection. Run migration 4 **after** creating your first user account.

### 3. Install Dependencies

```bash
npm install
```

### 4. Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

The dev server validates all required env vars on startup and throws a clear error listing any that are missing.

### 5. Testing the Teller Connection

Visit `/api/teller/test` to verify the mTLS connection to Teller's API works before connecting a real account.

## Project Structure

```
net-worth-projection-app/
├── app/
│   ├── page.tsx                      — Root redirect (auth → /dashboard, else → /landing)
│   ├── landing/page.tsx              — Public landing page
│   ├── login/page.tsx                — Login / signup
│   ├── connect/page.tsx              — Teller Connect (auth-protected)
│   ├── dashboard/page.tsx            — Main dashboard: chart, accounts, rules modal
│   ├── rules/page.tsx                — Full rules CRUD page
│   ├── onboarding/
│   │   ├── accounts/page.tsx         — Post-connect account review
│   │   ├── credit-cards/page.tsx     — CC due date entry
│   │   └── primary/page.tsx          — Primary payment account selection
│   └── api/
│       ├── accounts/route.ts         — GET accounts with latest balances
│       ├── accounts/[id]/route.ts    — DELETE account (cascades balances)
│       ├── accounts/refresh/route.ts — POST: poll Teller and store new balances
│       ├── projection/route.ts       — GET 60-day projection
│       ├── rules/route.ts            — GET + POST recurring rules
│       ├── rules/[id]/route.ts       — PATCH + DELETE rules
│       ├── teller/callback/route.ts  — Teller Connect callback (stores enrollment)
│       └── teller/test/route.ts      — mTLS connection test
├── lib/
│   ├── supabase.ts                   — Supabase client factories + env validation
│   ├── projection.ts                 — 60-day projection engine
│   ├── teller.ts                     — Teller API utilities
│   └── validations.ts                — Zod schemas
├── middleware.ts                     — Route protection
├── netlify.toml                      — Netlify build config
├── netlify/functions/
│   └── scheduled-poll.ts             — Polls Teller 3x daily via Netlify scheduled function
└── supabase/migrations/
    ├── 001_initial_schema.sql
    ├── 002_mock_data.sql
    ├── 003_auth_and_rls.sql
    └── 004_assign_mock_data.sql
```

## Deployment (Netlify)

1. **Connect repository** to Netlify (New site → Import from Git)
2. **Build settings** are defined in `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `.next`
3. **Set environment variables** in Netlify → Site configuration → Environment variables. Add all seven variables from the table above.
4. **Deploy** — Netlify runs the build and activates the `@netlify/plugin-nextjs` adapter automatically.
5. **Scheduled polling** — the `netlify/functions/scheduled-poll.ts` function runs at 6am, 12pm, and 6pm ET (cron: `0 11,17,23 * * *`) using Netlify's scheduled functions feature. No additional configuration needed.

## Usage Flow

1. **Sign up / Sign in** at `/login` — new users are redirected to `/connect` automatically
2. **Connect Bank** — link your bank account via Teller Connect
3. **Onboarding**:
   - Review discovered accounts
   - Set credit card payment due dates
   - Select primary payment account
4. **Dashboard** — view 60-day projections in Net Worth or Cash Flow mode

## Technologies

- **Next.js 16** — React framework
- **TypeScript** — Type safety
- **Tailwind CSS v4** — Styling
- **Supabase** — PostgreSQL database with RLS
- **Teller.io** — Bank data API (mTLS)
- **Recharts** — Data visualization
- **Framer Motion** — Animations
- **Netlify Functions** — Scheduled balance polling
