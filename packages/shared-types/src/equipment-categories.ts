// Equipment category reference data.
// Stored as extensible reference table in D1 (equipment_categories).
// NOT a hard-coded CHECK constraint — new categories can be added without migration.
// Initial taxonomy covers common homeowner systems and appliances.
// Full taxonomy will be established separately.

export interface EquipmentCategory {
  key: string;
  label: string; // homeowner-facing display name
  group: EquipmentCategoryGroup;
  iconSlug?: string; // for visual category selector
  typicalLifespanYears?: [number, number]; // [min, max] expected useful life
}

export type EquipmentCategoryGroup =
  | "hvac"
  | "plumbing"
  | "electrical"
  | "appliances"
  | "structure"
  | "exterior"
  | "other";

// Seed data — loaded into equipment_categories table on first migration.
// typicalLifespanYears is the initial reference range; analysis engine uses
// more specific values from equipment_lifespans reference data.
export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  // HVAC
  { key: "hvac_central_air", label: "Central Air Conditioner", group: "hvac", typicalLifespanYears: [12, 20] },
  { key: "hvac_heat_pump", label: "Heat Pump", group: "hvac", typicalLifespanYears: [12, 20] },
  { key: "hvac_furnace_gas", label: "Gas Furnace", group: "hvac", typicalLifespanYears: [15, 25] },
  { key: "hvac_furnace_electric", label: "Electric Furnace", group: "hvac", typicalLifespanYears: [20, 30] },
  { key: "hvac_boiler", label: "Boiler", group: "hvac", typicalLifespanYears: [15, 30] },
  { key: "hvac_mini_split", label: "Mini Split / Ductless", group: "hvac", typicalLifespanYears: [12, 20] },
  // Plumbing
  { key: "water_heater_tank", label: "Water Heater (Tank)", group: "plumbing", typicalLifespanYears: [8, 15] },
  { key: "water_heater_tankless", label: "Water Heater (Tankless)", group: "plumbing", typicalLifespanYears: [15, 25] },
  { key: "water_softener", label: "Water Softener", group: "plumbing", typicalLifespanYears: [10, 20] },
  { key: "sump_pump", label: "Sump Pump", group: "plumbing", typicalLifespanYears: [7, 15] },
  { key: "well_pump", label: "Well Pump", group: "plumbing", typicalLifespanYears: [8, 15] },
  // Electrical
  { key: "electrical_panel", label: "Electrical Panel", group: "electrical", typicalLifespanYears: [25, 40] },
  { key: "generator_standby", label: "Standby Generator", group: "electrical", typicalLifespanYears: [15, 25] },
  // Appliances
  { key: "refrigerator", label: "Refrigerator", group: "appliances", typicalLifespanYears: [10, 18] },
  { key: "dishwasher", label: "Dishwasher", group: "appliances", typicalLifespanYears: [8, 15] },
  { key: "washer", label: "Washing Machine", group: "appliances", typicalLifespanYears: [8, 14] },
  { key: "dryer", label: "Dryer", group: "appliances", typicalLifespanYears: [10, 18] },
  { key: "range_gas", label: "Gas Range / Oven", group: "appliances", typicalLifespanYears: [12, 20] },
  { key: "range_electric", label: "Electric Range / Oven", group: "appliances", typicalLifespanYears: [12, 20] },
  { key: "microwave_builtin", label: "Built-in Microwave", group: "appliances", typicalLifespanYears: [7, 12] },
  // Structure
  { key: "roof", label: "Roof", group: "structure", typicalLifespanYears: [20, 50] },
  { key: "fireplace_chimney", label: "Fireplace / Chimney", group: "structure", typicalLifespanYears: [30, 50] },
  // Exterior
  { key: "garage_door", label: "Garage Door", group: "exterior", typicalLifespanYears: [15, 30] },
  { key: "pool_equipment", label: "Pool Equipment", group: "exterior", typicalLifespanYears: [7, 15] },
  // Other
  { key: "other", label: "Other", group: "other" },
];

export function getCategoryByKey(key: string): EquipmentCategory | undefined {
  return EQUIPMENT_CATEGORIES.find((c) => c.key === key);
}

export function getCategoriesByGroup(group: EquipmentCategoryGroup): EquipmentCategory[] {
  return EQUIPMENT_CATEGORIES.filter((c) => c.group === group);
}
