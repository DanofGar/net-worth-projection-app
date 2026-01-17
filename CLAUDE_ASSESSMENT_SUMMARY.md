# Summary for Claude: Current State Assessment & Fix Instructions

## Executive Summary

The Net Worth Projection App has been migrated to use authentication and RLS, but there are **two critical issues** preventing proper functionality:

1. **Mock data is invisible** to authenticated users (RLS filtering issue)
2. **Navigation logic is inconsistent** - users sometimes see "connect accounts" prompts inappropriately

Additionally, the landing page is intact and working correctly.

---

## Issue 1: Landing Page Status ✅

**Status:** No issues - landing page is intact

- **Location:** `app/landing/page.tsx`
- **Status:** Fully functional with animations, hero section, features
- **Access:** Available at `/landing` route
- **Note:** Root `/` now redirects authenticated users to `/dashboard` and unauthenticated to `/landing` - this is intentional

---

## Issue 2: Mock Data Visibility ❌ CRITICAL

### Problem
Mock data exists in the database but authenticated users cannot see it.

### Root Cause
1. Migration `002_mock_data.sql` was run **before** `003_auth_and_rls.sql`
2. Mock enrollment was created with `user_id = NULL` (column didn't exist yet)
3. After RLS was enabled, the enrollment has `user_id = NULL`
4. RLS policies filter by `auth.uid() = user_id`, so NULL values are invisible

### Evidence
- Mock data exists: 8 accounts (2 retirement, 3 credit cards, 3 checking/savings) with balances
- Enrollment `enr_mock_test_12345` has `user_id = NULL`
- Authenticated users see empty dashboard

### Solution
Run this SQL in Supabase (replace with actual user_id):
```sql
-- First, get your user_id:
SELECT id, email FROM auth.users;

-- Then assign mock data:
UPDATE enrollments 
SET user_id = 'YOUR_USER_ID_HERE'
WHERE teller_enrollment_id = 'enr_mock_test_12345';
```

Or create migration `004_assign_mock_data.sql`:
```sql
UPDATE enrollments 
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE teller_enrollment_id = 'enr_mock_test_12345'
AND user_id IS NULL;
```

---

## Issue 3: Navigation Logic Problems ❌

### Problem 3.1: `/connect` Route Not Protected
**Severity:** High (Security + UX)

- **Current:** `/connect` is accessible without authentication
- **Expected:** Should redirect to `/login` if not authenticated
- **Location:** `app/connect/page.tsx` - missing auth check
- **Impact:** Unauthenticated users can access connect page, causing confusion

### Problem 3.2: Inconsistent Back Navigation
**Severity:** Medium (UX)

- **Current:** "Back to home" always links to `/landing`
- **Expected:** 
  - Authenticated users → `/dashboard`
  - Unauthenticated users → `/landing`
- **Location:** `app/connect/page.tsx` line 43
- **Impact:** Logged-in users get sent to landing page instead of dashboard

### Problem 3.3: Static "First Account" Messaging
**Severity:** Low (UX Polish)

- **Current:** Always says "Connect your first account"
- **Expected:** 
  - No accounts → "Connect your first account"
  - Has accounts → "Connect another account"
- **Location:** `app/connect/page.tsx` line 54
- **Impact:** Confusing for users who already have accounts

### Problem 3.4: Navigation Flow After Login
**Severity:** Medium (UX)

- **Current:** Login → Dashboard → (if empty) → Empty state → Connect button
- **Issue:** Sometimes prompts to connect accounts when user already has accounts (likely due to mock data visibility issue)
- **Consideration:** May need better state management for account loading

---

## Test Plan for Better Visibility

### Test Suite 1: Authentication & Routing
```
1. Visit / while logged out → Should redirect to /landing
2. Click "Get Started" → Should go to /connect
3. Access /connect directly while logged out → Should redirect to /login
4. Log in → Should redirect to /dashboard
5. If no accounts → Empty state with "Connect Account" button
6. If has accounts → Dashboard with data
```

### Test Suite 2: Mock Data Verification
```
1. Check database: SELECT * FROM enrollments WHERE teller_enrollment_id = 'enr_mock_test_12345';
2. Verify user_id is NULL
3. Log in as user
4. Get user_id: SELECT id, email FROM auth.users;
5. Query accounts: SELECT COUNT(*) FROM accounts 
   WHERE enrollment_id IN (
     SELECT id FROM enrollments WHERE user_id = 'YOUR_USER_ID'
   );
6. Should return 0 (because enrollment has NULL user_id)
7. After assigning user_id, should return 8
```

### Test Suite 3: Navigation Consistency
```
1. Log in with accounts
2. Visit /connect → Should say "Connect another account"
3. Click back → Should go to /dashboard (not /landing)
4. Log out
5. Visit /connect → Should redirect to /login
6. After login, visit /connect → Should work
```

### Test Suite 4: Account Connection Flow
```
1. Log in with no accounts
2. Navigate to /connect
3. Complete Teller Connect
4. Should redirect to /onboarding/accounts
5. Complete onboarding
6. Should end at /dashboard with accounts visible
```

---

## Fix Instructions for Claude

### Priority 1: Fix Mock Data Assignment (CRITICAL)
**Action:** Create migration or provide SQL to assign mock data to user

**File to create:** `supabase/migrations/004_assign_mock_data.sql`
```sql
-- Assign mock data to first authenticated user
UPDATE enrollments 
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE teller_enrollment_id = 'enr_mock_test_12345'
AND user_id IS NULL;
```

**Or** provide manual SQL instructions for user to run in Supabase dashboard.

### Priority 2: Protect `/connect` Route (HIGH)
**Action:** Add authentication check to `/connect` page

**File to modify:** `app/connect/page.tsx`

**Changes needed:**
1. Import `createBrowserClient` and `useEffect`
2. Add auth check on component mount
3. Redirect to `/login` if not authenticated
4. Show loading state during auth check

### Priority 3: Fix Back Navigation (MEDIUM)
**Action:** Make back button context-aware

**File to modify:** `app/connect/page.tsx`

**Changes needed:**
1. Check authentication state
2. Link to `/dashboard` if authenticated, `/landing` if not
3. Or use `router.back()` for better UX

### Priority 4: Dynamic Messaging (LOW)
**Action:** Make connect page messaging context-aware

**File to modify:** `app/connect/page.tsx`

**Changes needed:**
1. Fetch account count on mount
2. Update heading based on account count
3. Show "Connect your first account" vs "Connect another account"

---

## Current File State

### Working Files ✅
- `app/landing/page.tsx` - Landing page intact
- `app/dashboard/page.tsx` - Dashboard functional (shows empty state correctly)
- `app/login/page.tsx` - Login works
- `middleware.ts` - Basic routing protection works
- `app/api/accounts/route.ts` - API works (returns empty array due to RLS)

### Files Needing Fixes ❌
- `app/connect/page.tsx` - Missing auth check, wrong back link, static messaging
- Mock data in database - Needs user_id assignment

### Migration Status
- ✅ `001_initial_schema.sql` - Run
- ✅ `002_mock_data.sql` - Run (but user_id is NULL)
- ✅ `003_auth_and_rls.sql` - Run
- ❌ `004_assign_mock_data.sql` - **NEEDS TO BE CREATED**

---

## Expected Behavior After Fixes

### Scenario 1: New User (No Accounts)
1. Visit `/` → Redirects to `/landing`
2. Click "Get Started" → Goes to `/connect`
3. `/connect` checks auth → Redirects to `/login` (if not logged in)
4. After login → Redirects to `/dashboard`
5. Dashboard shows empty state → "Connect Your First Account"
6. Click button → Goes to `/connect` (now authenticated)
7. Complete Teller Connect → Onboarding flow → Dashboard with accounts

### Scenario 2: Returning User (Has Accounts)
1. Visit `/` → Redirects to `/dashboard` (if logged in)
2. Dashboard shows accounts and projections
3. Click "+ Add Account" → Goes to `/connect`
4. `/connect` shows "Connect another account" (not "first")
5. Back button → Goes to `/dashboard` (not `/landing`)

### Scenario 3: Mock Data User
1. After assigning mock data to user_id
2. Login → Dashboard shows 8 accounts immediately
3. All projections work
4. Can add more accounts via `/connect`

---

## Questions for Claude to Investigate

1. **Session Management:** Is session properly persisted across page reloads?
2. **RLS Performance:** Are the RLS policies efficient for the account queries?
3. **Error Handling:** Are API errors properly handled and displayed to users?
4. **Loading States:** Are loading states sufficient during navigation?
5. **Onboarding Flow:** Should new users be automatically redirected to onboarding instead of empty dashboard?

---

## Success Criteria

After fixes, the app should:
- ✅ Show mock data to authenticated users (after assignment)
- ✅ Protect all routes requiring authentication
- ✅ Provide context-aware navigation (back buttons, messaging)
- ✅ Handle empty state gracefully
- ✅ Support smooth onboarding flow
- ✅ Maintain consistent user experience

---

## Next Steps

1. **Immediate:** Create `004_assign_mock_data.sql` or provide manual SQL
2. **High Priority:** Add auth check to `/connect` page
3. **Medium Priority:** Fix back navigation logic
4. **Low Priority:** Add dynamic messaging
5. **Testing:** Run all test suites to verify fixes
6. **Documentation:** Update README with new navigation flow
