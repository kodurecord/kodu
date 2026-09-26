-- Migration 0007: Repair Quotes
-- Quotes from contractors for a repair event.
-- Contractor fields are raw source data — no canonical contractor identity in v1.
-- is_selected: only one quote per repair event should be selected at a time.

CREATE TABLE IF NOT EXISTS quotes (
  id                  TEXT    PRIMARY KEY NOT NULL,  -- ULID
  repair_event_id     TEXT    NOT NULL REFERENCES repair_events(id) ON DELETE CASCADE,

  -- Raw contractor contact data (not a canonical identity)
  contractor_name     TEXT,
  contractor_phone    TEXT,
  contractor_license  TEXT,

  quote_date          TEXT,               -- when the quote was issued
  total_amount        REAL,              -- USD
  currency            TEXT    NOT NULL DEFAULT 'USD',
  is_selected         INTEGER NOT NULL DEFAULT 0,   -- boolean

  source_document_id  TEXT    REFERENCES documents(id),
  notes               TEXT,
  provenance_id       INTEGER REFERENCES provenance_sources(id),

  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotes_repair_event_id
  ON quotes(repair_event_id);

-- quote_line_items: itemized breakdown of a quote.
-- Stored as separate rows so we can total and compare with precision.
CREATE TABLE IF NOT EXISTS quote_line_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id        TEXT    NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  description     TEXT    NOT NULL,
  amount          REAL,
  line_type       TEXT
  -- 'labor' | 'parts' | 'diagnostic' | 'disposal' | 'markup' | 'other'
);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id
  ON quote_line_items(quote_id);
