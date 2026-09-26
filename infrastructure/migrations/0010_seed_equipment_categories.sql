-- Migration 0010: Seed Equipment Categories
-- Populates equipment_categories from @kodu/shared-types EQUIPMENT_CATEGORIES.
-- This seed matches the TypeScript source of truth exactly.
-- To add categories later: add a new migration with INSERT OR IGNORE.
-- To update a label: add a new migration with UPDATE.
-- Do NOT edit this migration after it has run in production.

INSERT OR IGNORE INTO equipment_categories (key, label, group_name, typical_lifespan_yrs, created_at)
VALUES
  -- HVAC
  ('hvac_central_air',        'Central Air Conditioning',  'hvac',        15, datetime('now')),
  ('hvac_heat_pump',          'Heat Pump',                 'hvac',        15, datetime('now')),
  ('hvac_furnace_gas',        'Gas Furnace',               'hvac',        20, datetime('now')),
  ('hvac_furnace_electric',   'Electric Furnace',          'hvac',        25, datetime('now')),
  ('hvac_boiler',             'Boiler',                    'hvac',        20, datetime('now')),
  ('hvac_mini_split',         'Mini-Split System',         'hvac',        15, datetime('now')),
  ('hvac_ductwork',           'Ductwork',                  'hvac',        25, datetime('now')),
  ('hvac_thermostat',         'Thermostat',                'hvac',        10, datetime('now')),

  -- Plumbing
  ('water_heater_tank',       'Tank Water Heater',         'plumbing',    10, datetime('now')),
  ('water_heater_tankless',   'Tankless Water Heater',     'plumbing',    20, datetime('now')),
  ('water_softener',          'Water Softener',            'plumbing',    12, datetime('now')),
  ('sump_pump',               'Sump Pump',                 'plumbing',    10, datetime('now')),
  ('well_pump',               'Well Pump',                 'plumbing',    12, datetime('now')),

  -- Electrical
  ('electrical_panel',        'Electrical Panel',          'electrical',  30, datetime('now')),
  ('generator_standby',       'Standby Generator',         'electrical',  20, datetime('now')),

  -- Appliances
  ('refrigerator',            'Refrigerator',              'appliances',  13, datetime('now')),
  ('dishwasher',              'Dishwasher',                'appliances',  10, datetime('now')),
  ('washer',                  'Washing Machine',           'appliances',  11, datetime('now')),
  ('dryer',                   'Dryer',                     'appliances',  13, datetime('now')),
  ('range_gas',               'Gas Range / Stove',         'appliances',  15, datetime('now')),
  ('range_electric',          'Electric Range / Stove',    'appliances',  15, datetime('now')),
  ('microwave_builtin',       'Built-in Microwave',        'appliances',  9,  datetime('now')),

  -- Structure
  ('roof',                    'Roof',                      'structure',   30, datetime('now')),
  ('garage_door',             'Garage Door',               'structure',   20, datetime('now')),
  ('pool_equipment',          'Pool Equipment',            'other',       10, datetime('now'));
