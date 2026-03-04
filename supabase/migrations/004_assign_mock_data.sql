-- Migration: Assign mock data to first authenticated user
-- This fixes the visibility issue where mock data was created with user_id = NULL
-- before the auth migration added the user_id column

-- Assign mock enrollment to the first authenticated user
UPDATE enrollments
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE teller_enrollment_id = 'enr_mock_test_12345'
AND user_id IS NULL;

-- Verify the update (optional - for manual inspection)
-- SELECT teller_enrollment_id, user_id FROM enrollments WHERE teller_enrollment_id = 'enr_mock_test_12345';
