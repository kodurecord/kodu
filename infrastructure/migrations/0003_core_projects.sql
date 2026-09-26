-- Migration 0003: Core Projects
-- Projects group related repair events and future work.
-- This is a KODU Core concept, not Repair-specific.
-- A repair event can optionally belong to a project (e.g., "2024 HVAC season").

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT    PRIMARY KEY NOT NULL,  -- ULID
  property_id   TEXT    NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  description   TEXT,
  status        TEXT    NOT NULL DEFAULT 'open',  -- 'open', 'in_progress', 'completed', 'archived'
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_property_id
  ON projects(property_id);
