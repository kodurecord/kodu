-- Migration 0001: Core Persons and Properties
-- Creates the foundational identity and property tables.
-- Auth (auth_identities, accounts) is deferred — these tables are compatible
-- with auth when it is added later.
--
-- KODU Repair v1 does not require authentication. Properties and persons are
-- created anonymously per-session; canonical identity will be linked retroactively
-- when account features are introduced.

-- Persons: a human with a relationship to a property.
-- This is NOT an auth user — it's a canonical record of a homeowner, occupant,
-- or property manager. auth_identities will link to persons when auth is added.
CREATE TABLE IF NOT EXISTS persons (
  id          TEXT    PRIMARY KEY NOT NULL,  -- ULID
  full_name   TEXT,
  email       TEXT,
  phone       TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

-- Properties: a physical address or unit.
CREATE TABLE IF NOT EXISTS properties (
  id              TEXT    PRIMARY KEY NOT NULL,  -- ULID
  street_line_1   TEXT    NOT NULL,
  street_line_2   TEXT,
  city            TEXT    NOT NULL,
  state           TEXT    NOT NULL,
  zip             TEXT    NOT NULL,
  country         TEXT    NOT NULL DEFAULT 'US',
  year_built      INTEGER,
  gross_sqft      INTEGER,
  property_type   TEXT,  -- 'single_family', 'condo', 'townhouse', 'multi_family', 'other'
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

-- person_properties: many-to-many join with role and effective dates.
-- A person can be 'owner', 'occupant', 'manager', etc.
-- Multiple ownership periods are modeled with effective_from / effective_to.
CREATE TABLE IF NOT EXISTS person_properties (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id       TEXT    NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  property_id     TEXT    NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL DEFAULT 'owner',  -- 'owner', 'occupant', 'manager'
  effective_from  TEXT,
  effective_to    TEXT,
  is_current      INTEGER NOT NULL DEFAULT 1,  -- boolean: 0/1
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_person_properties_person_id
  ON person_properties(person_id);
CREATE INDEX IF NOT EXISTS idx_person_properties_property_id
  ON person_properties(property_id);
