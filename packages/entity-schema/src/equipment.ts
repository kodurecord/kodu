// Equipment — a system or appliance belonging to a property.
// Key facts (manufacturer, model, serial, age) are stored as EquipmentFacts
// with per-fact provenance, allowing different confidence levels per field.

export type EquipmentStatus = "active" | "replaced" | "removed" | "unknown";

export interface Equipment {
  id: string; // ULID
  propertyId: string;
  categoryKey: string; // references equipment_categories.key (extensible)
  subcategoryKey?: string;
  displayName?: string; // homeowner-facing name: "Upstairs HVAC", "Kitchen Fridge"
  status: EquipmentStatus;
  replacedById?: string; // FK to equipment.id when replaced
  createdAt: string;
  updatedAt: string;
}

// Key facts stored with per-fact provenance
export type EquipmentFactKey =
  | "manufacturer"
  | "model_number"
  | "serial_number"
  | "install_year"
  | "manufacture_year"
  | "age_years_estimated"
  | "fuel_type" // gas/electric/propane/oil
  | "capacity" // tons (HVAC), gallons (water heater), etc.
  | "efficiency_rating" // SEER, EF, etc.
  | "condition_notes";

export interface EquipmentFact {
  id: number;
  equipmentId: string;
  factKey: EquipmentFactKey | string;
  factValue: string;
  provenanceId?: number;
  recordedAt: string;
  supersededAt?: string; // null = currently active
}

export interface EquipmentWithFacts extends Equipment {
  facts: EquipmentFact[]; // currently active facts (supersededAt is null)
}

export interface CreateEquipmentInput {
  propertyId: string;
  categoryKey: string;
  subcategoryKey?: string;
  displayName?: string;
}
