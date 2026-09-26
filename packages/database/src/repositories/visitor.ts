import type { KoduD1Client } from "../client";
import type { Visitor, CreateVisitorInput, Session, CreateSessionInput, MarketingAttribution } from "@kodu/entity-schema";
import { ulid } from "../ulid";

// ── Visitor Repository ────────────────────────────────────────────────────────

export interface VisitorRepository {
  findById(id: string): Promise<Visitor | null>;
  findOrCreate(id: string): Promise<Visitor>;
  linkToPerson(visitorId: string, personId: string): Promise<void>;
  touch(id: string): Promise<void>;
}

export function createVisitorRepository(db: KoduD1Client): VisitorRepository {
  return {
    async findById(id) {
      return db.queryOne<Visitor>(
        "SELECT * FROM visitors WHERE id = ?",
        [id]
      );
    },

    async findOrCreate(id) {
      const existing = await db.queryOne<Visitor>(
        "SELECT * FROM visitors WHERE id = ?",
        [id]
      );
      if (existing) {
        // Update last_seen_at on each re-encounter
        await db.run(
          "UPDATE visitors SET last_seen_at = ? WHERE id = ?",
          [new Date().toISOString(), id]
        );
        return existing;
      }
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO visitors (id, first_seen_at, last_seen_at, created_at)
         VALUES (?, ?, ?, ?)`,
        [id, now, now, now]
      );
      const created = await db.queryOne<Visitor>(
        "SELECT * FROM visitors WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created visitor");
      return created;
    },

    async linkToPerson(visitorId, personId) {
      await db.run(
        "UPDATE visitors SET person_id = ?, last_seen_at = ? WHERE id = ?",
        [personId, new Date().toISOString(), visitorId]
      );
    },

    async touch(id) {
      await db.run(
        "UPDATE visitors SET last_seen_at = ? WHERE id = ?",
        [new Date().toISOString(), id]
      );
    },
  };
}

// ── Session Repository ────────────────────────────────────────────────────────

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  create(input: CreateSessionInput): Promise<Session>;
  touch(id: string): Promise<void>;
  createAttribution(sessionId: string, visitorId: string, input: Partial<MarketingAttribution>): Promise<void>;
}

export function createSessionRepository(db: KoduD1Client): SessionRepository {
  return {
    async findById(id) {
      return db.queryOne<Session>(
        "SELECT * FROM sessions WHERE id = ?",
        [id]
      );
    },

    async create(input) {
      const now = new Date().toISOString();
      const app = input.app ?? 'repair';
      await db.run(
        `INSERT INTO sessions (
           id, visitor_id, app,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term,
           gclid, fbclid, ttclid,
           landing_page, referrer_url, referrer_domain,
           device_type, browser_family, consent_state,
           started_at, last_active_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.visitorId,
          app,
          input.utmSource ?? null,
          input.utmMedium ?? null,
          input.utmCampaign ?? null,
          input.utmContent ?? null,
          input.utmTerm ?? null,
          input.gclid ?? null,
          input.fbclid ?? null,
          input.ttclid ?? null,
          input.landingPage ?? null,
          input.referrerUrl ?? null,
          input.referrerDomain ?? null,
          input.deviceType ?? null,
          input.browserFamily ?? null,
          input.consentState ?? 'unknown',
          now,
          now,
          now,
        ]
      );
      const created = await db.queryOne<Session>(
        "SELECT * FROM sessions WHERE id = ?",
        [input.id]
      );
      if (!created) throw new Error("Failed to retrieve created session");
      return created;
    },

    async touch(id) {
      await db.run(
        "UPDATE sessions SET last_active_at = ? WHERE id = ?",
        [new Date().toISOString(), id]
      );
    },

    async createAttribution(sessionId, visitorId, input) {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO marketing_attribution (
           session_id, visitor_id, app,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term,
           gclid, fbclid, ttclid,
           landing_page, referrer_url, referrer_domain,
           ip_country, ip_region, captured_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          visitorId,
          input.app ?? 'repair',
          input.utmSource ?? null,
          input.utmMedium ?? null,
          input.utmCampaign ?? null,
          input.utmContent ?? null,
          input.utmTerm ?? null,
          input.gclid ?? null,
          input.fbclid ?? null,
          input.ttclid ?? null,
          input.landingPage ?? '',
          input.referrerUrl ?? null,
          input.referrerDomain ?? null,
          input.ipCountry ?? null,
          input.ipRegion ?? null,
          now,
        ]
      );
    },
  };
}
