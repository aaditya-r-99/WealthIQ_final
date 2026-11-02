-- Migration: 20261102103500_add_unique_constraint_financial_history.sql
-- Description: Enforce database-level uniqueness for (user_id, month) in financial_history
-- and deduplicate any pre-existing duplicates preserving the latest legitimate snapshot.

-- 1. Deduplicate pre-existing records: keep the most recent record per (user_id, month)
DELETE FROM financial_history
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, month) id
    FROM financial_history
    ORDER BY user_id, month, created_at DESC NULLS LAST, id DESC
);

-- 2. Add database-level unique constraint on (user_id, month)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_financial_history_user_month'
    ) THEN
        ALTER TABLE financial_history
        ADD CONSTRAINT uq_financial_history_user_month UNIQUE (user_id, month);
    END IF;
END $$;
