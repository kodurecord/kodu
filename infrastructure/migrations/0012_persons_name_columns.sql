-- Migration 0012: Add first_name / last_name columns to persons
-- The PDF report form collects first name + email.
-- Persons previously only had full_name (nullable). We add first_name and last_name
-- as separate columns so downstream personalization (email greeting, report header)
-- can use the first name directly without string-splitting full_name.
--
-- Migration is additive — existing rows keep NULL for the new columns.
-- full_name is retained for backwards compatibility and manually-imported contacts.

ALTER TABLE persons ADD COLUMN first_name TEXT;
ALTER TABLE persons ADD COLUMN last_name  TEXT;

-- Index on email for fast find-or-create by email at PDF submission
CREATE INDEX IF NOT EXISTS idx_persons_email
  ON persons(email)
  WHERE email IS NOT NULL;
