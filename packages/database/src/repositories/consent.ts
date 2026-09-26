import type { KoduD1Client } from "../client";
import type { CommunicationConsent, CreateConsentInput, ConsentPurpose } from "@kodu/entity-schema";

export interface ConsentRepository {
  create(input: CreateConsentInput): Promise<CommunicationConsent>;
  findLatest(personId: string, purpose: ConsentPurpose): Promise<CommunicationConsent | null>;
  findAllByPerson(personId: string): Promise<CommunicationConsent[]>;
  hasActiveConsent(personId: string, purpose: ConsentPurpose): Promise<boolean>;
  withdraw(personId: string, purpose: ConsentPurpose): Promise<void>;
}

export function createConsentRepository(db: KoduD1Client): ConsentRepository {
  return {
    async create(input) {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO communication_consents (
           person_id, visitor_id, purpose, granted,
           consent_version, source, app,
           ip_country, ip_region, granted_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.personId ?? null,
          input.visitorId ?? null,
          input.purpose,
          input.granted ? 1 : 0,
          input.consentVersion ?? null,
          input.source ?? null,
          input.app ?? 'repair',
          input.ipCountry ?? null,
          input.ipRegion ?? null,
          now,
          now,
        ]
      );
      const created = await db.queryOne<CommunicationConsent>(
        "SELECT * FROM communication_consents WHERE rowid = last_insert_rowid()"
      );
      if (!created) throw new Error("Failed to retrieve created consent");
      return created;
    },

    async findLatest(personId, purpose) {
      return db.queryOne<CommunicationConsent>(
        `SELECT * FROM communication_consents
         WHERE person_id = ? AND purpose = ?
         ORDER BY granted_at DESC LIMIT 1`,
        [personId, purpose]
      );
    },

    async findAllByPerson(personId) {
      return db.query<CommunicationConsent>(
        `SELECT * FROM communication_consents
         WHERE person_id = ?
         ORDER BY granted_at DESC`,
        [personId]
      );
    },

    async hasActiveConsent(personId, purpose) {
      const latest = await this.findLatest(personId, purpose);
      if (!latest) return false;
      const row = latest as unknown as Record<string, unknown>;
      // granted=1 and withdrawn_at is NULL means active consent
      return row['granted'] === 1 && !row['withdrawn_at'];
    },

    async withdraw(personId, purpose) {
      const now = new Date().toISOString();
      // Set withdrawn_at on all active grants for this person+purpose
      await db.run(
        `UPDATE communication_consents
         SET withdrawn_at = ?
         WHERE person_id = ? AND purpose = ? AND withdrawn_at IS NULL AND granted = 1`,
        [now, personId, purpose]
      );
    },
  };
}
