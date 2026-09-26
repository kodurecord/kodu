/**
 * POST /api/visitors — Find or create an anonymous visitor.
 * POST /api/sessions — Start a session for a visitor.
 * POST /api/events  — Ingest a batch of funnel events.
 *
 * The visitor_id is a ULID generated client-side and stored in a
 * first-party cookie/localStorage. The server accepts it as-is.
 * It is NOT the IP address and NOT an auth token.
 */

import {
  createVisitorRepository,
  createSessionRepository,
  createEventRepository,
} from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";
import type { CreateEventsInput } from "@kodu/entity-schema";

// ── Visitor ───────────────────────────────────────────────────────────────────

export async function handleVisitors(
  request: Request,
  db: KoduD1Client
): Promise<Response> {
  const body = await request.json() as { visitorId?: string };

  if (!body.visitorId || typeof body.visitorId !== 'string') {
    return Response.json({ error: "visitorId is required" }, { status: 400 });
  }

  const repo = createVisitorRepository(db);
  const visitor = await repo.findOrCreate(body.visitorId);
  return Response.json({ visitor }, { status: 200 });
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function handleSessions(
  request: Request,
  db: KoduD1Client
): Promise<Response> {
  const body = await request.json() as {
    sessionId: string;
    visitorId: string;
    app?: string;
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
  };

  if (!body.sessionId || !body.visitorId) {
    return Response.json({ error: "sessionId and visitorId are required" }, { status: 400 });
  }

  const sessionRepo = createSessionRepository(db);

  // Check if session already exists (page refresh / duplicate call)
  const existing = await sessionRepo.findById(body.sessionId);
  if (existing) {
    await sessionRepo.touch(body.sessionId);
    return Response.json({ session: existing }, { status: 200 });
  }

  const session = await sessionRepo.create({
    id: body.sessionId,
    visitorId: body.visitorId,
    app: (body.app as any) ?? 'repair',
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    utmContent: body.utmContent,
    utmTerm: body.utmTerm,
    gclid: body.gclid,
    fbclid: body.fbclid,
    ttclid: body.ttclid,
    landingPage: body.landingPage,
    referrerUrl: body.referrerUrl,
    referrerDomain: body.referrerDomain,
    deviceType: body.deviceType,
    browserFamily: body.browserFamily,
  });

  // Persist attribution record if any UTM/click data is present
  if (body.utmSource || body.utmMedium || body.gclid || body.fbclid || body.ttclid) {
    await sessionRepo.createAttribution(session.id as string, body.visitorId, {
      app: (body.app as any) ?? 'repair',
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      utmContent: body.utmContent,
      utmTerm: body.utmTerm,
      gclid: body.gclid,
      fbclid: body.fbclid,
      ttclid: body.ttclid,
      landingPage: body.landingPage,
      referrerUrl: body.referrerUrl,
      referrerDomain: body.referrerDomain,
    });
  }

  return Response.json({ session }, { status: 201 });
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function handleEvents(
  request: Request,
  db: KoduD1Client
): Promise<Response> {
  const body = await request.json() as { events: CreateEventsInput };

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return Response.json({ error: "events array is required" }, { status: 400 });
  }

  if (body.events.length > 50) {
    return Response.json({ error: "Maximum 50 events per batch" }, { status: 400 });
  }

  const repo = createEventRepository(db);
  await repo.insertBatch(body.events);

  return Response.json({ ok: true, count: body.events.length });
}
