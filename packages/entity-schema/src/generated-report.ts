// GeneratedReport — a first-class KODU record of every PDF or report produced.
// Traceable: person → property → equipment → repair_event → analysis → report.
// Visitor/session attribution is preserved for acquisition analytics.

import type { KoduApp } from "./visitor";

export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type ReportFormat = 'pdf' | 'html';
export type ReportType = 'repair_analysis' | 'warranty_summary' | 'permit_summary';

export interface GeneratedReport {
  id: string;           // ULID
  app: KoduApp;

  repairEventId?: string;
  analysisId?: string;
  personId?: string;
  visitorId?: string;
  sessionId?: string;

  reportType: ReportType;
  reportVersion: string;

  r2Bucket?: string;
  r2Key?: string;
  fileSizeBytes?: number;
  format: ReportFormat;

  status: ReportStatus;
  generatedAt?: string;
  generationError?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateGeneratedReportInput {
  app?: KoduApp;
  repairEventId?: string;
  analysisId?: string;
  personId?: string;
  visitorId?: string;
  sessionId?: string;
  reportType?: ReportType;
  reportVersion?: string;
  format?: ReportFormat;
}

// ── Email Delivery ────────────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'complained'
  | 'unsubscribed';

export type DeliveryPurpose =
  | 'transactional_report'
  | 'marketing_email'
  | 'product_comms';

export interface EmailDelivery {
  id: string;           // ULID
  app: KoduApp;         // originating KODU product; used for Mailgun webhook attribution
  reportId?: string;
  personId?: string;

  purpose: DeliveryPurpose;
  toEmail: string;
  toName?: string;
  subject?: string;
  templateKey?: string;

  mailgunMessageId?: string;
  mailgunTag?: string;

  status: DeliveryStatus;
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;

  lastWebhookPayload?: string;
  lastWebhookAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailDeliveryInput {
  app?: KoduApp;        // originating product; defaults to 'repair'
  reportId?: string;
  personId?: string;
  purpose: DeliveryPurpose;
  toEmail: string;
  toName?: string;
  subject?: string;
  templateKey?: string;
  mailgunTag?: string;
}

// ── Product Waitlist ──────────────────────────────────────────────────────────

export type WaitlistStatus = 'joined' | 'confirmed' | 'invited' | 'activated' | 'unsubscribed';

export interface ProductWaitlist {
  id: string;           // ULID
  app: KoduApp;

  personId: string;
  visitorId?: string;
  sessionId?: string;

  status: WaitlistStatus;
  audienceSegment?: string;
  source?: string;

  createdAt: string;
  confirmedAt?: string;
  invitedAt?: string;
  activatedAt?: string;
}

export interface CreateWaitlistInput {
  app: KoduApp;
  personId: string;
  visitorId?: string;
  sessionId?: string;
  audienceSegment?: string;
  source?: string;
}

export interface UpdateWaitlistStatusInput {
  status: WaitlistStatus;
  confirmedAt?: string;
  invitedAt?: string;
  activatedAt?: string;
}

// ── Communication Consent ─────────────────────────────────────────────────────

export type ConsentPurpose =
  | 'transactional_report'
  | 'product_comms'
  | 'marketing_email'
  | 'advertising_retargeting';

export interface CommunicationConsent {
  id: number;
  personId?: string;
  visitorId?: string;
  purpose: ConsentPurpose;
  granted: boolean;
  consentVersion?: string;
  source?: string;
  app: KoduApp;
  ipCountry?: string;
  ipRegion?: string;
  grantedAt: string;
  withdrawnAt?: string;
  createdAt: string;
}

export interface CreateConsentInput {
  personId?: string;
  visitorId?: string;
  purpose: ConsentPurpose;
  granted: boolean;
  consentVersion?: string;
  source?: string;
  app?: KoduApp;
  ipCountry?: string;
  ipRegion?: string;
}
