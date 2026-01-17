# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Initial project setup with Next.js 16, TypeScript, Tailwind CSS
- Teller.io integration with mTLS authentication
- Supabase database schema (enrollments, accounts, balances, recurring_rules)
- Teller Connect flow for bank account linking
- Onboarding pages (accounts discovery, credit card due dates, primary account selection)
- Projection engine supporting Net Worth (total/liquid) and Cash Flow modes
- Dashboard with Recharts visualization
- Scheduled polling function for Netlify (3x daily balance updates)
- Custom design system (cream, charcoal, terra colors; Newsreader/DM Sans fonts)
- Landing page (`/landing`) with hero section, features, and subtle animations
- Mock data migration script (`002_mock_data.sql`) with 8 test accounts for development

### Fixed
- Bug: `.single()` throwing errors when no balance records exist - changed to `.maybeSingle()` with graceful handling
- Bug: Account upsert operations not checking for errors - added error handling and logging
- Bug: `handleSuccess` callback not verifying API response - added response validation and error alerts
- Bug: `handleSelect` updating state before database operations complete - reordered to update DB first, then state
- Bug: Tailwind v4 configuration causing invisible buttons - fixed `@theme` configuration in `globals.css`
- Bug: TellerConnect hydration error from nested button elements - replaced with span element
- UI: Added "Get Started" screen when no accounts are connected with clear call-to-action
- UI: Added "+ Add Account" button in dashboard header for easy navigation

### Enhanced
- Teller Connect: Fixed invalid product configuration - changed from `['accounts', 'verify']` to `['balance', 'verify']` (valid Teller products)
- Teller Connect: Added `onError` handler to capture connection errors
- Connect page: Improved messaging ("Connect your first account") and added back navigation to landing page
- Root page: Added automatic redirect to landing page when no accounts exist
- Documentation: Added NEXT_STEPS.md with guide for connecting SoFi and other unsupported banks
- Documentation: Added SANDBOX_VS_PRODUCTION.md explaining sandbox vs production environments and why real bank credentials fail in sandbox
- Documentation: Updated SANDBOX_VS_PRODUCTION.md with specific test credentials (`user_good`, `verify.microdeposit`)
- Documentation: Updated README.md with landing page info and mock data instructions

### Security
- Environment variables properly configured for Teller mTLS and Supabase
- Service role key kept server-side only
- Note: RLS (Row Level Security) intentionally disabled for single-user app - see TODO.md

### Known Issues
- RLS not enabled on database tables (documented in TODO.md)
- No recurring rules management UI (rules must be added directly to database)
