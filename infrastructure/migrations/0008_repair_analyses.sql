-- Migration 0008: Repair Analyses
-- Analysis results from the deterministic engine.
-- Each analysis run is immutable — a new analysis creates a new row.
-- The AI explanation is optional and stored separately from the factors.
--
-- deterministic_inputs: JSON blob of all reference data used in this analysis
-- (lifespan reference version, replacement cost range, etc.) for reproducibility.
-- Snapshot at generation time — reference data changes don't retroactively alter past analyses.

CREATE TABLE IF NOT EXISTS analyses (
  id                    TEXT    PRIMARY KEY NOT NULL,  -- ULID
  repair_event_id       TEXT    NOT NULL REFERENCES repair_events(id) ON DELETE CASCADE,

  generated_at          TEXT    NOT NULL,
  engine_version        TEXT    NOT NULL,   -- semver, matches LIFESPAN_REFERENCE_VERSION

  deterministic_inputs  TEXT    NOT NULL,   -- JSON: all reference data used
  ai_explanation        TEXT,              -- optional: plain-language explanation from AI
  overall_lean          TEXT    NOT NULL,   -- 'repair' | 'replace' | 'inconclusive'
  confidence            TEXT,              -- 'high' | 'medium' | 'low'

  created_at            TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analyses_repair_event_id
  ON analyses(repair_event_id);

-- analysis_factors: individual factors that fed into the overall_lean.
-- These are what the UI displays to the homeowner.
-- Each factor has a direction, weight, and explanation.
CREATE TABLE IF NOT EXISTS analysis_factors (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id       TEXT    NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,

  factor_type       TEXT    NOT NULL,
  -- 'equipment_age_vs_lifespan' | 'repair_cost_ratio' | 'repair_history' |
  -- 'first_major_repair' | 'efficiency_delta' | 'warranty_status' |
  -- 'recall_status' | 'parts_availability' | 'regional_cost_context' |
  -- 'homeowner_context' | 'permit_complexity'

  direction         TEXT    NOT NULL,
  -- 'favors_repair' | 'favors_replace' | 'neutral' | 'unknown'

  weight            TEXT    NOT NULL,
  -- 'primary' | 'secondary' | 'contextual' | 'informational'

  calculated_value  REAL,   -- the numeric value this factor calculated (if applicable)
  reference_value   REAL,   -- the reference/expected value for comparison
  unit              TEXT,   -- 'years', 'percent', 'usd', etc.

  data_quality      TEXT    NOT NULL DEFAULT 'medium',
  -- 'high' | 'medium' | 'low' | 'insufficient'

  explanation       TEXT    NOT NULL,   -- plain-language explanation for this factor
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analysis_factors_analysis_id
  ON analysis_factors(analysis_id);
