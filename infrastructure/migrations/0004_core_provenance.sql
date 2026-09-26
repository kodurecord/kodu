-- Migration 0004: Core Provenance Sources
-- Normalized provenance tracking for any fact in the system.
-- Referenced by FK from equipment_facts, quotes, analyses, etc.
-- Created before the tables that reference it.
--
-- NOTE: This migration must run BEFORE 0002 (equipment_facts references provenance_sources).
-- Since D1 migrations run in filename order, we prepend with the prefix 0004 but
-- the equipment_facts FK is defined with REFERENCES provenance_sources(id) which
-- D1 (SQLite) enforces only at DML time, not DDL time. Both tables can be created
-- in any order and the FK will be enforced at runtime.
--
-- In practice: all migrations run in sequence, this just clarifies intent.

CREATE TABLE IF NOT EXISTS provenance_sources (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type           TEXT    NOT NULL,
  -- 'user_entered' | 'document_extracted' | 'contractor_provided' |
  -- 'authoritative_external' | 'kodu_calculated' | 'kodu_inferred' | 'imported'

  -- Boolean flags: redundant with source_type but useful for fast queries
  is_user_entered           INTEGER NOT NULL DEFAULT 0,
  is_document_extracted     INTEGER NOT NULL DEFAULT 0,
  is_contractor_provided    INTEGER NOT NULL DEFAULT 0,
  is_authoritative_external INTEGER NOT NULL DEFAULT 0,
  is_kodu_calculated        INTEGER NOT NULL DEFAULT 0,
  is_kodu_inferred          INTEGER NOT NULL DEFAULT 0,

  source_identifier     TEXT,   -- e.g. document ULID, contractor name, API endpoint
  extraction_method     TEXT,   -- 'manual', 'ocr', 'ai_vision', etc.

  obtained_at           TEXT    NOT NULL,
  last_verified_at      TEXT,
  confidence            REAL,   -- 0.0–1.0
  confidence_basis      TEXT,   -- explanation of how confidence was determined
  notes                 TEXT,

  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
