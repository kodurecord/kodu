-- Migration 0005: Core Documents
-- Documents store metadata about uploaded files.
-- Binary content lives in R2 (r2_bucket + r2_key).
-- This table exists so we can reference documents before R2 is enabled —
-- the upload flow is gated by R2 availability at runtime, not at schema level.

CREATE TABLE IF NOT EXISTS documents (
  id                  TEXT    PRIMARY KEY NOT NULL,  -- ULID
  property_id         TEXT    REFERENCES properties(id),
  equipment_id        TEXT    REFERENCES equipment(id),

  -- R2 storage coordinates
  r2_bucket           TEXT    NOT NULL,
  r2_key              TEXT    NOT NULL,

  original_filename   TEXT,
  document_type       TEXT    NOT NULL,
  -- 'contractor_quote' | 'receipt' | 'warranty_document' | 'equipment_label' |
  -- 'manual' | 'insurance_policy' | 'insurer_estimate' | 'invoice' |
  -- 'permit' | 'inspection_report' | 'other'

  mime_type           TEXT,
  file_size_bytes     INTEGER,
  upload_source       TEXT,   -- 'web_upload', 'email', 'mobile', etc.
  extraction_status   TEXT    NOT NULL DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);

-- document_associations: polymorphic link from a document to any entity.
-- Allows a single document to be associated with multiple entities (e.g., a
-- quote document that covers two pieces of equipment).
CREATE TABLE IF NOT EXISTS document_associations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id     TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  entity_type     TEXT    NOT NULL,   -- 'equipment', 'repair_event', 'quote', 'property', etc.
  entity_id       TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_associations_document_id
  ON document_associations(document_id);
CREATE INDEX IF NOT EXISTS idx_document_associations_entity
  ON document_associations(entity_type, entity_id);
