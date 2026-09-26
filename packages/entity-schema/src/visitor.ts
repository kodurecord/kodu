// Visitor — a pseudonymous first-party identity.
// visitor_id is a ULID stored in a first-party cookie/localStorage.
// NOT the IP address. The visitor can later be linked to a Person when
// they identify themselves (e.g., at PDF report request time).

export interface Visitor {
  id: string;        // ULID — set client-side in first-party cookie
  personId?: string; // set when visitor provides their identity
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface CreateVisitorInput {
  id: string;   // ULID generated client-side
}

// ── Session ───────────────────────────────────────────────────────────────────
// One session per browser visit / page load.

export type KoduApp = 'repair' | 'warranty' | 'permit' | 'record' | 'kodu';

export type ConsentState = 'unknown' | 'minimal' | 'analytics' | 'full';

export interface Session {
  id: string;         // ULID
  visitorId: string;
  app: KoduApp;

  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;

  gclid?: string;
  fbclid?: string;
  ttclid?: string;

  landingPage?: string;
  referrerUrl?: string;
  referrerDomain?: string;

  deviceType?: string;    // 'mobile' | 'tablet' | 'desktop' | 'unknown'
  browserFamily?: string; // 'chrome' | 'safari' | 'firefox' | 'edge' | 'other'

  consentState: ConsentState;

  startedAt: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface CreateSessionInput {
  id: string;         // ULID generated client-side
  visitorId: string;
  app?: KoduApp;

  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;

  gclid?: string;
  fbclid?: string;
  ttclid?: string;

  landingPage?: string;
  referrerUrl?: string;
  referrerDomain?: string;

  deviceType?: string;
  browserFamily?: string;

  consentState?: ConsentState;
}

// ── Marketing Attribution ─────────────────────────────────────────────────────

export interface MarketingAttribution {
  id: number;
  sessionId: string;
  visitorId: string;
  app: KoduApp;

  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;

  landingPage: string;
  referrerUrl?: string;
  referrerDomain?: string;

  ipCountry?: string;
  ipRegion?: string;

  capturedAt: string;
}
