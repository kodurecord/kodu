/**
 * POST /api/reports — Request a PDF report for a completed analysis.
 *
 * Flow:
 *   1. Validate firstName + email + analysisId + visitorId
 *   2. find-or-create Person by email (non-destructive)
 *   3. Link visitor → person
 *   4. Record consents (transactional always; marketing only if opted in)
 *   5. Create generated_report record
 *   6. Generate HTML report content
 *   7. Send via Mailgun
 *   8. Record email_delivery with Mailgun message ID
 *   9. Update report status (ready or failed)
 *  10. Batch-insert funnel events
 */

import {
  createPersonRepository,
  createVisitorRepository,
  createAnalysisRepository,
  createGeneratedReportRepository,
  createEmailDeliveryRepository,
  createConsentRepository,
  createEventRepository,
} from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";
import { KODU_EVENTS } from "@kodu/shared-types";
import { generateReportHtml } from "../services/pdf";
import { sendEmail, buildReportEmailHtml, buildReportEmailText } from "../services/email";
import type { EmailEnv } from "../services/email";

// ── Request body ──────────────────────────────────────────────────────────────

interface ReportRequestBody {
  // Contact capture
  firstName: string;
  email: string;
  marketingOptIn?: boolean;

  // Context
  visitorId: string;
  sessionId: string;
  analysisId: string;

  // Optional: consent metadata
  consentVersion?: string;
  ipCountry?: string;
  ipRegion?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleReportRequest(
  request: Request,
  db: KoduD1Client,
  env: EmailEnv & { CF_WORKER_ENV?: string }
): Promise<Response> {
  let body: ReportRequestBody;
  try {
    body = await request.json() as ReportRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Validation ────────────────────────────────────────────────────────────

  if (!body.firstName || typeof body.firstName !== 'string' || !body.firstName.trim()) {
    return Response.json({ error: "firstName is required" }, { status: 400 });
  }
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return Response.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!body.visitorId || typeof body.visitorId !== 'string') {
    return Response.json({ error: "visitorId is required" }, { status: 400 });
  }
  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!body.analysisId || typeof body.analysisId !== 'string') {
    return Response.json({ error: "analysisId is required" }, { status: 400 });
  }

  const firstName = body.firstName.trim();
  const email = body.email.trim().toLowerCase();
  const marketingOptIn = body.marketingOptIn === true;

  // ── Repositories ──────────────────────────────────────────────────────────

  const personRepo = createPersonRepository(db);
  const visitorRepo = createVisitorRepository(db);
  const analysisRepo = createAnalysisRepository(db);
  const reportRepo = createGeneratedReportRepository(db);
  const deliveryRepo = createEmailDeliveryRepository(db);
  const consentRepo = createConsentRepository(db);
  const eventRepo = createEventRepository(db);

  // ── 1. Load analysis ──────────────────────────────────────────────────────

  const analysis = await analysisRepo.findById(body.analysisId);
  if (!analysis) {
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  const analysisRow = analysis as unknown as Record<string, unknown>;
  const repairEventId = (analysisRow['repair_event_id'] ?? analysisRow['repairEventId']) as string | undefined;
  const overallLean = (analysisRow['overall_lean'] ?? analysisRow['overallLean'] ?? 'inconclusive') as string;
  const confidence = (analysisRow['confidence']) as string | undefined;
  const engineVersion = (analysisRow['engine_version'] ?? analysisRow['engineVersion'] ?? '1') as string;
  const factorsRaw = analysisRow['factors'];
  let factors: Array<{ factorType: string; direction: string; weight: string; explanation: string }> = [];
  try {
    factors = typeof factorsRaw === 'string'
      ? JSON.parse(factorsRaw)
      : Array.isArray(factorsRaw) ? factorsRaw : [];
  } catch { factors = []; }

  // ── 2. Find or create person ──────────────────────────────────────────────

  const { person } = await personRepo.findOrCreateByEmail(email, { firstName });

  // ── 3. Link visitor → person ──────────────────────────────────────────────

  await visitorRepo.linkToPerson(body.visitorId, person.id as string);

  // ── 4. Record consents ────────────────────────────────────────────────────

  const consentMeta = {
    personId: person.id as string,
    visitorId: body.visitorId,
    consentVersion: body.consentVersion ?? '1.0',
    source: 'pdf_request_form',
    app: 'repair' as const,
    ipCountry: body.ipCountry,
    ipRegion: body.ipRegion,
  };

  // Transactional report consent — always granted at PDF request
  await consentRepo.create({
    ...consentMeta,
    purpose: 'transactional_report',
    granted: true,
  });

  // Marketing consent — only if checkbox was checked
  if (marketingOptIn) {
    await consentRepo.create({
      ...consentMeta,
      purpose: 'marketing_email',
      granted: true,
    });
  }

  // ── 5. Create generated_report record ─────────────────────────────────────

  const report = await reportRepo.create({
    app: 'repair',
    repairEventId: repairEventId,
    analysisId: body.analysisId,
    personId: person.id as string,
    visitorId: body.visitorId,
    sessionId: body.sessionId,
    reportType: 'repair_analysis',
    reportVersion: '1',
    format: 'html',
  });

  const reportId = (report as unknown as Record<string, unknown>)['id'] as string;

  // ── 6. Generate HTML report ───────────────────────────────────────────────

  // Gather equipment label from analysis properties or repair_event if available
  let equipmentLabel = 'your equipment';
  let categoryKey = 'unknown';
  let repairQuoteTotal: number | undefined;

  try {
    const propsRaw = analysisRow['input_snapshot'] ?? analysisRow['inputSnapshot'];
    if (propsRaw && typeof propsRaw === 'string') {
      const props = JSON.parse(propsRaw);
      equipmentLabel = props.equipmentLabel ?? props.equipment_label ?? equipmentLabel;
      categoryKey = props.categoryKey ?? props.category_key ?? categoryKey;
      repairQuoteTotal = props.repairQuoteTotal ?? props.repair_quote_total;
    }
  } catch { /* use defaults */ }

  const reportHtml = generateReportHtml({
    reportId,
    firstName,
    email,
    equipmentLabel,
    categoryKey,
    overallLean,
    confidence,
    factors,
    repairQuoteTotal,
    engineVersion,
    generatedAt: new Date().toISOString(),
  });

  // ── 7. Send via Mailgun ───────────────────────────────────────────────────

  const personFullName = (person as unknown as Record<string, unknown>)['first_name'] as string ?? firstName;

  let mailgunMessageId: string | undefined;
  let deliveryStatus: 'queued' | 'failed' = 'queued';
  let deliveryError: string | undefined;

  // Email body: brief wrapper email + full report HTML inline
  const emailHtml = buildReportEmailHtml({
    firstName,
    overallLean,
    equipmentLabel,
    reportId,
    hasPdfAttachment: false, // v1: report is inline HTML
  }) + '\n\n<hr/>\n\n' + reportHtml;

  const emailText = buildReportEmailText({ firstName, overallLean, equipmentLabel });

  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    // Graceful degradation: no email provider configured
    deliveryStatus = 'failed';
    deliveryError = 'Email provider not configured';
    console.error('[reports] Mailgun not configured — skipping email delivery');
  } else {
    try {
      const result = await sendEmail(env, {
        to: email,
        toName: personFullName,
        subject: `Your KODU Repair Report is ready — ${equipmentLabel}`,
        htmlBody: emailHtml,
        textBody: emailText,
        tag: 'repair-report',
      });
      mailgunMessageId = result.messageId;
    } catch (err) {
      deliveryStatus = 'failed';
      deliveryError = err instanceof Error ? err.message : String(err);
      console.error('[reports] Mailgun send error:', deliveryError);
    }
  }

  // ── 8. Record email_delivery ──────────────────────────────────────────────

  const delivery = await deliveryRepo.create({
    reportId,
    personId: person.id as string,
    purpose: 'transactional_report',
    toEmail: email,
    toName: personFullName,
    subject: `Your KODU Repair Report is ready — ${equipmentLabel}`,
    templateKey: 'repair_report_v1',
    mailgunTag: 'repair-report',
  });

  const deliveryId = (delivery as unknown as Record<string, unknown>)['id'] as string;

  if (mailgunMessageId) {
    await deliveryRepo.updateStatus(deliveryId, 'queued', {
      mailgunMessageId,
    });
  } else if (deliveryStatus === 'failed') {
    await deliveryRepo.updateStatus(deliveryId, 'failed', {
      failureReason: deliveryError,
    });
  }

  // ── 9. Update report status ───────────────────────────────────────────────

  await reportRepo.updateStatus(reportId, 'ready', {
    generatedAt: new Date().toISOString(),
  });

  // ── 10. Batch events ──────────────────────────────────────────────────────

  const now = new Date().toISOString();
  const baseEvent = {
    visitorId: body.visitorId,
    sessionId: body.sessionId,
    app: 'repair' as const,
    repairEventId,
    occurredAt: now,
  };

  const events = [
    {
      ...baseEvent,
      eventName: KODU_EVENTS.CONTACT_SUBMITTED,
      properties: {
        person_id: person.id,
        marketing_opt_in: marketingOptIn,
      },
    },
    {
      ...baseEvent,
      eventName: KODU_EVENTS.PDF_GENERATED,
      properties: {
        report_id: reportId,
        format: 'html',
        engine_version: engineVersion,
      },
    },
    ...(mailgunMessageId ? [{
      ...baseEvent,
      eventName: KODU_EVENTS.PDF_DELIVERED,
      properties: {
        report_id: reportId,
        delivery_id: deliveryId,
        mailgun_message_id: mailgunMessageId,
      },
    }] : []),
  ];

  await eventRepo.insertBatch(events);

  // ── Response ──────────────────────────────────────────────────────────────

  return Response.json({
    ok: true,
    reportId,
    deliveryId,
    emailQueued: !!mailgunMessageId,
    ...(deliveryError ? { warning: 'Email delivery failed. Your report was generated but could not be sent.' } : {}),
  }, { status: 201 });
}
