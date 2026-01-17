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
  - Net Worth: Total or Liquid (excludes retirement accounts)
  - Cash Flow: Primary payment account with credit card autopay deductions
- **Onboarding Flow**: Capture credit card due dates and primary payment account
- **Design System**: Warm cream background, charcoal text, terra-cotta accents, Newsreader serif headings, DM Sans body

## Setup

### 1. Environment Variables

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
NEXT_PUBLIC_SUPABASE_URL=<supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
SUPABASE_SERVICE_KEY=<supabase service role key>
```

To encode certificates to base64:
```bash
# Certificate
cat certificate.pem | base64 | tr -d '\n' > cert_b64.txt

# Private key
cat private_key.key | base64 | tr -d '\n' > key_b64.txt
```

### 2. Supabase Setup

Run the migration in `supabase/migrations/001_initial_schema.sql` in your Supabase dashboard SQL editor.

### 3. Install Dependencies

```bash
npm install
```

### 4. Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 5. Testing Teller Connection

Before proceeding, test the Teller mTLS connection:
- Visit `/api/teller/test` to verify the connection works
- This uses a sandbox test token from Teller docs

## Project Structure

```
finance-dashboard/
├── app/
│   ├── api/
│   │   ├── projection/        # Projection data API
│   │   └── teller/             # Teller integration endpoints
│   ├── connect/                # Teller Connect page
│   ├── onboarding/             # Onboarding flow
│   │   ├── accounts/           # Account discovery
│   │   ├── credit-cards/       # CC due date setup
│   │   └── primary/            # Primary payment account selection
│   └── page.tsx                # Main dashboard
├── lib/
│   ├── projection.ts           # Projection engine
│   ├── supabase.ts             # Supabase clients
│   └── teller.ts               # Teller API utilities
├── netlify/
│   └── functions/
│       └── scheduled-poll.ts   # Scheduled balance polling
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

## Deployment

### Netlify

1. Connect your repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy - the scheduled function will run automatically at 6am, 12pm, and 6pm ET

## Usage Flow

1. **Landing Page**: Visit `/` to see the app introduction and value proposition
2. **Connect Bank**: Click "Get Started" to link your bank account via Teller
3. **Onboarding**: 
   - Review discovered accounts
   - Set credit card payment due dates
   - Select primary payment account
4. **Dashboard**: View 60-day projections with Net Worth or Cash Flow modes

## Mock Data for Testing

To test the app without connecting real bank accounts, run the mock data migration:

1. Open your Supabase SQL editor
2. Run `supabase/migrations/002_mock_data.sql`
3. This creates 8 test accounts (2 retirement, 3 credit cards, 3 checking/savings) with realistic balances
4. The dashboard will automatically display these accounts

## Technologies

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - PostgreSQL database
- **Teller.io** - Bank data API
- **Recharts** - Data visualization
- **Framer Motion** - Animations
- **Netlify Functions** - Scheduled polling
