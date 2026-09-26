-- Migration 0013: Generated Reports and Communication Consents
--
-- generated_reports: a first-class KODU record of every PDF/report generated.
-- Traceable: person → property → equipment → repair_event → quote → analysis → report.
-- Also carries visitor/session attribution so acquisition source is preserved.
--
-- communication_consents: fine-grained consent records.
-- Separate row per purpose per person/visitor. Append-only for audit trail.
-- Withdrawal sets withdrawn_at; the granted row is not deleted.

-- email_deliveries: Mailgun delivery tracking per outbound message.
-- Separate from generated_reports so a report can have multiple delivery attempts.
-- Mailgun webhook events (delivered, bounced, complained) update rows here without
-- modifying any KODU analysis or report data.

-- ── Generated Reports ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generated_reports (
  id                  TEXT    PRIMARY KEY NOT NULL,  -- ULID
  app                 TEXT    NOT NULL DEFAULT 'repair',

  -- Core relationships
  repair_event_id     TEXT    REFERENCES repair_events(id),
  analysis_id         TEXT    REFERENCES analyses(id),
  person_id           TEXT    REFERENCES persons(id),

  -- Attribution
  visitor_id          TEXT    REFERENCES visitors(id),
  session_id          TEXT    REFERENCES sessions(id),

  -- Report metadata
  report_type         TEXT    NOT NULL DEFAULT 'repair_analysis',
  -- 'repair_analysis' | 'warranty_summary' | 'permit_summary' (future)

  report_version      TEXT    NOT NULL DEFAULT '1',

  -- Storage: R2 coordinates (null until generated and uploaded)
  r2_bucket           TEXT,
  r2_key              TEXT,   -- e.g. 'repair/01J.../report.pdf'
  file_size_bytes     INTEGER,

  format              TEXT    NOT NULL DEFAULT 'pdf',

  -- Lifecycle status
  status              TEXT    NOT NULL DEFAULT 'pending',
  -- 'pending' | 'generating' | 'ready' | 'failed'

  generated_at        TEXT,   -- set when PDF is written to R2
  generation_error    TEXT,   -- set on failure

  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_repair_event_id
  ON generated_reports(repair_event_id)
  WHERE repair_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generated_reports_person_id
  ON generated_reports(person_id)
  WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generated_reports_visitor_id
  ON generated_reports(visitor_id)
  WHERE visitor_id IS NOT NULL;

-- ── Email Deliveries ──────────────────────────────────────────────────────────
-- One row per outbound email attempt.
-- report_id links to generated_reports; a report can be re-sent.
-- Mailgun's message_id allows matching against incoming webhook events.

CREATE TABLE IF NOT EXISTS email_deliveries (
  id                  TEXT    PRIMARY KEY NOT NULL,  -- ULID
  report_id           TEXT    REFERENCES generated_reports(id),
  person_id           TEXT    REFERENCES persons(id),

  purpose             TEXT    NOT NULL,
  -- 'transactional_report' | 'marketing_email' | 'product_comms'

  to_email            TEXT    NOT NULL,
  to_name             TEXT,

  subject             TEXT,
  template_key        TEXT,   -- e.g. 'repair_report_v1' — maps to Mailgun template

  -- Mailgun tracking
  mailgun_message_id  TEXT,   -- Mailgun's <xxx@mg.kodu.com> message ID
  mailgun_tag         TEXT,   -- Mailgun tag for campaign tracking

  -- Delivery lifecycle (updated by webhook or polling)
  status              TEXT    NOT NULL DEFAULT 'queued',
  -- 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'complained' | 'unsubscribed'

  queued_at           TEXT    NOT NULL,
  sent_at             TEXT,
  delivered_at        TEXT,
  failed_at           TEXT,
  failure_reason      TEXT,

  -- Raw Mailgun webhook payload for the latest status event (JSON)
  last_webhook_payload TEXT,
  last_webhook_at      TEXT,

  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_report_id
  ON email_deliveries(report_id)
  WHERE report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_deliveries_person_id
  ON email_deliveries(person_id)
  WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_deliveries_mailgun_message_id
  ON email_deliveries(mailgun_message_id)
  WHERE mailgun_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_deliveries_status
  ON email_deliveries(status);

-- ── Communication Consents ────────────────────────────────────────────────────
-- Fine-grained consent, one row per person+purpose+source combination.
-- Append-only: do not update or delete rows. Withdrawal adds a new row
-- with granted=0, or set withdrawn_at on the existing grant row.
-- Latest row per (person_id, purpose) WHERE withdrawn_at IS NULL is the live state.

CREATE TABLE IF NOT EXISTS communication_consents (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id           TEXT    REFERENCES persons(id),
  visitor_id          TEXT    REFERENCES visitors(id),
  -- At least one of person_id or visitor_id must be set

  purpose             TEXT    NOT NULL,
  -- 'transactional_report' | 'product_comms' | 'marketing_email' | 'advertising_retargeting'

  granted             INTEGER NOT NULL,  -- 1 = granted, 0 = declined or withdrawn

  -- Consent provenance
  consent_version     TEXT,   -- version of the consent text shown (e.g. '2026-09')
  source              TEXT,   -- 'repair_pdf_form' | 'account_signup' | 'preference_center'
  app                 TEXT    NOT NULL DEFAULT 'repair',

  -- Jurisdiction support (for GDPR / CAN-SPAM / CASL)
  ip_country          TEXT,   -- ISO 3166-1 alpha-2
  ip_region           TEXT,

  granted_at          TEXT    NOT NULL,
  withdrawn_at        TEXT,   -- set when homeowner unsubscribes or withdraws

  created_at          TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_communication_consents_person_id
  ON communication_consents(person_id)
  WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_consents_visitor_id
  ON communication_consents(visitor_id)
  WHERE visitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_consents_purpose
  ON communication_consents(person_id, purpose);
