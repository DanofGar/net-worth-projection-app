# Sandbox vs Production: Understanding Teller Environments

## 🔴 The Problem You're Experiencing

If you're getting "wrong details" or "invalid credentials" errors when trying to connect Chase or other real banks, **you're likely in sandbox mode**.

## ✅ The Solution

### Sandbox Mode (Current Setup)
- **Purpose:** Testing the integration flow without real bank access
- **Credentials:** Must use Teller's test credentials, NOT real bank credentials
- **Use Case:** Development, testing error handling, UI flows
- **Current Status:** Your logs show `environment: "sandbox"`

### Production Mode (For Real Banks)
- **Purpose:** Connect to actual bank accounts
- **Credentials:** Use your real bank username/password
- **Use Case:** Live application, real user data
- **Requires:** Production Teller app credentials

---

## 🔄 How to Switch to Production

### Step 1: Update Environment Variables

Edit your `.env.local` file:

```bash
# Change these from "sandbox" to "production"
TELLER_ENV=production
NEXT_PUBLIC_TELLER_ENV=production
```

**Important:** Make sure you have:
- Production Teller App ID (different from sandbox)
- Production certificate and private key (different from sandbox)
- These are obtained from your Teller dashboard when you create a production application

### Step 2: Restart Dev Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 3: Test Connection

1. Visit `http://localhost:3000/connect`
2. Click "Connect Bank"
3. Select Chase (or your bank)
4. Enter your **real** Chase username and password
5. Complete the connection flow

---

## 🧪 Testing in Sandbox

If you want to test the integration flow without connecting real accounts:

### Use Teller's Test Credentials

1. Stay in sandbox mode (`TELLER_ENV=sandbox`)
2. When prompted for bank credentials, use Teller's test credentials:
   - **Test Username:** `user_good`
   - **Test Password:** Any password (sandbox accepts any password)
   - This simulates a successful connection without accessing real accounts

### Test Verification Flows

- **Username:** `verify.microdeposit`
- **Password:** Any password
- This allows you to test the routing/account number verification process
- Creates test accounts labeled "Success" and "Failure" for testing both verification outcomes

---

## ⚠️ Important Notes

1. **Sandbox and Production are Separate:**
   - Sandbox app ID ≠ Production app ID
   - Sandbox certificates ≠ Production certificates
   - You need separate credentials for each environment

2. **Real Bank Credentials Only Work in Production:**
   - Chase, Bank of America, etc. will reject credentials in sandbox mode
   - This is why you're getting "wrong details" errors

3. **Security:**
   - Never commit production credentials to git
   - Use environment variables for all sensitive data
   - Production certificates should be kept secure

---

## 📋 Checklist

Before connecting real banks:
- [ ] Switched `TELLER_ENV` to `production`
- [ ] Switched `NEXT_PUBLIC_TELLER_ENV` to `production`
- [ ] Have production Teller App ID
- [ ] Have production certificate and private key (base64 encoded)
- [ ] Updated `.env.local` with production values
- [ ] Restarted dev server
- [ ] Verified environment in browser console/logs

---

## 🔍 How to Verify Your Current Environment

Check your logs or browser console. You should see:
- `environment: "sandbox"` - Currently in sandbox
- `environment: "production"` - In production mode

Or check your `.env.local` file for `TELLER_ENV` and `NEXT_PUBLIC_TELLER_ENV` values.

---

## 📚 References

- Teller Sandbox Documentation: https://teller.io/docs
- Teller Production Setup: Check your Teller dashboard
- Environment Variables Guide: See `ENV_TEMPLATE.txt`
