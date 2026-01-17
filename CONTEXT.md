# Project Context

This document provides context about the current state of the Net Worth Projection App for future development sessions.

## Project Overview

A single-user PWA for 60-day financial projections. Connects to banks via Teller.io, polls balances 3x daily, stores data in Supabase, and provides two projection modes: Net Worth (total or liquid) and Cash Flow (primary account with CC autopay deductions).

## Architecture Decisions

### Database: Supabase (PostgreSQL)
- Chosen over Google Sheets for complex projection queries
- Schema includes: enrollments, accounts, balances, recurring_rules
- **Current State**: RLS disabled (intentionally) - see TODO.md
- All server-side operations use `service_role` key (bypasses RLS)

### Hosting: Netlify
- Chosen for existing workflows and native scheduled functions
- Scheduled polling runs 3x daily (6am, 12pm, 6pm ET)
- Function located at: `netlify/functions/scheduled-poll.ts`

### Bank API: Teller.io
- Uses mTLS authentication (certificate + private key stored as base64 env vars)
- Certificate files: `certificate.pem` and `private_key.pem`
- Environment variables: `TELLER_CERT_B64`, `TELLER_KEY_B64`
- Credit card due dates: Manual entry required (Teller doesn't provide this)

### Token Storage: Supabase enrollments table
- Access tokens stored encrypted in `enrollments` table
- One enrollment per bank connection

### Retirement Accounts
- Flagged with `is_liquid = false` for accounts with subtypes: ira, roth_ira, 401k, 403b, 529
- Dashboard has toggle for "Total" vs "Liquid" net worth

## Current Implementation Status

### ✅ Completed
- Project setup (Next.js 16, TypeScript, Tailwind)
- Teller mTLS integration and test endpoint
- Supabase schema and migrations
- Teller Connect flow
- Onboarding pages (accounts, credit cards, primary account)
- Projection engine (60-day projections)
- Dashboard with chart visualization
- Scheduled polling function
- Design system implementation
- Error handling for edge cases (missing balances, failed upserts, etc.)

### 🔄 In Progress
- Initial setup and testing

### 📋 Planned (see TODO.md)
- Enable RLS on database tables
- Recurring rules management UI
- Account management features
- Transaction history
- Export functionality

## Key Files & Structure

```
finance-dashboard/
├── app/
│   ├── api/
│   │   ├── projection/route.ts      # Projection data API
│   │   └── teller/
│   │       ├── callback/route.ts    # Teller Connect callback
│   │       └── test/route.ts        # mTLS test endpoint
│   ├── connect/page.tsx              # Teller Connect page
│   ├── onboarding/                   # Onboarding flow
│   └── page.tsx                      # Main dashboard
├── lib/
│   ├── projection.ts                 # 60-day projection engine
│   ├── supabase.ts                   # Supabase clients
│   └── teller.ts                     # Teller API utilities
├── netlify/
│   └── functions/
│       └── scheduled-poll.ts         # Scheduled balance polling
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql    # Database schema

```

## Environment Variables

All required in `.env.local`:
- `TELLER_CERT_B64` - Base64 encoded certificate.pem
- `TELLER_KEY_B64` - Base64 encoded private_key.pem
- `TELLER_APP_ID` - Teller Application ID
- `TELLER_ENV` - "sandbox" or "production"
- `NEXT_PUBLIC_TELLER_APP_ID` - Same as TELLER_APP_ID
- `NEXT_PUBLIC_TELLER_ENV` - Same as TELLER_ENV
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_KEY` - Supabase service_role key (secret!)

## Design System

- Colors: cream (#F0EFEA), charcoal (#141413), terra (#D97757), border-subtle (#E6E4DD)
- Fonts: Newsreader (serif) for headings, DM Sans (sans-serif) for body
- Implemented in `tailwind.config.ts` and `app/globals.css`

## Projection Logic

### Net Worth Mode
- **Total**: All accounts (depository + credit, including retirement)
- **Liquid**: Only liquid accounts (excludes retirement accounts)
- Formula: Sum of depository balances - Sum of credit balances

### Cash Flow Mode
- Uses primary payment account balance as starting point
- Applies recurring rules (weekly, biweekly, monthly, once)
- Deducts credit card autopay on due dates
- Shows projected balance over 60 days

## Known Limitations

1. **RLS Disabled**: Intentionally disabled for single-user app. Should be enabled for production (see TODO.md)
2. **No Recurring Rules UI**: Rules must be added directly to database `recurring_rules` table
3. **Manual CC Due Dates**: Teller doesn't provide due dates, so users must enter manually during onboarding
4. **Single User**: App designed for single user, no multi-user support

## Recent Changes

See CHANGELOG.md for detailed change history.

## Testing

- Teller mTLS test: `/api/teller/test` (uses sandbox test token)
- Local dev: `npm run dev` → http://localhost:3000
- Connect flow: `/connect` → Teller Connect → Onboarding → Dashboard

## Deployment

- Netlify: Connect repo, set environment variables, deploy
- Scheduled function runs automatically at configured times
- Ensure all environment variables are set in Netlify dashboard
