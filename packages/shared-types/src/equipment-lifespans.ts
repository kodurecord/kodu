// Equipment lifespan reference data for the deterministic analysis engine.
// Source: HUD, NAHB, and industry service life estimates.
// Version-stamped — analysis records which version was used for reproducibility.

export const LIFESPAN_REFERENCE_VERSION = "1.0.0";

export interface LifespanReference {
  categoryKey: string;
  expectedYears: number; // midpoint estimate used in calculations
  minYears: number;
  maxYears: number;
  source: string;
  notes?: string;
}

// Replacement cost reference ranges (USD, national median, 2024 baseline).
// Used when homeowner has not provided a replacement estimate.
// These are order-of-magnitude guidance only — never presented as quotes.
export interface ReplacementCostReference {
  categoryKey: string;
  lowUsd: number;
  highUsd: number;
  medianUsd: number;
  notes?: string;
}

export const LIFESPAN_REFERENCES: LifespanReference[] = [
  { categoryKey: "hvac_central_air",     expectedYears: 15, minYears: 12, maxYears: 20, source: "NAHB/HUD" },
  { categoryKey: "hvac_heat_pump",       expectedYears: 15, minYears: 12, maxYears: 20, source: "NAHB/HUD" },
  { categoryKey: "hvac_furnace_gas",     expectedYears: 20, minYears: 15, maxYears: 25, source: "NAHB/HUD" },
  { categoryKey: "hvac_furnace_electric",expectedYears: 25, minYears: 20, maxYears: 30, source: "NAHB/HUD" },
  { categoryKey: "hvac_boiler",          expectedYears: 20, minYears: 15, maxYears: 30, source: "NAHB/HUD" },
  { categoryKey: "hvac_mini_split",      expectedYears: 15, minYears: 12, maxYears: 20, source: "NAHB/HUD" },
  { categoryKey: "water_heater_tank",    expectedYears: 10, minYears: 8,  maxYears: 15, source: "NAHB/HUD" },
  { categoryKey: "water_heater_tankless",expectedYears: 20, minYears: 15, maxYears: 25, source: "NAHB/HUD" },
  { categoryKey: "water_softener",       expectedYears: 12, minYears: 10, maxYears: 20, source: "NAHB/HUD" },
  { categoryKey: "sump_pump",            expectedYears: 10, minYears: 7,  maxYears: 15, source: "NAHB/HUD" },
  { categoryKey: "well_pump",            expectedYears: 12, minYears: 8,  maxYears: 15, source: "NAHB/HUD" },
  { categoryKey: "electrical_panel",     expectedYears: 30, minYears: 25, maxYears: 40, source: "NAHB/HUD" },
  { categoryKey: "generator_standby",    expectedYears: 20, minYears: 15, maxYears: 25, source: "industry" },
  { categoryKey: "refrigerator",         expectedYears: 13, minYears: 10, maxYears: 18, source: "NAHB/HUD" },
  { categoryKey: "dishwasher",           expectedYears: 10, minYears: 8,  maxYears: 15, source: "NAHB/HUD" },
  { categoryKey: "washer",               expectedYears: 11, minYears: 8,  maxYears: 14, source: "NAHB/HUD" },
  { categoryKey: "dryer",                expectedYears: 13, minYears: 10, maxYears: 18, source: "NAHB/HUD" },
  { categoryKey: "range_gas",            expectedYears: 15, minYears: 12, maxYears: 20, source: "NAHB/HUD" },
  { categoryKey: "range_electric",       expectedYears: 15, minYears: 12, maxYears: 20, source: "NAHB/HUD" },
  { categoryKey: "microwave_builtin",    expectedYears: 9,  minYears: 7,  maxYears: 12, source: "NAHB/HUD" },
  { categoryKey: "roof",                 expectedYears: 30, minYears: 20, maxYears: 50, source: "NAHB/HUD", notes: "Highly material-dependent" },
  { categoryKey: "garage_door",          expectedYears: 20, minYears: 15, maxYears: 30, source: "NAHB/HUD" },
  { categoryKey: "pool_equipment",       expectedYears: 10, minYears: 7,  maxYears: 15, source: "industry" },
];

export const REPLACEMENT_COST_REFERENCES: ReplacementCostReference[] = [
  { categoryKey: "hvac_central_air",     lowUsd: 3500,  highUsd: 7500,  medianUsd: 5500, notes: "2–5 ton unit, installed" },
  { categoryKey: "hvac_heat_pump",       lowUsd: 4000,  highUsd: 9000,  medianUsd: 6000 },
  { categoryKey: "hvac_furnace_gas",     lowUsd: 2500,  highUsd: 5500,  medianUsd: 3500 },
  { categoryKey: "hvac_furnace_electric",lowUsd: 2000,  highUsd: 4500,  medianUsd: 3000 },
  { categoryKey: "hvac_boiler",          lowUsd: 3500,  highUsd: 8000,  medianUsd: 5500 },
  { categoryKey: "hvac_mini_split",      lowUsd: 2000,  highUsd: 6000,  medianUsd: 3500, notes: "Single zone, installed" },
  { categoryKey: "water_heater_tank",    lowUsd: 900,   highUsd: 2500,  medianUsd: 1400, notes: "40–50 gal, installed" },
  { categoryKey: "water_heater_tankless",lowUsd: 1500,  highUsd: 4000,  medianUsd: 2500 },
  { categoryKey: "water_softener",       lowUsd: 800,   highUsd: 2500,  medianUsd: 1500 },
  { categoryKey: "sump_pump",            lowUsd: 500,   highUsd: 1500,  medianUsd: 800  },
  { categoryKey: "electrical_panel",     lowUsd: 1500,  highUsd: 4000,  medianUsd: 2500, notes: "100–200A service" },
  { categoryKey: "refrigerator",         lowUsd: 900,   highUsd: 3000,  medianUsd: 1500 },
  { categoryKey: "dishwasher",           lowUsd: 600,   highUsd: 1800,  medianUsd: 1000 },
  { categoryKey: "washer",               lowUsd: 600,   highUsd: 1800,  medianUsd: 1000 },
  { categoryKey: "dryer",                lowUsd: 500,   highUsd: 1500,  medianUsd: 900  },
  { categoryKey: "range_gas",            lowUsd: 700,   highUsd: 3000,  medianUsd: 1200 },
  { categoryKey: "range_electric",       lowUsd: 600,   highUsd: 2500,  medianUsd: 1100 },
  { categoryKey: "garage_door",          lowUsd: 800,   highUsd: 2500,  medianUsd: 1400, notes: "Installed, single car" },
];

export function getLifespan(categoryKey: string): LifespanReference | undefined {
  return LIFESPAN_REFERENCES.find((r) => r.categoryKey === categoryKey);
}

export function getReplacementCost(categoryKey: string): ReplacementCostReference | undefined {
  return REPLACEMENT_COST_REFERENCES.find((r) => r.categoryKey === categoryKey);
}
