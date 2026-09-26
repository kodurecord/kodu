import type { KoduD1Client } from "../client";
import type { KoduEvent, CreateEventInput, CreateEventsInput } from "@kodu/entity-schema";

export interface EventRepository {
  insert(input: CreateEventInput): Promise<void>;
  insertBatch(inputs: CreateEventsInput): Promise<void>;
  findByVisitor(visitorId: string, limit?: number): Promise<KoduEvent[]>;
  findBySession(sessionId: string): Promise<KoduEvent[]>;
  findByRepairEvent(repairEventId: string): Promise<KoduEvent[]>;
}

export function createEventRepository(db: KoduD1Client): EventRepository {
  return {
    async insert(input) {
      const now = input.occurredAt ?? new Date().toISOString();
      await db.run(
        `INSERT INTO events (
           visitor_id, session_id, app, event_name,
           repair_event_id, properties, occurred_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.visitorId,
          input.sessionId,
          input.app ?? 'repair',
          input.eventName,
          input.repairEventId ?? null,
          input.properties ? JSON.stringify(input.properties) : null,
          now,
        ]
      );
    },

    async insertBatch(inputs) {
      // D1 does not support multi-row INSERT VALUES (?),(?),... in a single statement,
      // so we run individual inserts. For small batches (< 20 events) this is fine.
      // If high-volume batching is needed, use D1 batch API.
      for (const input of inputs) {
        await this.insert(input);
      }
    },

    async findByVisitor(visitorId, limit = 100) {
      return db.query<KoduEvent>(
        `SELECT * FROM events WHERE visitor_id = ?
         ORDER BY occurred_at DESC LIMIT ?`,
        [visitorId, limit]
      );
    },

    async findBySession(sessionId) {
      return db.query<KoduEvent>(
        `SELECT * FROM events WHERE session_id = ?
         ORDER BY occurred_at ASC`,
        [sessionId]
      );
    },

    async findByRepairEvent(repairEventId) {
      return db.query<KoduEvent>(
        `SELECT * FROM events WHERE repair_event_id = ?
         ORDER BY occurred_at ASC`,
        [repairEventId]
      );
    },
  };
}
