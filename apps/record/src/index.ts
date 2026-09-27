/**
 * KODU Record — Cloudflare Worker
 *
 * kodurecord.com waitlist / early-access funnel.
 * The full KODU Record application is NOT publicly released yet.
 *
 * Routes:
 *   /api/visitors              POST — find or create anonymous visitor
 *   /api/sessions              POST — start a session for a visitor
 *   /api/events                POST — ingest a batch of funnel events
 *   /api/waitlist              POST — join the KODU Record waitlist
 *   /health                    GET  — liveness check
 *
 * Static files in public/ are served via env.ASSETS (run_worker_first: true).
 *
 * All data lives in the shared kodu-core-db D1 database.
 * All Mailgun communication flows through the shared email infrastructure.
 * Do not build a disconnected KODU Record lead database.
 */

import { createClient } from "@kodu/database";
import { handleVisitors, handleSessions, handleEvents } from "./api/visitors";
import { handleWaitlistJoin } from "./api/waitlist";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  APP_VERSION: string;
  // Email (Mailgun) — set via `wrangler secret put`
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  MAILGUN_FROM_NAME?: string;
  MAILGUN_FROM_EMAIL?: string;
  // Mailgun webhook signing key — set via `wrangler secret put MAILGUN_WEBHOOK_SIGNING_KEY`
  MAILGUN_WEBHOOK_SIGNING_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const db = createClient(env.DB);

    try {
      let response: Response | null = null;

      // Liveness check
      if (path === "/health" || path === "/api/health") {
        response = Response.json({
          ok: true,
          app: 'record',
          version: env.APP_VERSION,
          environment: env.ENVIRONMENT,
          ts: new Date().toISOString(),
        });
      }

      // Visitor / session / event instrumentation (shared infrastructure)
      else if (path === "/api/visitors" && method === "POST") {
        response = await handleVisitors(request, db);
      }
      else if (path === "/api/sessions" && method === "POST") {
        response = await handleSessions(request, db);
      }
      else if (path === "/api/events" && method === "POST") {
        response = await handleEvents(request, db);
      }

      // Waitlist join
      else if (path === "/api/waitlist" && method === "POST") {
        response = await handleWaitlistJoin(request, db, env);
      }

      if (response) {
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }

      // API path with no handler → 404
      if (path.startsWith("/api/")) {
        return Response.json(
          { error: "Not found", path },
          { status: 404, headers: corsHeaders }
        );
      }

      // All other paths: serve static assets (landing page, etc.)
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error("Worker error:", err);
      return Response.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders }
      );
    }
  },
} satisfies ExportedHandler<Env>;
