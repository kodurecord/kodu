import type { KoduD1Client } from "../client";
import type { RepairEvent, CreateRepairEventInput, RepairEventStatus } from "@kodu/entity-schema";
import { ulid } from "../ulid";

export interface RepairEventRepository {
  findById(id: string): Promise<RepairEvent | null>;
  findByEquipment(equipmentId: string): Promise<RepairEvent[]>;
  findByProperty(propertyId: string): Promise<RepairEvent[]>;
  create(input: CreateRepairEventInput): Promise<RepairEvent>;
  updateStatus(id: string, status: RepairEventStatus): Promise<void>;
}

export function createRepairEventRepository(
  db: KoduD1Client
): RepairEventRepository {
  return {
    async findById(id) {
      return db.queryOne<RepairEvent>(
        "SELECT * FROM repair_events WHERE id = ?",
        [id]
      );
    },

    async findByEquipment(equipmentId) {
      return db.query<RepairEvent>(
        `SELECT * FROM repair_events
         WHERE equipment_id = ?
         ORDER BY event_date DESC`,
        [equipmentId]
      );
    },

    async findByProperty(propertyId) {
      return db.query<RepairEvent>(
        `SELECT * FROM repair_events
         WHERE property_id = ?
         ORDER BY event_date DESC`,
        [propertyId]
      );
    },

    async create(input) {
      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO repair_events (
           id, equipment_id, property_id, project_id,
           event_date, description_of_problem, is_first_repair,
           prior_repair_count, prior_repair_spend_approx,
           urgency, homeowner_context, status,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        [
          id,
          input.equipmentId,
          input.propertyId,
          input.projectId ?? null,
          input.eventDate,
          input.descriptionOfProblem,
          input.isFirstRepair === true ? 1 : input.isFirstRepair === false ? 0 : null,
          input.priorRepairCount ?? null,
          input.priorRepairSpendApprox ?? null,
          input.urgency ?? null,
          input.homeownerContext ?? null,
          now,
          now,
        ]
      );
      const created = await db.queryOne<RepairEvent>(
        "SELECT * FROM repair_events WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created repair event");
      return created;
    },

    async updateStatus(id, status) {
      await db.run(
        "UPDATE repair_events SET status = ?, updated_at = ? WHERE id = ?",
        [status, new Date().toISOString(), id]
      );
    },
  };
}
