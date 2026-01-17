-- Migration: Add Authentication + Row Level Security
-- Run this AFTER 001_initial_schema.sql and 002_mock_data.sql

-- ============================================
-- STEP 1: Add user_id columns
-- ============================================

-- Add user_id to enrollments (nullable first for existing data)
ALTER TABLE enrollments 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to recurring_rules
ALTER TABLE recurring_rules 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Note: accounts inherits user ownership through enrollments (no direct user_id needed)
-- Note: balances inherits through accounts -> enrollments chain

-- ============================================
-- STEP 2: Create indexes for user_id lookups
-- ============================================

CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_recurring_rules_user_id ON recurring_rules(user_id);

-- ============================================
-- STEP 3: Enable Row Level Security
-- ============================================

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create RLS Policies
-- ============================================

-- Enrollments: Users can only see/modify their own enrollments
CREATE POLICY "Users can view own enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollments"
  ON enrollments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own enrollments"
  ON enrollments FOR DELETE
  USING (auth.uid() = user_id);

-- Accounts: Users can access accounts through their enrollments
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments 
      WHERE enrollments.id = accounts.enrollment_id 
      AND enrollments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM enrollments 
      WHERE enrollments.id = accounts.enrollment_id 
      AND enrollments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM enrollments 
      WHERE enrollments.id = accounts.enrollment_id 
      AND enrollments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM enrollments 
      WHERE enrollments.id = accounts.enrollment_id 
      AND enrollments.user_id = auth.uid()
    )
  );

-- Balances: Users can access balances through accounts -> enrollments chain
CREATE POLICY "Users can view own balances"
  ON balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      JOIN enrollments ON enrollments.id = accounts.enrollment_id
      WHERE accounts.id = balances.account_id
      AND enrollments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own balances"
  ON balances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts
      JOIN enrollments ON enrollments.id = accounts.enrollment_id
      WHERE accounts.id = balances.account_id
      AND enrollments.user_id = auth.uid()
    )
  );

-- Recurring Rules: Users can only see/modify their own rules
CREATE POLICY "Users can view own rules"
  ON recurring_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rules"
  ON recurring_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules"
  ON recurring_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules"
  ON recurring_rules FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Service role bypass for scheduled functions
-- ============================================
-- Note: Scheduled polling function uses SUPABASE_SERVICE_KEY which bypasses RLS.
-- This is intentional - the polling function needs to access all enrollments.

-- ============================================
-- STEP 6: Make user_id NOT NULL after backfill
-- ============================================
-- After you've assigned existing data to a user, run:
-- ALTER TABLE enrollments ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE recurring_rules ALTER COLUMN user_id SET NOT NULL;
