-- Migration 0014: Product Waitlists + email_deliveries app column
--
-- 1. email_deliveries.app — adds cross-product attribution to every outbound
--    communication so Mailgun webhook events can be associated to the originating
--    KODU product. Defaults to 'repair' for rows created before this migration.
--
-- 2. product_waitlists — shared waitlist table for all KODU products.
--    Supports Repair, Warranty, Permit, Record, and future products.
--    Linked to the shared Person/Visitor/Session infrastructure so attribution
--    is preserved across the KODU ecosystem. Do NOT build product-specific lead
--    tables; use this table and filter by app.

-- ── 1. Add app column to email_deliveries ─────────────────────────────────────

ALTER TABLE email_deliveries ADD COLUMN app TEXT NOT NULL DEFAULT 'repair';
-- 'repair' | 'warranty' | 'permit' | 'record'

CREATE INDEX IF NOT EXISTS idx_email_deliveries_app
  ON email_deliveries(app);

-- ── 2. Product Waitlists ──────────────────────────────────────────────────────
-- Shared across all KODU products. One row per person+product.
-- Duplicate submissions by the same person for the same product are
-- handled at the application layer (upsert on person_id + app).
--
-- Lifecycle:
--   joined       → person submitted the waitlist form
--   confirmed    → person clicked the confirmation link in their email
--   invited      → KODU sent an early-access invite
--   activated    → person accepted and activated their account
--   unsubscribed → person removed themselves from the waitlist

CREATE TABLE IF NOT EXISTS product_waitlists (
  id                  TEXT    PRIMARY KEY NOT NULL,  -- ULID

  -- Product identifier — same values as the app column everywhere
  app                 TEXT    NOT NULL,
  -- 'repair' | 'warranty' | 'permit' | 'record'

  -- Person / attribution
  person_id           TEXT    NOT NULL REFERENCES persons(id),
  visitor_id          TEXT    REFERENCES visitors(id),
  session_id          TEXT    REFERENCES sessions(id),

  -- Status lifecycle (see above)
  status              TEXT    NOT NULL DEFAULT 'joined',

  -- Optional segmentation (e.g. 'homeowner', 'contractor', 'investor')
  audience_segment    TEXT,

  -- Acquisition source (e.g. 'organic', 'referral', 'paid_search', 'direct')
  source              TEXT,

  -- Lifecycle timestamps (only joined is guaranteed; others set as events occur)
  created_at          TEXT    NOT NULL,   -- when the waitlist row was created (= joined_at)
  confirmed_at        TEXT,               -- when email was confirmed
  invited_at          TEXT,               -- when KODU sent the early-access invite
  activated_at        TEXT,               -- when person activated their account

  -- Prevent duplicate joins for the same person + product
  UNIQUE(person_id, app)
);

CREATE INDEX IF NOT EXISTS idx_product_waitlists_app
  ON product_waitlists(app);
CREATE INDEX IF NOT EXISTS idx_product_waitlists_person_id
  ON product_waitlists(person_id);
CREATE INDEX IF NOT EXISTS idx_product_waitlists_visitor_id
  ON product_waitlists(visitor_id)
  WHERE visitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_waitlists_status
  ON product_waitlists(app, status);
CREATE INDEX IF NOT EXISTS idx_product_waitlists_created_at
  ON product_waitlists(app, created_at DESC);
