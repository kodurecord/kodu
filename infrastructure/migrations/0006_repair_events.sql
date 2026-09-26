-- Migration 0006: Repair Events
-- A repair event is the central object of KODU Repair.
-- It captures the homeowner's situation, context, and urgency.
-- All analysis and decisions hang off a repair event.

CREATE TABLE IF NOT EXISTS repair_events (
  id                        TEXT    PRIMARY KEY NOT NULL,  -- ULID
  equipment_id              TEXT    NOT NULL REFERENCES equipment(id),
  property_id               TEXT    NOT NULL REFERENCES properties(id),
  project_id                TEXT    REFERENCES projects(id),

  event_date                TEXT    NOT NULL,   -- ISO 8601 date of the problem/service call
  description_of_problem    TEXT    NOT NULL,   -- what the homeowner described
  is_first_repair           INTEGER,            -- null = unknown; 1 = yes; 0 = no
  prior_repair_count        INTEGER,            -- how many times repaired before
  prior_repair_spend_approx REAL,              -- total spent on prior repairs (USD)

  urgency                   TEXT    NOT NULL DEFAULT 'unknown',
  -- 'immediate' | 'soon' | 'can_wait' | 'unknown'

  homeowner_context         TEXT,               -- free-form notes from homeowner
  status                    TEXT    NOT NULL DEFAULT 'open',
  -- 'open' | 'decided' | 'archived'

  created_at                TEXT    NOT NULL,
  updated_at                TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repair_events_equipment_id
  ON repair_events(equipment_id);
CREATE INDEX IF NOT EXISTS idx_repair_events_property_id
  ON repair_events(property_id);
