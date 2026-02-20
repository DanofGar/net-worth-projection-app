-- Migration 004: Assign mock data to first authenticated user
--
-- Run this AFTER creating your first user account in Supabase Auth.
-- The mock data from 002_mock_data.sql was created with user_id = NULL
-- because the user_id column didn't exist yet at insertion time.
-- This migration assigns it to the first user so the dashboard shows data immediately.
--
-- Usage: Run in Supabase SQL editor after signing up at /login

UPDATE enrollments
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE teller_enrollment_id = 'enr_mock_test_12345'
AND user_id IS NULL;

-- Verify: Should return 1 row updated
-- SELECT teller_enrollment_id, user_id FROM enrollments WHERE teller_enrollment_id = 'enr_mock_test_12345';
