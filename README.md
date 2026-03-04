# Net Worth Projection App

A single-user PWA for 60-day financial projections. Connects to banks via Teller.io, polls 3x daily, stores data in Supabase, and provides two projection modes: Net Worth (total or liquid) and Cash Flow (primary account with CC autopay deductions).

## Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** - History of all changes made to the project
- **[TODO.md](./TODO.md)** - Future improvements and planned features
- **[SANDBOX_VS_PRODUCTION.md](./SANDBOX_VS_PRODUCTION.md)** - Guide explaining sandbox vs production environments

## Features

- **Bank Integration**: Connect accounts via Teller.io with mTLS authentication
- **Automated Polling**: Scheduled balance updates 3x daily (6am, 12pm, 6pm ET)
- **Projection Modes**:
  - Net Worth: Total or Liquid (excludes retirement accounts)
  - Cash Flow: Primary payment account with credit card autopay deductions
- **Recurring Rules**: Add, edit, and delete income/expense rules (weekly, biweekly, monthly, one-time) via the Rules page
- **Transaction History**: Per-account transaction view with pagination on the dashboard
- **Onboarding Flow**: Capture credit card due dates and primary payment account
- **Export**: Download projection data as CSV from the dashboard
- **Design System**: Warm cream background, charcoal text, terra-cotta accents, Newsreader serif headings, DM Sans body

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Teller API Configuration
TELLER_CERT_B64=<base64 encoded certificate.pem>
TELLER_KEY_B64=<base64 encoded private_key.key>
TELLER_APP_ID=<from Teller dashboard>
TELLER_ENV=sandbox  # or 'production'
NEXT_PUBLIC_TELLER_APP_ID=<from Teller dashboard>
NEXT_PUBLIC_TELLER_ENV=sandbox  # or 'production'

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=<supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
SUPABASE_SERVICE_KEY=<supabase service role key — keep secret>
```

To encode certificates to base64:

```bash
# Certificate
cat certificate.pem | base64 | tr -d '\n' > cert_b64.txt

# Private key
cat private_key.key | base64 | tr -d '\n' > key_b64.txt
```

### 3. Supabase Setup

Run the migrations in `supabase/migrations/` in order using the Supabase dashboard SQL editor.

### 4. Development

```bash
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 5. Testing the Teller Connection

Before connecting a real account, verify mTLS works:

- Visit `/api/teller/test` to confirm the certificate + key env vars load correctly
- This uses a sandbox test token and should return a list of test accounts

## Running Tests

```bash
# Unit tests (Vitest)
bun run test

# Type check
bun tsc --noEmit

# Lint
bun run lint
```

## Project Structure

```
finance-dashboard/
├── app/
│   ├── api/
│   │   ├── accounts/          # Account data + balance refresh
│   │   ├── history/           # Historical net worth data
│   │   ├── projection/        # 60-day projection API
│   │   ├── rules/             # Recurring rules CRUD
│   │   └── teller/            # Teller integration endpoints
│   ├── connect/               # Teller Connect page
│   ├── dashboard/             # Main dashboard
│   ├── onboarding/            # Onboarding flow
│   │   ├── accounts/          # Account discovery
│   │   ├── credit-cards/      # CC due date setup
│   │   └── primary/           # Primary payment account selection
│   └── rules/                 # Recurring rules management page
├── lib/
│   ├── projection.ts          # 60-day projection engine
│   ├── supabase.ts            # Supabase clients
│   ├── teller.ts              # Teller API utilities + types
│   └── validations.ts         # Zod schemas
├── netlify/
│   └── functions/
│       └── scheduled-poll.ts  # Scheduled balance polling
└── supabase/
    └── migrations/            # SQL migration files
```

## Deployment

### Netlify

1. Connect your repository to Netlify
2. Set all environment variables listed above in the Netlify dashboard
3. Set build command to `bun install && bun run build`
4. Deploy. The scheduled function runs automatically at 6am, 12pm, and 6pm ET.

## Usage Flow

1. **Landing Page**: Visit `/` to see the app introduction
2. **Connect Bank**: Click "Get Started" to link your bank via Teller Connect
3. **Onboarding**:
   - Review discovered accounts
   - Set credit card payment due dates
   - Select your primary payment account
4. **Dashboard**: View 60-day projections in Net Worth or Cash Flow mode
5. **Rules**: Add recurring income and expenses at `/rules`

## Technologies

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - PostgreSQL database with RLS
- **Teller.io** - Bank data API (mTLS)
- **Recharts** - Data visualization
- **Framer Motion** - Animations
- **Netlify Functions** - Scheduled polling
- **Vitest** - Unit testing
- **Bun** - Package manager and runtime
