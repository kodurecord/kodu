-- Migration 0011: Anonymous Visitor / Session / Event Infrastructure
-- Cross-product KODU analytics and identity layer.
-- No PII is required at this layer — these tables are designed to work
-- fully anonymously until a person identifies themselves.
--
-- Design principles:
--   • visitor_id is a ULID set in a first-party cookie/localStorage — NOT the IP address
--   • session_id is per-page-load/tab
--   • events are append-only; never rewrite historical rows to add person_id
--   • person attribution happens via visitor.person_id (set at PDF form submission)
--   • all columns that could be empty for anonymous visitors are nullable
--   • app column makes this shared infrastructure (repair, warranty, permit, etc.)

-- visitors: one row per device/browser that has ever touched a KODU product
CREATE TABLE IF NOT EXISTS visitors (
  id              TEXT    PRIMARY KEY NOT NULL,  -- ULID, set in first-party cookie
  person_id       TEXT    REFERENCES persons(id),  -- set when visitor identifies themselves
  first_seen_at   TEXT    NOT NULL,
  last_seen_at    TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visitors_person_id
  ON visitors(person_id)
  WHERE person_id IS NOT NULL;

-- sessions: one row per browser visit/page load
-- A visitor can have many sessions (return visits, different tabs)
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT    PRIMARY KEY NOT NULL,  -- ULID
  visitor_id      TEXT    NOT NULL REFERENCES visitors(id),
  app             TEXT    NOT NULL DEFAULT 'repair',
  -- 'repair' | 'warranty' | 'permit' | 'record' | 'kodu'

  -- UTM parameters captured at session start
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT,

  -- Advertising click IDs (captured only if present and consent permits)
  gclid           TEXT,   -- Google
  fbclid          TEXT,   -- Meta
  ttclid          TEXT,   -- TikTok

  -- Page context at session start
  landing_page    TEXT,
  referrer_url    TEXT,
  referrer_domain TEXT,

  -- Summarized device info (NOT the raw user-agent string)
  device_type     TEXT,   -- 'mobile' | 'tablet' | 'desktop' | 'unknown'
  browser_family  TEXT,   -- 'chrome' | 'safari' | 'firefox' | 'edge' | 'other'

  -- Consent state at session start
  consent_state   TEXT    NOT NULL DEFAULT 'unknown',
  -- 'unknown' | 'minimal' | 'analytics' | 'full'

  started_at      TEXT    NOT NULL,
  last_active_at  TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id
  ON sessions(visitor_id);

-- marketing_attribution: normalized first-party attribution record per session
-- One row per session. UTM/click IDs also stored on sessions but this table
-- is the authoritative attribution record for campaign analysis.
CREATE TABLE IF NOT EXISTS marketing_attribution (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  visitor_id      TEXT    NOT NULL REFERENCES visitors(id),
  app             TEXT    NOT NULL DEFAULT 'repair',

  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT,
  gclid           TEXT,
  fbclid          TEXT,
  ttclid          TEXT,

  landing_page    TEXT    NOT NULL,
  referrer_url    TEXT,
  referrer_domain TEXT,

  -- Network metadata — supporting/analytical, NOT the identity key
  -- IP country stored for jurisdiction-aware consent; raw IP is not stored permanently
  ip_country      TEXT,   -- ISO 3166-1 alpha-2 (e.g. 'US', 'CA')
  ip_region       TEXT,   -- state/province where available

  captured_at     TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_attribution_session_id
  ON marketing_attribution(session_id);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_visitor_id
  ON marketing_attribution(visitor_id);

-- events: append-only activity log for all KODU products
-- Keep this table lean — properties JSON holds event-specific payload
-- Rows are never updated; a correction creates a new row with a note
CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id      TEXT    NOT NULL REFERENCES visitors(id),
  session_id      TEXT    NOT NULL REFERENCES sessions(id),
  app             TEXT    NOT NULL DEFAULT 'repair',

  event_name      TEXT    NOT NULL,
  -- Standard names defined in @kodu/shared-types KODU_EVENTS

  -- Optional FK to the primary subject of the event
  repair_event_id TEXT    REFERENCES repair_events(id),

  -- JSON blob: event-specific properties
  -- e.g. { "category_key": "hvac_central_ac", "equipment_id": "01J..." }
  properties      TEXT,   -- JSON

  occurred_at     TEXT    NOT NULL,

  -- Retention: raw events are kept for this many days from occurred_at.
  -- NULL means no scheduled expiry (use for conversion/report events).
  -- Analytics events default to 730 days (2 years).
  retain_days     INTEGER DEFAULT 730
);

CREATE INDEX IF NOT EXISTS idx_events_visitor_id
  ON events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id
  ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_repair_event_id
  ON events(repair_event_id)
  WHERE repair_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_event_name
  ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_occurred_at
  ON events(occurred_at);
