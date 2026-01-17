# TODO / Future Improvements

## Security

- [ ] **Enable Row Level Security (RLS)** on all database tables
  - Currently disabled for single-user app simplicity
  - All server-side operations use `service_role` key which bypasses RLS
  - Should be enabled for production best practices and to satisfy Supabase Security Advisor
  - Will need to add RLS policies (likely permissive for single-user, but adds security layer)

## Features

- [ ] Add recurring rules management UI (currently only in database)
- [ ] Add ability to edit/delete accounts
- [ ] Add ability to manually refresh account balances
- [ ] Add transaction history view
- [ ] Add export functionality for projections

## Technical Debt

- [ ] Add comprehensive error handling and user feedback
- [ ] Add loading states for all async operations
- [ ] Add unit tests for projection engine
- [ ] Add integration tests for Teller API
- [ ] Optimize balance queries (currently fetches all, could paginate)

## Documentation

- [ ] Add API documentation
- [ ] Add deployment guide
- [ ] Add troubleshooting guide
