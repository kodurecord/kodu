// Repair Event — a single repair episode on a piece of equipment.
// One repair event can have multiple quotes, one analysis, and one decision.

export type RepairUrgency = "immediate" | "soon" | "can_wait" | "unknown";
export type RepairEventStatus = "open" | "decided" | "archived";

export interface RepairEvent {
  id: string; // ULID
  equipmentId: string;
  propertyId: string; // denormalized for query convenience
  projectId?: string; // optional: part of a broader project
  eventDate: string; // ISO-8601 date
  descriptionOfProblem: string;
  isFirstRepair?: boolean; // null = unknown
  priorRepairCount?: number;
  priorRepairSpendApprox?: number; // USD
  urgency: RepairUrgency;
  homeownerContext?: string; // free text: financial situation, life circumstances
  status: RepairEventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRepairEventInput {
  equipmentId: string;
  propertyId: string;
  projectId?: string;
  eventDate: string;
  descriptionOfProblem: string;
  isFirstRepair?: boolean;
  priorRepairCount?: number;
  priorRepairSpendApprox?: number;
  urgency?: RepairUrgency;
  homeownerContext?: string;
}
