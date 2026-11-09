-- Verify the hosted database-test runner connects and executes a read-only assertion.
DO $test$
BEGIN
  IF to_regnamespace('public') IS NULL THEN
    RAISE EXCEPTION 'Public schema is unavailable';
  END IF;
END
$test$;
