/**
 * KODU Repair — Cloudflare Worker
 *
 * Routes:
 *   /api/equipment-categories  GET  — list all categories (for intake form)
 *   /api/properties            POST — create or find property
 *   /api/equipment             POST — add equipment to property
 *   /api/equipment/:id/facts   POST — add a fact (age, model, etc.)
 *   /api/repair-events         POST — open a repair event
 *   /api/repair-events/:id     GET  — get repair event with equipment + facts
 *   /api/repair-events/:id/quotes POST — add a quote
 *   /api/repair-events/:id/analyse POST — run deterministic analysis
 *   /api/repair-events/:id/analysis GET  — get latest analysis with factors
 *   /api/repair-events/:id/decide  POST — record homeowner decision
 *   /api/visitors              POST — find or create anonymous visitor
 *   /api/sessions              POST — start a session for a visitor
 *   /api/events                POST — ingest a batch of funnel events
 *   /api/reports               POST — request PDF report (contact capture + email)
 *   /health                    GET  — liveness check
 *
 * Static files in public/ are served via env.ASSETS (run_worker_first: true).
 */

import { createClient } from "@kodu/database";
import { handleCategories } from "./api/equipment-categories";
import { handleProperties } from "./api/properties";
import { handleEquipment, handleEquipmentFacts } from "./api/equipment";
import { handleRepairEvents, handleRepairEventById } from "./api/repair-events";
import { handleQuotes } from "./api/quotes";
import { handleAnalyse, handleAnalysis } from "./api/analysis";
import { handleDecide } from "./api/decisions";
import { handleVisitors, handleSessions, handleEvents } from "./api/visitors";
import { handleReportRequest } from "./api/reports";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher; // Cloudflare Static Assets binding (auto-provided)
  ENVIRONMENT: string;
  APP_VERSION: string;
  // Email (Mailgun) — set via `wrangler secret put`
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  MAILGUN_FROM_NAME?: string;
  MAILGUN_FROM_EMAIL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers — development permissive; tighten for production
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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
          version: env.APP_VERSION,
          environment: env.ENVIRONMENT,
          ts: new Date().toISOString(),
        });
      }

      // Equipment categories
      else if (path === "/api/equipment-categories" && method === "GET") {
        response = await handleCategories(db);
      }

      // Properties
      else if (path === "/api/properties" && method === "POST") {
        response = await handleProperties(request, db);
      }

      // Equipment
      else if (path === "/api/equipment" && method === "POST") {
        response = await handleEquipment(request, db);
      }
      else if (path.match(/^\/api\/equipment\/[^/]+\/facts$/) && method === "POST") {
        const equipmentId = path.split("/")[3]!;
        response = await handleEquipmentFacts(request, db, equipmentId);
      }

      // Repair events
      else if (path === "/api/repair-events" && method === "POST") {
        response = await handleRepairEvents(request, db);
      }
      else if (path.match(/^\/api\/repair-events\/[^/]+$/) && method === "GET") {
        const id = path.split("/")[3]!;
        response = await handleRepairEventById(db, id);
      }

      // Quotes
      else if (path.match(/^\/api\/repair-events\/[^/]+\/quotes$/) && method === "POST") {
        const repairEventId = path.split("/")[3]!;
        response = await handleQuotes(request, db, repairEventId);
      }

      // Analysis
      else if (path.match(/^\/api\/repair-events\/[^/]+\/analyse$/) && method === "POST") {
        const repairEventId = path.split("/")[3]!;
        response = await handleAnalyse(request, db, repairEventId);
      }
      else if (path.match(/^\/api\/repair-events\/[^/]+\/analysis$/) && method === "GET") {
        const repairEventId = path.split("/")[3]!;
        response = await handleAnalysis(db, repairEventId);
      }

      // Decisions
      else if (path.match(/^\/api\/repair-events\/[^/]+\/decide$/) && method === "POST") {
        const repairEventId = path.split("/")[3]!;
        response = await handleDecide(request, db, repairEventId);
      }

      // Visitor / session / event instrumentation
      else if (path === "/api/visitors" && method === "POST") {
        response = await handleVisitors(request, db);
      }
      else if (path === "/api/sessions" && method === "POST") {
        response = await handleSessions(request, db);
      }
      else if (path === "/api/events" && method === "POST") {
        response = await handleEvents(request, db);
      }

      // PDF report request (contact capture + Mailgun delivery)
      else if (path === "/api/reports" && method === "POST") {
        response = await handleReportRequest(request, db, env);
      }

      if (response) {
        // Add CORS headers to all API responses
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

      // All other paths: serve static assets (index.html, CSS, JS, etc.)
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
