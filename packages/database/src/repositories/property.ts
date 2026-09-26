import type { KoduD1Client } from "../client";
import type { Property, CreatePropertyInput } from "@kodu/entity-schema";
import { ulid } from "../ulid";

export interface PropertyRepository {
  findById(id: string): Promise<Property | null>;
  create(input: CreatePropertyInput): Promise<Property>;
  update(id: string, patch: Partial<CreatePropertyInput>): Promise<Property | null>;
}

export function createPropertyRepository(db: KoduD1Client): PropertyRepository {
  return {
    async findById(id) {
      return db.queryOne<Property>(
        "SELECT * FROM properties WHERE id = ?",
        [id]
      );
    },

    async create(input) {
      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO properties (
           id, street_line_1, street_line_2, city, state, zip, country,
           year_built, gross_sqft, property_type,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.streetLine1,
          input.streetLine2 ?? null,
          input.city,
          input.state,
          input.zip,
          input.country ?? "US",
          input.yearBuilt ?? null,
          input.grossSqft ?? null,
          input.propertyType ?? null,
          now,
          now,
        ]
      );
      const created = await db.queryOne<Property>(
        "SELECT * FROM properties WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created property");
      return created;
    },

    async update(id, patch) {
      const now = new Date().toISOString();
      const sets: string[] = ["updated_at = ?"];
      const vals: (string | number | null)[] = [now];

      if (patch.streetLine1 !== undefined) { sets.push("street_line_1 = ?"); vals.push(patch.streetLine1); }
      if (patch.streetLine2 !== undefined) { sets.push("street_line_2 = ?"); vals.push(patch.streetLine2 ?? null); }
      if (patch.city !== undefined) { sets.push("city = ?"); vals.push(patch.city); }
      if (patch.state !== undefined) { sets.push("state = ?"); vals.push(patch.state); }
      if (patch.zip !== undefined) { sets.push("zip = ?"); vals.push(patch.zip); }
      if (patch.yearBuilt !== undefined) { sets.push("year_built = ?"); vals.push(patch.yearBuilt ?? null); }
      if (patch.grossSqft !== undefined) { sets.push("gross_sqft = ?"); vals.push(patch.grossSqft ?? null); }
      if (patch.propertyType !== undefined) { sets.push("property_type = ?"); vals.push(patch.propertyType ?? null); }

      vals.push(id);
      await db.run(
        `UPDATE properties SET ${sets.join(", ")} WHERE id = ?`,
        vals
      );
      return this.findById(id);
    },
  };
}
