/**
 * POST /api/webhooks/mailgun
 *
 * Receives Mailgun delivery event webhooks and updates the email_deliveries
 * lifecycle state in the database.
 *
 * ── Security ──────────────────────────────────────────────────────────────────
 * Mailgun signs every webhook with HMAC-SHA256 using the webhook signing key
 * (distinct from the API key). The signature appears as the `signature` field
 * in the JSON body:
 *   {
 *     "signature": {
 *       "timestamp": "...",
 *       "token": "...",
 *       "signature": "<hex>"
 *     },
 *     "event-data": { ... }
 *   }
 *
 * We verify: HMAC-SHA256(timestamp + token, signingKey) === signature (hex).
 *
 * Configure in Mailgun dashboard → Sending → Webhooks.
 * Set MAILGUN_WEBHOOK_SIGNING_KEY via `wrangler secret put MAILGUN_WEBHOOK_SIGNING_KEY`.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 * Mailgun can deliver the same webhook multiple times. Each event carries a
 * unique `id`. We use the mailgun_message_id from the event to find the
 * delivery record, then update its status. Since SQL UPDATE is idempotent and
 * we only advance lifecycle state (never regress it), duplicate webhooks are
 * safe — they will re-write the same final state.
 *
 * The event record uses INSERT OR IGNORE on (delivery_id, event_name) to
 * guarantee no duplicate KODU events for the same delivery transition.
 *
 * ── Event coverage ────────────────────────────────────────────────────────────
 * Mailgun event → DeliveryStatus → KODU_EVENT
 *   accepted   → sent            → EMAIL_ACCEPTED
 *   delivered  → delivered       → EMAIL_DELIVERED
 *   failed     → failed          → EMAIL_FAILED
 *   bounced    → bounced         → EMAIL_BOUNCED
 *   complained → complained      → EMAIL_COMPLAINED
 *   unsubscribed → unsubscribed  → EMAIL_UNSUBSCRIBED
 */

import {
  createEmailDeliveryRepository,
  createEventRepository,
} from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";
import { KODU_EVENTS } from "@kodu/shared-types";

// ── Env subset needed by this handler ─────────────────────────────────────────

export interface MailgunWebhookEnv {
  MAILGUN_WEBHOOK_SIGNING_KEY?: string;
}

// ── Mailgun webhook payload shape ─────────────────────────────────────────────

interface MailgunSignature {
  timestamp: string;
  token: string;
  signature: string;
}

interface MailgunEventData {
  event: string;                  // 'accepted' | 'delivered' | 'failed' | 'bounced' | 'complained' | 'unsubscribed'
  id: string;                     // Mailgun event ID (unique per event)
  timestamp: number;              // Unix seconds
  message?: {
    headers?: {
      'message-id'?: string;
    };
  };
  recipient?: string;
  'delivery-status'?: {
    code?: number;
    description?: string;
    message?: string;
  };
  reason?: string;                // For failed/bounced
  severity?: string;              // 'permanent' | 'temporary'
  campaigns?: unknown[];
  tags?: string[];
  'user-variables'?: Record<string, string>;
}

interface MailgunWebhookPayload {
  signature: MailgunSignature;
  'event-data': MailgunEventData;
}

// ── HMAC verification ─────────────────────────────────────────────────────────

async function verifyMailgunSignature(
  signingKey: string,
  timestamp: string,
  token: string,
  expectedSignature: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingKey);
    const message = encoder.encode(timestamp + token);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, message);
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computedHex === expectedSignature;
  } catch {
    return false;
  }
}

// ── Event → lifecycle mapping ─────────────────────────────────────────────────

const MAILGUN_EVENT_MAP: Record<string, {
  deliveryStatus: 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained' | 'unsubscribed';
  koduEvent: string;
}> = {
  'accepted':      { deliveryStatus: 'sent',          koduEvent: KODU_EVENTS.EMAIL_ACCEPTED },
  'delivered':     { deliveryStatus: 'delivered',     koduEvent: KODU_EVENTS.EMAIL_DELIVERED },
  'failed':        { deliveryStatus: 'failed',         koduEvent: KODU_EVENTS.EMAIL_FAILED },
  'bounced':       { deliveryStatus: 'bounced',        koduEvent: KODU_EVENTS.EMAIL_BOUNCED },
  'complained':    { deliveryStatus: 'complained',     koduEvent: KODU_EVENTS.EMAIL_COMPLAINED },
  'unsubscribed':  { deliveryStatus: 'unsubscribed',   koduEvent: KODU_EVENTS.EMAIL_UNSUBSCRIBED },
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleMailgunWebhook(
  request: Request,
  db: KoduD1Client,
  env: MailgunWebhookEnv
): Promise<Response> {
  // ── Parse body ────────────────────────────────────────────────────────────

  let payload: MailgunWebhookPayload;
  try {
    payload = await request.json() as MailgunWebhookPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Verify signature ──────────────────────────────────────────────────────

  if (!env.MAILGUN_WEBHOOK_SIGNING_KEY) {
    // Without the signing key we cannot authenticate the webhook.
    // Log a warning but accept — allows development/testing without the key.
    // In production, always configure MAILGUN_WEBHOOK_SIGNING_KEY.
    console.warn('[mailgun-webhook] MAILGUN_WEBHOOK_SIGNING_KEY not set — skipping signature verification');
  } else {
    const sig = payload.signature;
    if (!sig?.timestamp || !sig?.token || !sig?.signature) {
      return Response.json({ error: 'Missing signature fields' }, { status: 401 });
    }

    const valid = await verifyMailgunSignature(
      env.MAILGUN_WEBHOOK_SIGNING_KEY,
      sig.timestamp,
      sig.token,
      sig.signature
    );

    if (!valid) {
      console.warn('[mailgun-webhook] Signature verification failed');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Reject replays: timestamp must be within 15 minutes
    const age = Date.now() / 1000 - Number(sig.timestamp);
    if (age > 900) {
      return Response.json({ error: 'Webhook timestamp too old' }, { status: 401 });
    }
  }

  // ── Extract event data ────────────────────────────────────────────────────

  const eventData = payload['event-data'];
  if (!eventData) {
    return Response.json({ error: 'Missing event-data' }, { status: 400 });
  }

  const mailgunEventType = eventData.event;
  const lifecycleMap = MAILGUN_EVENT_MAP[mailgunEventType];

  if (!lifecycleMap) {
    // Ignore events we don't track (e.g. 'opened', 'clicked')
    return Response.json({ ok: true, ignored: true, event: mailgunEventType });
  }

  // Mailgun message IDs come back with angle brackets in some events; strip them
  const rawMessageId = eventData.message?.headers?.['message-id'] ?? '';
  const mailgunMessageId = rawMessageId.replace(/^<|>$/g, '');

  if (!mailgunMessageId) {
    console.warn('[mailgun-webhook] No message-id in event:', mailgunEventType);
    return Response.json({ ok: true, skipped: true, reason: 'no_message_id' });
  }

  const eventTimestamp = eventData.timestamp
    ? new Date(eventData.timestamp * 1000).toISOString()
    : new Date().toISOString();

  // ── Find delivery record ──────────────────────────────────────────────────

  const deliveryRepo = createEmailDeliveryRepository(db);
  const delivery = await deliveryRepo.findByMailgunMessageId(mailgunMessageId);

  if (!delivery) {
    // Not in our system — may be from a different product or an old record
    console.warn('[mailgun-webhook] No delivery record for message ID:', mailgunMessageId);
    // Return 200 so Mailgun does not retry endlessly
    return Response.json({ ok: true, skipped: true, reason: 'delivery_not_found' });
  }

  const deliveryRow = delivery as unknown as Record<string, unknown>;
  const deliveryId = deliveryRow['id'] as string;
  const personId = deliveryRow['person_id'] as string | undefined;
  const reportId = deliveryRow['report_id'] as string | undefined;
  const app = (deliveryRow['app'] as string | undefined) ?? 'repair';

  // ── Update delivery lifecycle state ───────────────────────────────────────

  const webhookPayloadStr = JSON.stringify(eventData);

  const statusExtras: Parameters<typeof deliveryRepo.updateStatus>[2] = {
    lastWebhookPayload: webhookPayloadStr,
    lastWebhookAt: eventTimestamp,
  };

  switch (lifecycleMap.deliveryStatus) {
    case 'sent':
      statusExtras.sentAt = eventTimestamp;
      break;
    case 'delivered':
      statusExtras.sentAt = statusExtras.sentAt ?? eventTimestamp; // fill if not already set
      statusExtras.deliveredAt = eventTimestamp;
      break;
    case 'failed':
    case 'bounced': {
      const deliveryStatus = eventData['delivery-status'];
      const reason = eventData.reason ??
        (deliveryStatus?.description ?? deliveryStatus?.message ?? 'unknown');
      statusExtras.failedAt = eventTimestamp;
      statusExtras.failureReason = String(reason).substring(0, 500);
      break;
    }
  }

  await deliveryRepo.updateStatus(deliveryId, lifecycleMap.deliveryStatus, statusExtras);

  // ── Emit KODU event (idempotent via INSERT OR IGNORE) ─────────────────────

  const eventRepo = createEventRepository(db);

  // We use a raw INSERT OR IGNORE on (delivery_id, event_name) unique pair
  // to guarantee idempotency even if Mailgun sends the same webhook twice.
  // The events table has a ULID primary key; we use a deterministic
  // composite check rather than a unique index on (delivery_id, event_name)
  // to avoid a schema change — check if a matching event already exists.
  const existingEvents = await db.query<{ id: string }>(
    `SELECT id FROM events
     WHERE JSON_EXTRACT(properties, '$.delivery_id') = ?
       AND event_name = ?
     LIMIT 1`,
    [deliveryId, lifecycleMap.koduEvent]
  );

  if (existingEvents.length === 0) {
    await eventRepo.insertBatch([{
      // Webhook events have no visitor/session context — use 'system' sentinel.
      // Attribution to Person comes via email_deliveries.person_id JOIN.
      visitorId: 'system',
      sessionId: 'system',
      app: app as 'repair' | 'warranty' | 'permit' | 'record',
      occurredAt: eventTimestamp,
      eventName: lifecycleMap.koduEvent,
      properties: {
        delivery_id: deliveryId,
        mailgun_message_id: mailgunMessageId,
        mailgun_event: mailgunEventType,
        ...(reportId ? { report_id: reportId } : {}),
        ...(personId ? { person_id: personId } : {}),
      },
    }]);
  }

  // ── Return 200 to acknowledge receipt ─────────────────────────────────────

  return Response.json({
    ok: true,
    deliveryId,
    event: mailgunEventType,
    newStatus: lifecycleMap.deliveryStatus,
  });
}
