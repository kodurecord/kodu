-- Migration 0009: Repair Decisions
-- A homeowner's decision after reviewing the analysis.
-- Decisions are append-only — a change creates a new row (analysis_id updates).
-- outcome is recorded later when the homeowner follows up.

CREATE TABLE IF NOT EXISTS decisions (
  id                    TEXT    PRIMARY KEY NOT NULL,  -- ULID
  repair_event_id       TEXT    NOT NULL REFERENCES repair_events(id) ON DELETE CASCADE,
  analysis_id           TEXT    REFERENCES analyses(id),

  decision              TEXT    NOT NULL,
  -- 'repair' | 'replace' | 'defer' | 'undecided'

  decided_at            TEXT,
  homeowner_notes       TEXT,   -- why they made this choice

  -- Outcome recorded later (follow-up)
  outcome               TEXT,
  -- 'repaired_successfully' | 'repair_failed' | 'replaced' | 'no_action' | 'sold_property'
  outcome_recorded_at   TEXT,

  created_at            TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_repair_event_id
  ON decisions(repair_event_id);
