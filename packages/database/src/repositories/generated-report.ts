import type { KoduD1Client } from "../client";
import type {
  GeneratedReport,
  CreateGeneratedReportInput,
  ReportStatus,
  EmailDelivery,
  CreateEmailDeliveryInput,
  DeliveryStatus,
  ProductWaitlist,
  CreateWaitlistInput,
  UpdateWaitlistStatusInput,
} from "@kodu/entity-schema";
import { ulid } from "../ulid";

// ── Generated Report Repository ───────────────────────────────────────────────

export interface GeneratedReportRepository {
  findById(id: string): Promise<GeneratedReport | null>;
  findByRepairEvent(repairEventId: string): Promise<GeneratedReport[]>;
  findByPerson(personId: string): Promise<GeneratedReport[]>;
  create(input: CreateGeneratedReportInput): Promise<GeneratedReport>;
  updateStatus(id: string, status: ReportStatus, extras?: {
    r2Bucket?: string;
    r2Key?: string;
    fileSizeBytes?: number;
    generatedAt?: string;
    generationError?: string;
  }): Promise<void>;
}

export function createGeneratedReportRepository(
  db: KoduD1Client
): GeneratedReportRepository {
  return {
    async findById(id) {
      return db.queryOne<GeneratedReport>(
        "SELECT * FROM generated_reports WHERE id = ?",
        [id]
      );
    },

    async findByRepairEvent(repairEventId) {
      return db.query<GeneratedReport>(
        "SELECT * FROM generated_reports WHERE repair_event_id = ? ORDER BY created_at DESC",
        [repairEventId]
      );
    },

    async findByPerson(personId) {
      return db.query<GeneratedReport>(
        "SELECT * FROM generated_reports WHERE person_id = ? ORDER BY created_at DESC",
        [personId]
      );
    },

    async create(input) {
      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO generated_reports (
           id, app, repair_event_id, analysis_id, person_id, visitor_id, session_id,
           report_type, report_version, format, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          id,
          input.app ?? 'repair',
          input.repairEventId ?? null,
          input.analysisId ?? null,
          input.personId ?? null,
          input.visitorId ?? null,
          input.sessionId ?? null,
          input.reportType ?? 'repair_analysis',
          input.reportVersion ?? '1',
          input.format ?? 'pdf',
          now,
          now,
        ]
      );
      const created = await db.queryOne<GeneratedReport>(
        "SELECT * FROM generated_reports WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created generated_report");
      return created;
    },

    async updateStatus(id, status, extras = {}) {
      const now = new Date().toISOString();
      await db.run(
        `UPDATE generated_reports
         SET status = ?,
             r2_bucket = COALESCE(?, r2_bucket),
             r2_key = COALESCE(?, r2_key),
             file_size_bytes = COALESCE(?, file_size_bytes),
             generated_at = COALESCE(?, generated_at),
             generation_error = COALESCE(?, generation_error),
             updated_at = ?
         WHERE id = ?`,
        [
          status,
          extras.r2Bucket ?? null,
          extras.r2Key ?? null,
          extras.fileSizeBytes ?? null,
          extras.generatedAt ?? null,
          extras.generationError ?? null,
          now,
          id,
        ]
      );
    },
  };
}

// ── Email Delivery Repository ─────────────────────────────────────────────────

export interface EmailDeliveryRepository {
  findById(id: string): Promise<EmailDelivery | null>;
  findByReport(reportId: string): Promise<EmailDelivery[]>;
  findByMailgunMessageId(messageId: string): Promise<EmailDelivery | null>;
  create(input: CreateEmailDeliveryInput): Promise<EmailDelivery>;
  updateStatus(id: string, status: DeliveryStatus, extras?: {
    mailgunMessageId?: string;
    sentAt?: string;
    deliveredAt?: string;
    failedAt?: string;
    failureReason?: string;
    lastWebhookPayload?: string;
    lastWebhookAt?: string;
  }): Promise<void>;
}

export function createEmailDeliveryRepository(
  db: KoduD1Client
): EmailDeliveryRepository {
  return {
    async findById(id) {
      return db.queryOne<EmailDelivery>(
        "SELECT * FROM email_deliveries WHERE id = ?",
        [id]
      );
    },

    async findByReport(reportId) {
      return db.query<EmailDelivery>(
        "SELECT * FROM email_deliveries WHERE report_id = ? ORDER BY created_at DESC",
        [reportId]
      );
    },

    async findByMailgunMessageId(messageId) {
      return db.queryOne<EmailDelivery>(
        "SELECT * FROM email_deliveries WHERE mailgun_message_id = ? LIMIT 1",
        [messageId]
      );
    },

    async create(input) {
      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO email_deliveries (
           id, app, report_id, person_id, purpose,
           to_email, to_name, subject, template_key, mailgun_tag,
           status, queued_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
        [
          id,
          input.app ?? 'repair',
          input.reportId ?? null,
          input.personId ?? null,
          input.purpose,
          input.toEmail,
          input.toName ?? null,
          input.subject ?? null,
          input.templateKey ?? null,
          input.mailgunTag ?? null,
          now,
          now,
          now,
        ]
      );
      const created = await db.queryOne<EmailDelivery>(
        "SELECT * FROM email_deliveries WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created email_delivery");
      return created;
    },

    async updateStatus(id, status, extras = {}) {
      const now = new Date().toISOString();
      await db.run(
        `UPDATE email_deliveries
         SET status = ?,
             mailgun_message_id = COALESCE(?, mailgun_message_id),
             sent_at = COALESCE(?, sent_at),
             delivered_at = COALESCE(?, delivered_at),
             failed_at = COALESCE(?, failed_at),
             failure_reason = COALESCE(?, failure_reason),
             last_webhook_payload = COALESCE(?, last_webhook_payload),
             last_webhook_at = COALESCE(?, last_webhook_at),
             updated_at = ?
         WHERE id = ?`,
        [
          status,
          extras.mailgunMessageId ?? null,
          extras.sentAt ?? null,
          extras.deliveredAt ?? null,
          extras.failedAt ?? null,
          extras.failureReason ?? null,
          extras.lastWebhookPayload ?? null,
          extras.lastWebhookAt ?? null,
          now,
          id,
        ]
      );
    },
  };
}

// ── Product Waitlist Repository ───────────────────────────────────────────────

export interface WaitlistRepository {
  findByPersonAndApp(personId: string, app: string): Promise<ProductWaitlist | null>;
  findByApp(app: string, limit?: number): Promise<ProductWaitlist[]>;
  /** Insert or ignore if the person is already on this waitlist. Returns the row. */
  upsert(input: CreateWaitlistInput): Promise<{ waitlist: ProductWaitlist; alreadyExists: boolean }>;
  updateStatus(id: string, update: UpdateWaitlistStatusInput): Promise<void>;
}

export function createWaitlistRepository(db: KoduD1Client): WaitlistRepository {
  return {
    async findByPersonAndApp(personId, app) {
      return db.queryOne<ProductWaitlist>(
        "SELECT * FROM product_waitlists WHERE person_id = ? AND app = ? LIMIT 1",
        [personId, app]
      );
    },

    async findByApp(app, limit = 100) {
      return db.query<ProductWaitlist>(
        "SELECT * FROM product_waitlists WHERE app = ? ORDER BY created_at DESC LIMIT ?",
        [app, limit]
      );
    },

    async upsert(input) {
      // Check for existing record first (UNIQUE(person_id, app))
      const existing = await db.queryOne<ProductWaitlist>(
        "SELECT * FROM product_waitlists WHERE person_id = ? AND app = ? LIMIT 1",
        [input.personId, input.app]
      );

      if (existing) {
        return { waitlist: existing, alreadyExists: true };
      }

      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO product_waitlists (
           id, app, person_id, visitor_id, session_id,
           status, audience_segment, source, created_at
         ) VALUES (?, ?, ?, ?, ?, 'joined', ?, ?, ?)`,
        [
          id,
          input.app,
          input.personId,
          input.visitorId ?? null,
          input.sessionId ?? null,
          input.audienceSegment ?? null,
          input.source ?? null,
          now,
        ]
      );

      const created = await db.queryOne<ProductWaitlist>(
        "SELECT * FROM product_waitlists WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created product_waitlist");
      return { waitlist: created, alreadyExists: false };
    },

    async updateStatus(id, update) {
      await db.run(
        `UPDATE product_waitlists
         SET status = ?,
             confirmed_at = COALESCE(?, confirmed_at),
             invited_at   = COALESCE(?, invited_at),
             activated_at = COALESCE(?, activated_at)
         WHERE id = ?`,
        [
          update.status,
          update.confirmedAt ?? null,
          update.invitedAt ?? null,
          update.activatedAt ?? null,
          id,
        ]
      );
    },
  };
}
