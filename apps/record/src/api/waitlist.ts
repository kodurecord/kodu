/**
 * POST /api/waitlist — Join the KODU Record waitlist.
 *
 * Flow:
 *   1. Validate firstName + email + visitorId
 *   2. find-or-create Person by email (non-destructive, shared infrastructure)
 *   3. Link visitor → person
 *   4. Record transactional consent (always); marketing consent if opted in
 *   5. Upsert product_waitlists row (idempotent — duplicate submissions are safe)
 *   6. Send Mailgun confirmation email
 *   7. Record email_delivery
 *   8. Batch-insert KODU events (record_waitlist_submitted, record_waitlist_confirmation_sent)
 *
 * All infrastructure (Person, Visitor, Session, Consent, Event, EmailDelivery) is
 * shared across the KODU ecosystem. This handler does NOT build a disconnected
 * lead database — it uses the same kodu-core-db D1 schema as every other KODU product.
 */

import {
  createPersonRepository,
  createVisitorRepository,
  createEmailDeliveryRepository,
  createConsentRepository,
  createEventRepository,
  createWaitlistRepository,
} from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";
import { KODU_EVENTS } from "@kodu/shared-types";
import { sendEmail, buildWaitlistConfirmationHtml, buildWaitlistConfirmationText } from "../services/email";
import type { EmailEnv } from "../services/email";

// ── Request body ──────────────────────────────────────────────────────────────

interface WaitlistRequestBody {
  firstName: string;
  email: string;
  marketingOptIn?: boolean;

  visitorId: string;
  sessionId: string;

  // Optional attribution
  audienceSegment?: string;
  source?: string;
  consentVersion?: string;
  ipCountry?: string;
  ipRegion?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleWaitlistJoin(
  request: Request,
  db: KoduD1Client,
  env: EmailEnv & { CF_WORKER_ENV?: string }
): Promise<Response> {
  let body: WaitlistRequestBody;
  try {
    body = await request.json() as WaitlistRequestBody;
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

  const firstName = body.firstName.trim();
  const email = body.email.trim().toLowerCase();
  const marketingOptIn = body.marketingOptIn === true;

  // ── Repositories ──────────────────────────────────────────────────────────

  const personRepo = createPersonRepository(db);
  const visitorRepo = createVisitorRepository(db);
  const deliveryRepo = createEmailDeliveryRepository(db);
  const consentRepo = createConsentRepository(db);
  const eventRepo = createEventRepository(db);
  const waitlistRepo = createWaitlistRepository(db);

  // ── 1. Find or create Person ──────────────────────────────────────────────

  const { person } = await personRepo.findOrCreateByEmail(email, { firstName });
  const personId = person.id as string;

  // ── 2. Link visitor → person ──────────────────────────────────────────────

  await visitorRepo.linkToPerson(body.visitorId, personId);

  // ── 3. Record consents ────────────────────────────────────────────────────

  const consentMeta = {
    personId,
    visitorId: body.visitorId,
    consentVersion: body.consentVersion ?? '1.0',
    source: 'record_waitlist_form',
    app: 'record' as const,
    ipCountry: body.ipCountry,
    ipRegion: body.ipRegion,
  };

  // Transactional confirmation email — always granted when joining waitlist
  await consentRepo.create({
    ...consentMeta,
    purpose: 'transactional_report',
    granted: true,
  });

  // Product communications — joining waitlist implies product comms consent
  await consentRepo.create({
    ...consentMeta,
    purpose: 'product_comms',
    granted: true,
  });

  // Marketing consent — only if checkbox was explicitly checked
  if (marketingOptIn) {
    await consentRepo.create({
      ...consentMeta,
      purpose: 'marketing_email',
      granted: true,
    });
  }

  // ── 4. Upsert waitlist record ─────────────────────────────────────────────

  const { waitlist, alreadyExists } = await waitlistRepo.upsert({
    app: 'record',
    personId,
    visitorId: body.visitorId,
    sessionId: body.sessionId,
    audienceSegment: body.audienceSegment,
    source: body.source ?? 'organic',
  });

  const waitlistId = waitlist.id as string;

  // ── 5. Send Mailgun confirmation ──────────────────────────────────────────

  const personFullName = (person as unknown as Record<string, unknown>)['first_name'] as string ?? firstName;

  let mailgunMessageId: string | undefined;
  let deliveryError: string | undefined;

  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    deliveryError = 'Email provider not configured';
    console.error('[waitlist] Mailgun not configured — skipping confirmation email');
  } else {
    try {
      const result = await sendEmail(env, {
        to: email,
        toName: personFullName,
        subject: "You're on the KODU Record waitlist",
        htmlBody: buildWaitlistConfirmationHtml({ firstName }),
        textBody: buildWaitlistConfirmationText({ firstName }),
        tag: 'record-waitlist-confirmation',
      });
      mailgunMessageId = result.messageId;
    } catch (err) {
      deliveryError = err instanceof Error ? err.message : String(err);
      console.error('[waitlist] Mailgun send error:', deliveryError);
    }
  }

  // ── 6. Record email_delivery ──────────────────────────────────────────────

  let deliveryId: string | undefined;

  if (mailgunMessageId || !deliveryError) {
    // Only create a delivery record if we attempted to send
    try {
      const delivery = await deliveryRepo.create({
        app: 'record',
        personId,
        purpose: 'transactional_report',
        toEmail: email,
        toName: personFullName,
        subject: "You're on the KODU Record waitlist",
        templateKey: 'record_waitlist_confirmation_v1',
        mailgunTag: 'record-waitlist-confirmation',
      });

      deliveryId = (delivery as unknown as Record<string, unknown>)['id'] as string;

      if (mailgunMessageId && deliveryId) {
        await deliveryRepo.updateStatus(deliveryId, 'queued', {
          mailgunMessageId,
        });
      } else if (deliveryError && deliveryId) {
        await deliveryRepo.updateStatus(deliveryId, 'failed', {
          failureReason: deliveryError,
        });
      }
    } catch (err) {
      // Non-fatal: delivery tracking failure should not block the waitlist join
      console.error('[waitlist] Failed to record email_delivery:', err);
    }
  }

  // ── 7. Batch KODU events ──────────────────────────────────────────────────

  const now = new Date().toISOString();
  const baseEvent = {
    visitorId: body.visitorId,
    sessionId: body.sessionId,
    app: 'record' as const,
    occurredAt: now,
  };

  const events = [
    {
      ...baseEvent,
      eventName: KODU_EVENTS.RECORD_WAITLIST_SUBMITTED,
      properties: {
        person_id: personId,
        waitlist_id: waitlistId,
        already_existed: alreadyExists,
        audience_segment: body.audienceSegment,
        source: body.source ?? 'organic',
        marketing_opt_in: marketingOptIn,
      },
    },
    ...(mailgunMessageId ? [{
      ...baseEvent,
      eventName: KODU_EVENTS.RECORD_WAITLIST_CONFIRMATION_SENT,
      properties: {
        person_id: personId,
        waitlist_id: waitlistId,
        ...(deliveryId ? { delivery_id: deliveryId } : {}),
        mailgun_message_id: mailgunMessageId,
      },
    }] : []),
  ];

  await eventRepo.insertBatch(events);

  // ── Response ──────────────────────────────────────────────────────────────

  return Response.json({
    ok: true,
    waitlistId,
    alreadyExists,
    confirmationSent: !!mailgunMessageId,
    ...(deliveryError ? { warning: 'Confirmation email could not be sent. You are on the waitlist.' } : {}),
  }, { status: alreadyExists ? 200 : 201 });
}
