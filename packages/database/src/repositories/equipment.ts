import type { KoduD1Client } from "../client";
import type {
  Equipment,
  EquipmentFact,
  EquipmentWithFacts,
  CreateEquipmentInput,
  EquipmentStatus,
} from "@kodu/entity-schema";
import { ulid } from "../ulid";

export interface EquipmentRepository {
  findById(id: string): Promise<Equipment | null>;
  findByProperty(propertyId: string): Promise<Equipment[]>;
  findWithFacts(id: string): Promise<EquipmentWithFacts | null>;
  create(input: CreateEquipmentInput): Promise<Equipment>;
  updateStatus(id: string, status: EquipmentStatus): Promise<void>;
  addFact(
    equipmentId: string,
    factKey: string,
    factValue: string,
    provenanceId?: number
  ): Promise<EquipmentFact>;
  getCurrentFacts(equipmentId: string): Promise<EquipmentFact[]>;
}

export function createEquipmentRepository(
  db: KoduD1Client
): EquipmentRepository {
  return {
    async findById(id) {
      return db.queryOne<Equipment>(
        "SELECT * FROM equipment WHERE id = ?",
        [id]
      );
    },

    async findByProperty(propertyId) {
      return db.query<Equipment>(
        "SELECT * FROM equipment WHERE property_id = ? ORDER BY created_at DESC",
        [propertyId]
      );
    },

    async findWithFacts(id) {
      const equipment = await db.queryOne<Equipment>(
        "SELECT * FROM equipment WHERE id = ?",
        [id]
      );
      if (!equipment) return null;

      const facts = await db.query<EquipmentFact>(
        `SELECT * FROM equipment_facts
         WHERE equipment_id = ? AND superseded_at IS NULL
         ORDER BY recorded_at ASC`,
        [id]
      );

      return { ...equipment, facts };
    },

    async create(input) {
      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO equipment
           (id, property_id, category_key, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`,
        [id, input.propertyId, input.categoryKey, now, now]
      );
      const created = await db.queryOne<Equipment>(
        "SELECT * FROM equipment WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created equipment");
      return created;
    },

    async updateStatus(id, status) {
      await db.run(
        "UPDATE equipment SET status = ?, updated_at = ? WHERE id = ?",
        [status, new Date().toISOString(), id]
      );
    },

    async addFact(equipmentId, factKey, factValue, provenanceId) {
      const now = new Date().toISOString();

      // Supersede any existing active fact for this key
      await db.run(
        `UPDATE equipment_facts
         SET superseded_at = ?
         WHERE equipment_id = ? AND fact_key = ? AND superseded_at IS NULL`,
        [now, equipmentId, factKey]
      );

      const { last_row_id } = await db.run(
        `INSERT INTO equipment_facts
           (equipment_id, fact_key, fact_value, provenance_id, recorded_at)
         VALUES (?, ?, ?, ?, ?)`,
        [equipmentId, factKey, factValue, provenanceId ?? null, now]
      );

      const fact = await db.queryOne<EquipmentFact>(
        "SELECT * FROM equipment_facts WHERE rowid = ?",
        [last_row_id]
      );
      if (!fact) throw new Error("Failed to retrieve created fact");
      return fact;
    },

    async getCurrentFacts(equipmentId) {
      return db.query<EquipmentFact>(
        `SELECT * FROM equipment_facts
         WHERE equipment_id = ? AND superseded_at IS NULL
         ORDER BY fact_key ASC`,
        [equipmentId]
      );
    },
  };
}
