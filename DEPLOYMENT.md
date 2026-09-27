# KODU Deployment Report
**Prepared:** 2026-09-26  
**Status:** Pre-deployment — do not deploy until this report is reviewed and every manual step is completed

---

## Ecosystem Inventory

| Product | Domain | Repo Path | CF Resource | DB | Email | Current State |
|---------|--------|-----------|-------------|-----|-------|---------------|
| **KODU Repair** | kodurepair.com | `apps/repair` | Worker: `kodu-repair` (deploy now) | kodu-core-db (shared) | Mailgun | Worker ready; needs DNS CNAME + secrets |
| **KODU Record** | kodurecord.com | `apps/record` | Worker: `kodu-record` (deploy now, waitlist only) | kodu-core-db (shared) | Mailgun | Worker ready; needs DNS CNAME + secrets; keep existing CF Pages site live until DNS cutover is approved |
| **KODU Record (existing)** | kodurecord.com | `kodurecord/kodu-marketing-site` | CF Pages: existing deployment | — | — | **Do not touch.** Stays live until explicit DNS cutover approval. |
| **KODU Warranty** | — | not yet | — | — | — | Planned; not started |
| **KODU Permit** | — | not yet | — | — | — | Planned; not started |

---

## What Was Built (This Session)

### 1. Real PDF generation — `apps/repair/src/services/pdf.ts`

`generatePdf()` produces a binary PDF via Cloudflare Browser Rendering when the `BROWSER` binding is present. Clear degradation contract:

- **`BROWSER` binding absent** → `{ format: 'html', degradationReason: 'browser_binding_missing' }` — never silently treated as PDF
- **`BROWSER` present, render succeeds** → `{ format: 'pdf', pdfBytes: Uint8Array }` — attached to Mailgun as `report.pdf`
- **Render fails** → `{ format: 'html', degradationReason: 'render_failed: <message>' }` — graceful fallback

### 2. Correct Mailgun delivery lifecycle — `apps/repair/src/api/webhooks/mailgun.ts`

Route: `POST /api/webhooks/mailgun`

- HMAC-SHA256 verification (Web Crypto API)
- 15-minute replay window
- Maps Mailgun event types to KODU delivery status + event:

| Mailgun event | `email_deliveries.status` | KODU event |
|--------------|--------------------------|------------|
| `accepted`   | `sent`       | `email_accepted` |
| `delivered`  | `delivered`  | `email_delivered` |
| `failed`     | `failed`     | `email_failed` |
| `bounced`    | `bounced`    | `email_bounced` |
| `complained` | `complained` | `email_complained` |
| `unsubscribed` | `unsubscribed` | `email_unsubscribed` |

- Report generation now emits `email_queued` (not `pdf_delivered`) when Mailgun accepts the API call
- Idempotent: checks for existing event by `delivery_id + event_name` before inserting

### 3. Shared communication infrastructure — migration `0014`

- `email_deliveries.app` column added — all email records now carry the originating KODU product
- `product_waitlists` table — shared across all KODU products (Repair, Record, Warranty, Permit, future)

### 4. KODU Record waitlist Worker — `apps/record`

Route: `POST /api/waitlist`

Full flow:
1. Validate `firstName`, `email`, `visitorId`, `sessionId`
2. `findOrCreateByEmail` → Person
3. `linkToPerson` — visitor attribution preserved
4. Record consents: `transactional_report` (always), `product_comms` (always), `marketing_email` (if opted in)
5. `waitlistRepo.upsert` — idempotent via `UNIQUE(person_id, app)`
6. Mailgun confirmation email
7. `email_deliveries` record with `app: 'record'`
8. Batch events: `record_waitlist_submitted`, `record_waitlist_confirmation_sent`

Landing page at `apps/record/public/index.html` tracks: `record_landing_viewed`, `record_waitlist_cta_viewed`, `record_waitlist_cta_clicked`, `record_waitlist_form_viewed`, `record_waitlist_submitted`.

### 5. New KODU events — `packages/shared-types`

Email delivery lifecycle: `email_queued`, `email_accepted`, `email_delivered`, `email_failed`, `email_bounced`, `email_complained`, `email_unsubscribed`

KODU Record: `record_landing_viewed`, `record_waitlist_cta_viewed`, `record_waitlist_cta_clicked`, `record_waitlist_form_viewed`, `record_waitlist_submitted`, `record_waitlist_confirmation_sent`, `record_waitlist_confirmation_delivered`

---

## Manual Configuration Required Before Deployment

Complete **every item below** before running `wrangler deploy`. Items marked 🔴 will cause the deployment to fail or behave incorrectly if skipped.

---

### Step 1 — Apply D1 Migrations 🔴

All migrations must be applied to the production `kodu-core-db` D1 database.

Determine which migrations are already applied, then run each missing one:

```bash
# From the repo root, for each migration file not yet applied:
wrangler d1 execute kodu-core-db --remote --file=infrastructure/migrations/0011_visitor_session_events.sql
wrangler d1 execute kodu-core-db --remote --file=infrastructure/migrations/0012_persons_name_columns.sql
wrangler d1 execute kodu-core-db --remote --file=infrastructure/migrations/0013_generated_reports_consents.sql
wrangler d1 execute kodu-core-db --remote --file=infrastructure/migrations/0014_waitlists_email_app.sql
```

**Critical:** Migration 0014 adds `email_deliveries.app` (NOT NULL DEFAULT 'repair') and creates `product_waitlists`. Both are required for the Record waitlist flow.

Migration 0014 is idempotent-safe: `ALTER TABLE ... ADD COLUMN` on SQLite fails silently if the column already exists (SQLite does not support `IF NOT EXISTS` on ADD COLUMN, but D1 returns an error — verify the column does not already exist before running).

---

### Step 2 — Deploy `kodu-repair` Worker 🔴

```bash
cd apps/repair
wrangler deploy
```

This creates or updates the `kodu-repair` Worker on Cloudflare. After deploy, the Worker is reachable at `kodu-repair.<your-account>.workers.dev`.

---

### Step 3 — Set Worker Secrets for `kodu-repair` 🔴

```bash
cd apps/repair

# Mailgun sending credentials
wrangler secret put MAILGUN_API_KEY
wrangler secret put MAILGUN_DOMAIN          # e.g. mg.kodu.com
wrangler secret put MAILGUN_FROM_NAME       # e.g. KODU Repair
wrangler secret put MAILGUN_FROM_EMAIL      # e.g. hello@mg.kodu.com

# Mailgun webhook signature verification
wrangler secret put MAILGUN_WEBHOOK_SIGNING_KEY   # from Mailgun dashboard → Webhooks → signing key
```

**If any Mailgun secret is missing:** `sendEmail()` will throw and the report flow will fail. The code checks for `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` presence before calling Mailgun; missing values produce a logged error and no email is sent, but the report is still saved.

---

### Step 4 — Deploy `kodu-record` Worker 🔴

```bash
cd apps/record
wrangler deploy
```

This creates the `kodu-record` Worker. After deploy, reachable at `kodu-record.<your-account>.workers.dev`.

---

### Step 5 — Set Worker Secrets for `kodu-record` 🔴

```bash
cd apps/record

wrangler secret put MAILGUN_API_KEY
wrangler secret put MAILGUN_DOMAIN
wrangler secret put MAILGUN_FROM_NAME       # e.g. KODU Record
wrangler secret put MAILGUN_FROM_EMAIL      # e.g. hello@mg.kodu.com
wrangler secret put MAILGUN_WEBHOOK_SIGNING_KEY
```

---

### Step 6 — Configure Mailgun Webhooks

In the **Mailgun dashboard** (https://app.mailgun.com → Sending → Webhooks):

1. Select your sending domain
2. Add a webhook for each of the following event types, pointing to the Repair Worker URL:

| Event | Webhook URL |
|-------|-------------|
| Delivered | `https://kodurepair.com/api/webhooks/mailgun` |
| Failed (permanent) | `https://kodurepair.com/api/webhooks/mailgun` |
| Failed (temporary) | `https://kodurepair.com/api/webhooks/mailgun` |
| Complained | `https://kodurepair.com/api/webhooks/mailgun` |
| Unsubscribed | `https://kodurepair.com/api/webhooks/mailgun` |
| Opened | (optional — not currently mapped to a KODU event) |
| Clicked | (optional) |

**Note on Record waitlist emails:** Mailgun webhooks are domain-level, not Worker-level. All emails from the shared Mailgun domain (Repair + Record) will fire the same webhook. The `kodu-repair` webhook handler looks up the `email_deliveries` row by Mailgun message ID and reads the `app` column to determine the originating product. This is correct — one webhook endpoint handles all KODU products.

If you want `kodu-record` to handle its own webhooks (separate route), add `POST /api/webhooks/mailgun` to `apps/record/src/index.ts` pointing to the same `handleMailgunWebhook` from `apps/repair/src/api/webhooks/mailgun.ts` (shared package). For now, the single `kodu-repair` endpoint is sufficient.

3. Copy the **webhook signing key** from Mailgun (Webhooks tab → HTTP webhook signing key). This goes into `MAILGUN_WEBHOOK_SIGNING_KEY` for the Repair Worker (Step 3 above).

---

### Step 7 — DNS Configuration

#### 7a. `kodurepair.com` → `kodu-repair` Worker

In your DNS provider (wherever `kodurepair.com` is managed):

```
Type:    CNAME
Name:    @  (or www for www.kodurepair.com)
Value:   kodu-repair.<account-subdomain>.workers.dev
TTL:     300 (or lowest available during cutover)
```

Then in the Cloudflare Dashboard → Workers & Pages → `kodu-repair` → Settings → Domains & Routes:

- Add custom domain: `kodurepair.com`

Or via wrangler in `wrangler.jsonc` (append before deploying):
```jsonc
"routes": [
  { "pattern": "kodurepair.com/*", "zone_name": "kodurepair.com" },
  { "pattern": "www.kodurepair.com/*", "zone_name": "kodurepair.com" }
]
```

#### 7b. `kodurecord.com` → `kodu-record` Worker ⚠️

**Do not make this DNS change until explicitly approved.** The existing KODU Record marketing site (CF Pages) is live on `kodurecord.com`. Switching DNS will immediately take it offline.

When approved:
1. In Cloudflare Dashboard → Workers & Pages → `kodu-record` → Settings → Domains & Routes
2. Add custom domain: `kodurecord.com` and `www.kodurecord.com`
3. Update `wrangler.jsonc` for `apps/record`:
```jsonc
"routes": [
  { "pattern": "kodurecord.com/*", "zone_name": "kodurecord.com" },
  { "pattern": "www.kodurecord.com/*", "zone_name": "kodurecord.com" }
]
```

Until DNS cutover, test the Record waitlist Worker at `kodu-record.<account>.workers.dev`.

---

### Step 8 — Cloudflare Browser Rendering (PDF) ⚠️ Paid Plan Required

Real PDF output requires:

1. **Paid Cloudflare Workers plan** (Browser Rendering is not available on the Free plan)
2. Enable Browser Rendering in Cloudflare Dashboard → Workers & Pages → `kodu-repair` → Settings → Browser Rendering
3. Install the package:
   ```bash
   cd apps/repair
   pnpm add @cloudflare/puppeteer
   ```
4. Uncomment the browser binding in `apps/repair/wrangler.jsonc`:
   ```jsonc
   "browser": { "binding": "BROWSER" }
   ```
5. Redeploy: `wrangler deploy`

**Until this is done:** `generatePdf()` degrades gracefully to HTML-only email (no PDF attachment). The `degradationReason: 'browser_binding_missing'` is logged but the report flow continues normally. The `generated_reports.format` column stays `'html'`.

---

### Step 9 — R2 Bucket (Future — Not Required Now)

PDF storage in R2 is not implemented. Generated PDFs are currently attached directly to Mailgun emails and not persisted to object storage. If PDF archival is needed:

1. Create an R2 bucket: `kodu-reports`
2. Add R2 binding to `apps/repair/wrangler.jsonc`: `"r2_buckets": [{ "binding": "REPORTS_BUCKET", "bucket_name": "kodu-reports" }]`
3. In `apps/repair/src/api/reports.ts`, upload `pdfBytes` to R2 after generation

---

### Step 10 — Verify `APP_VERSION` and `ENVIRONMENT`

In `apps/repair/wrangler.jsonc` and `apps/record/wrangler.jsonc`, update for production:

```jsonc
"vars": {
  "ENVIRONMENT": "production",
  "APP_VERSION": "1.0.0"
}
```

Or manage per-environment with `[env.production]` blocks in wrangler.jsonc.

---

## Pre-Deploy Checklist

- [ ] D1 migrations 0011–0014 applied to production `kodu-core-db`
- [ ] `kodu-repair` Worker deployed (`wrangler deploy` from `apps/repair`)
- [ ] Repair Worker secrets set: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_NAME`, `MAILGUN_FROM_EMAIL`, `MAILGUN_WEBHOOK_SIGNING_KEY`
- [ ] `kodu-record` Worker deployed (`wrangler deploy` from `apps/record`)
- [ ] Record Worker secrets set: same Mailgun secrets
- [ ] Mailgun webhooks configured pointing to `kodurepair.com/api/webhooks/mailgun` (or workers.dev URL until DNS is live)
- [ ] DNS CNAME for `kodurepair.com` created and propagated
- [ ] Cloudflare custom domain added to `kodu-repair` Worker
- [ ] `kodu-record` Worker tested at workers.dev URL (waitlist form submits, confirmation email arrives, D1 has waitlist row)
- [ ] DNS cutover for `kodurecord.com` (separate approval required — existing CF Pages site stays live until then)
- [ ] Browser Rendering binding enabled (optional — Worker degrades gracefully without it)

---

## Security Notes

- Mailgun API keys are Worker secrets — never exposed to the browser
- Webhook HMAC-SHA256 verification is implemented with a 15-minute replay window
- Visitor identity is a client-generated ULID — never the IP address
- `persons` linkage happens server-side via `visitorRepo.linkToPerson` after email capture
- No Supabase or Vercel dependencies added
