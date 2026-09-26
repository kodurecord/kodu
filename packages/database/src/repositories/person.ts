import type { KoduD1Client } from "../client";
import type { Person, CreatePersonInput, UpdatePersonInput } from "@kodu/entity-schema";
import { ulid } from "../ulid";

export interface PersonRepository {
  findById(id: string): Promise<Person | null>;
  findByEmail(email: string): Promise<Person | null>;
  create(input: CreatePersonInput): Promise<Person>;
  /** Find person by email; if not found, create one. Returns {person, created}. */
  findOrCreateByEmail(email: string, input: CreatePersonInput): Promise<{ person: Person; created: boolean }>;
  update(id: string, input: UpdatePersonInput): Promise<Person | null>;
}

export function createPersonRepository(db: KoduD1Client): PersonRepository {
  return {
    async findById(id) {
      return db.queryOne<Person>(
        "SELECT * FROM persons WHERE id = ?",
        [id]
      );
    },

    async findByEmail(email) {
      // Normalize email to lowercase for lookup
      return db.queryOne<Person>(
        "SELECT * FROM persons WHERE LOWER(email) = LOWER(?) LIMIT 1",
        [email]
      );
    },

    async create(input) {
      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO persons (id, first_name, last_name, full_name, email, phone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.firstName ?? null,
          input.lastName ?? null,
          input.fullName ?? null,
          input.email ? input.email.toLowerCase().trim() : null,
          input.phone ?? null,
          now,
          now,
        ]
      );
      const created = await db.queryOne<Person>(
        "SELECT * FROM persons WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created person");
      return created;
    },

    async findOrCreateByEmail(email, input) {
      const normalized = email.toLowerCase().trim();
      const existing = await db.queryOne<Person>(
        "SELECT * FROM persons WHERE LOWER(email) = ? LIMIT 1",
        [normalized]
      );
      if (existing) {
        // Non-destructive update: fill in first_name if not already set
        const row = existing as unknown as Record<string, unknown>;
        if (!row['first_name'] && input.firstName) {
          const now = new Date().toISOString();
          await db.run(
            "UPDATE persons SET first_name = ?, updated_at = ? WHERE id = ?",
            [input.firstName, now, existing.id]
          );
        }
        const refreshed = await db.queryOne<Person>(
          "SELECT * FROM persons WHERE id = ?",
          [existing.id]
        );
        return { person: refreshed ?? existing, created: false };
      }
      const person = await this.create({ ...input, email: normalized });
      return { person, created: true };
    },

    async update(id, input) {
      const now = new Date().toISOString();
      await db.run(
        `UPDATE persons
         SET first_name = COALESCE(?, first_name),
             last_name  = COALESCE(?, last_name),
             full_name  = COALESCE(?, full_name),
             phone      = COALESCE(?, phone),
             updated_at = ?
         WHERE id = ?`,
        [
          input.firstName ?? null,
          input.lastName ?? null,
          input.fullName ?? null,
          input.phone ?? null,
          now,
          id,
        ]
      );
      return db.queryOne<Person>("SELECT * FROM persons WHERE id = ?", [id]);
    },
  };
}
