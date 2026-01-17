-- Mock Data Migration
-- This script creates realistic test data for development and testing
-- Run this in your Supabase SQL editor after running 001_initial_schema.sql

-- Create a mock enrollment (Teller connection)
INSERT INTO enrollments (teller_enrollment_id, access_token, institution, institution_name, created_at, last_polled_at)
VALUES (
  'enr_mock_test_12345',
  'mock_access_token_for_testing',
  'chase',
  'Chase Bank',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT (teller_enrollment_id) DO NOTHING;

-- Get the enrollment ID for linking accounts
DO $$
DECLARE
  enrollment_uuid uuid;
BEGIN
  SELECT id INTO enrollment_uuid FROM enrollments WHERE teller_enrollment_id = 'enr_mock_test_12345';
  
  -- 2 Retirement Accounts (is_liquid = false)
  INSERT INTO accounts (enrollment_id, teller_account_id, name, type, subtype, last_four, is_liquid, is_primary_payment, created_at)
  VALUES
    (enrollment_uuid, 'acc_401k_001', '401(k) Retirement Account', 'depository', '401k', '7890', false, false, NOW() - INTERVAL '7 days'),
    (enrollment_uuid, 'acc_roth_ira_001', 'Roth IRA', 'depository', 'roth_ira', '4567', false, false, NOW() - INTERVAL '7 days')
  ON CONFLICT (teller_account_id) DO NOTHING;

  -- 3 Credit Cards
  INSERT INTO accounts (enrollment_id, teller_account_id, name, type, subtype, last_four, is_liquid, is_primary_payment, payment_day_of_month, created_at)
  VALUES
    (enrollment_uuid, 'acc_cc_chase_001', 'Chase Sapphire Reserve', 'credit', 'credit_card', '1234', true, false, 15, NOW() - INTERVAL '7 days'),
    (enrollment_uuid, 'acc_cc_amex_001', 'American Express Gold Card', 'credit', 'credit_card', '5678', true, false, 22, NOW() - INTERVAL '7 days'),
    (enrollment_uuid, 'acc_cc_capital_one_001', 'Capital One Venture', 'credit', 'credit_card', '9012', true, false, 5, NOW() - INTERVAL '7 days')
  ON CONFLICT (teller_account_id) DO NOTHING;

  -- 3 Checking/Savings Accounts (one primary payment account)
  INSERT INTO accounts (enrollment_id, teller_account_id, name, type, subtype, last_four, is_liquid, is_primary_payment, created_at)
  VALUES
    (enrollment_uuid, 'acc_checking_primary_001', 'Primary Checking Account', 'depository', 'checking', '3456', true, true, NOW() - INTERVAL '7 days'),
    (enrollment_uuid, 'acc_savings_hy_001', 'High-Yield Savings Account', 'depository', 'savings', '7891', true, false, NOW() - INTERVAL '7 days'),
    (enrollment_uuid, 'acc_savings_emergency_001', 'Emergency Fund', 'depository', 'savings', '2345', true, false, NOW() - INTERVAL '7 days')
  ON CONFLICT (teller_account_id) DO NOTHING;

  -- Insert balances for all accounts (recent poll within last 24 hours)
  -- Delete existing balances first to avoid duplicates, then insert fresh ones
  DELETE FROM balances WHERE account_id IN (SELECT id FROM accounts WHERE enrollment_id = enrollment_uuid);
  
  -- 401(k) - $125,000
  INSERT INTO balances (account_id, ledger, available, polled_at)
  SELECT id, 125000.00, 125000.00, NOW() - INTERVAL '2 hours'
  FROM accounts WHERE teller_account_id = 'acc_401k_001';

  -- Roth IRA - $45,000
  INSERT INTO balances (account_id, ledger, available, polled_at)
  SELECT id, 45000.00, 45000.00, NOW() - INTERVAL '2 hours'
  FROM accounts WHERE teller_account_id = 'acc_roth_ira_001';

  -- Chase Sapphire - $2,450 (credit card, so negative in net worth)
  INSERT INTO balances (account_id, ledger, available, polled_at)
  SELECT id, 2450.00, 2450.00, NOW() - INTERVAL '2 hours'
  FROM accounts WHERE teller_account_id = 'acc_cc_chase_001';

  -- Amex Gold - $890
  INSERT INTO balances (account_id, ledger, available, polled_at)
  SELECT id, 890.00, 890.00, NOW() - INTERVAL '2 hours'
  FROM accounts WHERE teller_account_id = 'acc_cc_amex_001';

  -- Capital One - $1,200
  INSERT INTO balances (account_id, ledger, available, polled_at)
  SELECT id, 1200.00, 1200.00, NOW() - INTERVAL '2 hours'
  FROM accounts WHERE teller_account_id = 'acc_cc_capital_one_001';

  -- Primary Checking - $8,500
  INSERT INTO balances (account_id, ledger, available, polled_at)
  SELECT id, 8500.00, 8500.00, NOW() - INTERVAL '2 hours'
  FROM accounts WHERE teller_account_id = 'acc_checking_primary_001';

  -- High-Yield Savings - $25,000
  INSERT INTO balances (account_id, ledger, available, polled_at)
  SELECT id, 25000.00, 25000.00, NOW() - INTERVAL '2 hours'
  FROM accounts WHERE teller_account_id = 'acc_savings_hy_001';

  -- Emergency Fund - $12,000
  INSERT INTO balances (account_id, ledger, available, polled_at)
  SELECT id, 12000.00, 12000.00, NOW() - INTERVAL '2 hours'
  FROM accounts WHERE teller_account_id = 'acc_savings_emergency_001';

END $$;

-- Verify the data was created
SELECT 
  a.name,
  a.type,
  a.subtype,
  a.is_liquid,
  a.is_primary_payment,
  a.payment_day_of_month,
  b.ledger as balance
FROM accounts a
LEFT JOIN LATERAL (
  SELECT ledger 
  FROM balances 
  WHERE account_id = a.id 
  ORDER BY polled_at DESC 
  LIMIT 1
) b ON true
ORDER BY a.created_at;
