# Next Steps & SoFi Connection Guide

## 🎯 Immediate Next Steps

### 1. **Understand Sandbox vs Production**

**⚠️ CRITICAL: You're currently in SANDBOX mode**

Your logs show `environment: "sandbox"`. In sandbox mode:
- ❌ **You CANNOT use real bank credentials** (Chase, Bank of America, etc.)
- ✅ **You MUST use Teller's test credentials** to simulate connections
- ✅ Sandbox is for testing the integration flow, not real accounts

**To connect real banks like Chase:**
1. Switch to **production** environment in your `.env.local`:
   ```
   TELLER_ENV=production
   NEXT_PUBLIC_TELLER_ENV=production
   ```
2. Restart your dev server
3. Use your **real Chase credentials** (username/password)

**To test in sandbox:**
- Use Teller's test credentials (see "Sandbox Testing" section below)
- Or use test usernames like `verify.microdeposit` for testing verification flows

### 2. **Test the Full Flow**

**Option A: Test in Sandbox (Recommended for Development)**
- Use Teller's test credentials (see below)
- Complete the onboarding flow to verify everything works
- Test error handling and edge cases

**Option B: Test with Real Bank (Production Mode)**
- Switch to production environment
- Connect a real bank account (Chase, Bank of America, etc.)
- Complete the onboarding flow:
  - Connect account → View discovered accounts → Set credit card due dates → Select primary payment account
- Verify the dashboard shows projections correctly

### 2. **Add Recurring Rules (Manual for Now)**
Since there's no UI yet, add recurring income/expenses directly to the database:

```sql
-- Example: Monthly salary of $5000 on the 1st
INSERT INTO recurring_rules (name, amount, frequency, anchor_date, active)
VALUES ('Salary', 5000.00, 'monthly', '2025-01-01', true);

-- Example: Weekly expense of $200 every Monday
INSERT INTO recurring_rules (name, amount, frequency, anchor_date, active)
VALUES ('Groceries', -200.00, 'weekly', '2025-01-06', true);

-- Example: One-time expense on a specific date
INSERT INTO recurring_rules (name, amount, frequency, anchor_date, end_date, active)
VALUES ('Insurance Payment', -1200.00, 'once', '2025-02-15', '2025-02-15', true);
```

### 3. **Deploy to Netlify**
- Push code to your repository
- Connect to Netlify
- Set all environment variables in Netlify dashboard
- Deploy and test the scheduled polling function

### 4. **Future Features (See TODO.md)**
- Recurring rules management UI
- Account editing/deletion
- Manual balance refresh
- Transaction history
- Export functionality

---

## 🧪 Sandbox Testing Guide

### Using Teller's Test Credentials

When in **sandbox mode**, Teller provides test credentials for various scenarios:

1. **Basic Test Accounts:**
   - Username: `user_good` (or similar test username from Teller docs)
   - Password: Any password (sandbox accepts any password)
   - This simulates a successful connection

2. **Testing Verification Flows:**
   - Username: `verify.microdeposit` - Tests micro-deposit verification flow
   - This allows you to test the routing/account number verification process

3. **Testing Error Cases:**
   - Various test usernames simulate different error scenarios
   - Check Teller's sandbox documentation for complete list

**Important:** In sandbox, you're not connecting to real banks. The test credentials simulate the connection flow without actually accessing your bank accounts.

### Switching Between Sandbox and Production

**To switch to Production:**
1. Update `.env.local`:
   ```
   TELLER_ENV=production
   NEXT_PUBLIC_TELLER_ENV=production
   ```
2. Restart your dev server: `npm run dev`
3. Now you can use real bank credentials

**To switch back to Sandbox:**
1. Update `.env.local`:
   ```
   TELLER_ENV=sandbox
   NEXT_PUBLIC_TELLER_ENV=sandbox
   ```
2. Restart your dev server

---

## 🏦 SoFi Connection Issue & Solutions

### The Problem
SoFi is **not reliably supported** by Teller.io for instant credential-based connections. This is a known limitation with SoFi and many fintech banks.

### ✅ Solution 1: Use Routing/Account Number Verification (RECOMMENDED)

I've updated the Teller Connect configuration to enable the `verify` product, which allows manual entry of routing and account numbers.

**How it works:**
1. When you click "Connect Bank", Teller will show an option to "Enter account manually" or "Don't see your bank?"
2. You'll enter your SoFi routing number and account number
3. Teller will send micro-deposits (small amounts like $0.01-$0.99) to your account
4. You'll verify the amounts in the Teller interface (usually takes 1-3 business days)
5. Once verified, your account will be connected and balances will sync automatically

**To use this:**
1. Click "Connect Bank" on `/connect`
2. Look for "Don't see your bank?" or "Enter manually" option in the Teller modal
3. Enter your SoFi routing number and account number
4. Wait for micro-deposits and verify them

**Note:** Account details (routing/account numbers) will only be available via API after verification completes. Until then, the API will return a `404` with status `account_number_verification_pending`.

### ✅ Solution 2: Use a Different Supported Bank

If you have accounts at other banks that Teller supports (Chase, Bank of America, Wells Fargo, Capital One, etc.), you can:
- Connect those accounts first to test the full flow
- Use SoFi accounts manually by entering balances (see Solution 3)

### ✅ Solution 3: Manual Account Entry (Fallback)

If Teller doesn't support SoFi even with manual verification, you can manually track SoFi accounts:

1. **Add accounts manually to database:**
```sql
-- Create a manual enrollment (no Teller enrollment ID)
INSERT INTO enrollments (teller_enrollment_id, access_token, institution, institution_name)
VALUES ('manual_sofi', 'manual', 'sofi', 'SoFi Bank');

-- Add your SoFi accounts
INSERT INTO accounts (enrollment_id, teller_account_id, name, type, subtype, is_liquid)
SELECT 
  (SELECT id FROM enrollments WHERE teller_enrollment_id = 'manual_sofi'),
  'sofi_checking_manual',
  'SoFi Checking',
  'depository',
  'checking',
  true;

INSERT INTO accounts (enrollment_id, teller_account_id, name, type, subtype, is_liquid)
SELECT 
  (SELECT id FROM enrollments WHERE teller_enrollment_id = 'manual_sofi'),
  'sofi_savings_manual',
  'SoFi Savings',
  'depository',
  'savings',
  true;
```

2. **Manually update balances:**
```sql
-- Update balances manually (you'd need to do this regularly)
INSERT INTO balances (account_id, ledger, available)
SELECT id, 5000.00, 5000.00
FROM accounts
WHERE teller_account_id = 'sofi_checking_manual'
ORDER BY created_at DESC
LIMIT 1;
```

**Note:** This defeats the purpose of automatic polling, but works as a fallback.

### ✅ Solution 4: Request SoFi Support from Teller

Contact Teller support to request SoFi be added to their supported institutions list. This is a long-term solution but may take time.

### ✅ Solution 5: Use Plaid as Fallback (Advanced)

If you need broader bank support, you could integrate Plaid as a fallback for banks Teller doesn't support. This adds complexity but increases coverage.

---

## 🔍 How to Check if Your Bank is Supported

You can check Teller's supported institutions by calling their API:

```bash
curl https://api.teller.io/institutions \
  -u "your_access_token:"
```

Or check their documentation: https://teller.io/docs/api/institutions

---

## 📝 Current Teller Connect Configuration

The app is now configured with:
- `products={['accounts', 'verify']}` - Enables both account access and manual verification
- This allows users to either:
  - Connect via instant credential login (for supported banks)
  - Connect via routing/account number + micro-deposit verification (for unsupported banks like SoFi)

---

## 🚀 Recommended Action Plan

1. **Try Solution 1 first** - Use the manual routing/account number flow in Teller Connect
2. **If that doesn't work** - Use Solution 2 (connect a different bank) to test the full app
3. **For SoFi specifically** - Use Solution 3 (manual entry) as a temporary workaround while waiting for Teller support
4. **Long-term** - Request SoFi support from Teller (Solution 4)

---

## ❓ Questions?

- Check Teller's documentation: https://teller.io/docs
- Contact Teller support for institution-specific questions
- See `CONTEXT.md` for architecture details
- See `TODO.md` for planned features
