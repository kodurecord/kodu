// KoduEvent — append-only activity log entry.
// Event names are defined in @kodu/shared-types KODU_EVENTS.
// Properties is a JSON blob with event-specific payload.
// Never rewrite historical events to add person_id — attribution
// comes via visitor.person_id JOIN.

import type { KoduApp } from "./visitor";

export interface KoduEvent {
  id: number;
  visitorId: string;
  sessionId: string;
  app: KoduApp;
  eventName: string;
  repairEventId?: string;
  properties?: Record<string, unknown>;
  occurredAt: string;
  retainDays: number;
}

export interface CreateEventInput {
  visitorId: string;
  sessionId: string;
  app?: KoduApp;
  eventName: string;
  repairEventId?: string;
  properties?: Record<string, unknown>;
  occurredAt?: string; // defaults to now
}

// Batch event input — the client sends an array to reduce round-trips
export type CreateEventsInput = CreateEventInput[];
