-- Migration 0002: Core Equipment
-- Equipment and equipment facts with per-fact provenance.
-- Categories are a reference table (extensible) not a CHECK constraint.

-- equipment_categories: reference table seeded from @kodu/shared-types.
-- Stored in D1 so new categories can be added without schema migrations.
CREATE TABLE IF NOT EXISTS equipment_categories (
  key                   TEXT    PRIMARY KEY NOT NULL,
  label                 TEXT    NOT NULL,
  group_name            TEXT    NOT NULL,  -- 'hvac', 'plumbing', 'electrical', 'appliances', 'structure', 'exterior', 'other'
  typical_lifespan_yrs  INTEGER,
  created_at            TEXT    NOT NULL
);

-- equipment: one row per discrete piece of equipment at a property.
-- A replaced item is not deleted — it gets status='replaced' and replaced_by_id set.
CREATE TABLE IF NOT EXISTS equipment (
  id              TEXT    PRIMARY KEY NOT NULL,  -- ULID
  property_id     TEXT    NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_key    TEXT    NOT NULL REFERENCES equipment_categories(key),
  status          TEXT    NOT NULL DEFAULT 'active',  -- 'active', 'replaced', 'removed', 'unknown'
  replaced_by_id  TEXT    REFERENCES equipment(id),
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_equipment_property_id
  ON equipment(property_id);

-- equipment_facts: individual facts about a piece of equipment.
-- Each fact has its own provenance. When better data arrives, the old fact
-- is superseded (superseded_at set) rather than overwritten.
-- This lets us track data quality improvements over time.
--
-- fact_key values (defined in @kodu/entity-schema EquipmentFactKey):
--   manufacturer, model_number, serial_number, install_year, manufacture_year,
--   age_years_estimated, fuel_type, capacity, efficiency_rating, condition_notes
CREATE TABLE IF NOT EXISTS equipment_facts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id    TEXT    NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  fact_key        TEXT    NOT NULL,
  fact_value      TEXT    NOT NULL,
  provenance_id   INTEGER REFERENCES provenance_sources(id),
  recorded_at     TEXT    NOT NULL,
  superseded_at   TEXT    -- set when a newer fact for the same key supersedes this one
);

CREATE INDEX IF NOT EXISTS idx_equipment_facts_equipment_id
  ON equipment_facts(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_facts_active
  ON equipment_facts(equipment_id, fact_key)
  WHERE superseded_at IS NULL;
