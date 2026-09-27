/**
 * KODU PDF Generation Service
 *
 * Generates a real binary PDF of the analysis report using
 * Cloudflare Browser Rendering (the `@cloudflare/puppeteer` binding).
 *
 * ── Infrastructure requirement ────────────────────────────────────────────────
 * This service requires:
 *   1. A `browser` binding of type `browser` in wrangler.jsonc:
 *        { "browser": { "binding": "BROWSER" } }
 *   2. The Worker must be on a plan that includes Browser Rendering
 *      (Paid Workers plans; not available on Workers Free).
 *   3. `@cloudflare/puppeteer` installed as a Worker dependency.
 *
 * Until the binding is configured, generatePdf() detects its absence and
 * falls back to returning the HTML representation with format='html'.
 * This fallback is explicit — the caller sees the format and must NOT
 * treat it as a PDF or label it as such to the homeowner.
 *
 * ── Degradation contract ──────────────────────────────────────────────────────
 * PdfResult.format === 'html'  → binary PDF was not produced; html only
 * PdfResult.format === 'pdf'   → pdfBytes is populated; html is also available
 *
 * ── To activate ───────────────────────────────────────────────────────────────
 *   1. Add browser binding to wrangler.jsonc (see comment in that file)
 *   2. pnpm add @cloudflare/puppeteer --filter kodu-repair
 *   3. Pass env.BROWSER into generatePdf()
 *   4. Deploy on a paid Cloudflare Workers plan
 */

export interface PdfInput {
  reportId: string;
  firstName: string;
  email: string;
  equipmentLabel: string;
  categoryKey: string;
  overallLean: string;
  confidence?: string;
  factors: Array<{
    factorType: string;
    direction: string;
    weight: string;
    explanation: string;
  }>;
  repairQuoteTotal?: number;
  engineVersion: string;
  generatedAt: string;
}

export interface PdfResult {
  format: 'html' | 'pdf';
  /** Always set — used as email body and PDF source HTML */
  html: string;
  /** Set only when format === 'pdf' */
  pdfBytes?: ArrayBuffer;
  /** Set only when stored to R2 */
  r2Key?: string;
}

// ── HTML template (source for both email body and PDF rendering) ──────────────

export function generateReportHtml(input: PdfInput): string {
  const directionIcon = (d: string) =>
    d === 'favors_repair' ? '✅' :
    d === 'favors_replace' ? '⚠️' :
    d === 'neutral' ? '➡️' : '❓';

  const weightLabel = (w: string) =>
    w === 'primary' ? 'Primary factor' :
    w === 'secondary' ? 'Secondary factor' :
    w === 'contextual' ? 'Context' : 'Info';

  const leanLabel =
    input.overallLean === 'repair' ? 'Lean: Repair' :
    input.overallLean === 'replace' ? 'Lean: Replace' :
    'Inconclusive';

  const factorsHtml = input.factors.map(f => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e8edf3;">
        ${directionIcon(f.direction)}&nbsp;
        <span style="font-size:11px;background:#f0f4f8;border-radius:3px;padding:2px 6px;color:#555;">
          ${weightLabel(f.weight)}
        </span>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #e8edf3;color:#1a1a2e;line-height:1.5;">
        ${f.explanation}
      </td>
    </tr>`).join('');

  const quoteRow = input.repairQuoteTotal
    ? `<tr><td style="padding:6px 0;color:#555;">Repair quote reviewed</td>
       <td style="padding:6px 0;font-weight:600;color:#0f1c2e;">
         $${input.repairQuoteTotal.toLocaleString('en-US', {minimumFractionDigits:0})}
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>KODU Repair Report — ${input.reportId}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       background:#f4f6f9;margin:0;padding:0;color:#1a1a2e;}
  .page{max-width:720px;margin:0 auto;background:#fff;}
  .header{background:#0f1c2e;padding:28px 40px;display:flex;
          align-items:center;gap:16px;}
  .header img{height:36px;}
  .header-title{color:rgba(255,255,255,.7);font-size:13px;
                text-transform:uppercase;letter-spacing:.05em;}
  .hero{padding:36px 40px 24px;border-bottom:1px solid #e8edf3;}
  h1{font-size:22px;margin:0 0 8px;}
  .meta{font-size:13px;color:#666;}
  .verdict{display:inline-block;margin:20px 0 0;padding:12px 24px;
           border-radius:6px;font-size:16px;font-weight:700;}
  .verdict.repair{background:#e4f3f1;color:#155a4e;}
  .verdict.replace{background:#fef3cd;color:#7d5a00;}
  .verdict.inconclusive{background:#f0f4f8;color:#1a2d45;}
  .section{padding:28px 40px;border-bottom:1px solid #e8edf3;}
  h2{font-size:15px;font-weight:600;color:#0f1c2e;margin:0 0 16px;
     text-transform:uppercase;letter-spacing:.04em;}
  table{width:100%;border-collapse:collapse;font-size:14px;}
  .footer{padding:24px 40px;font-size:12px;color:#888;line-height:1.6;}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <img src="https://repair.kodu.com/kodu-logo.png" alt="KODU"/>
    <span class="header-title">Repair Report</span>
  </div>

  <div class="hero">
    <div class="meta">Prepared for ${input.firstName} &nbsp;·&nbsp;
      ${input.equipmentLabel} &nbsp;·&nbsp;
      ${new Date(input.generatedAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
    </div>
    <h1>Repair or Replace Analysis</h1>
    <div class="verdict ${input.overallLean}">${leanLabel}
      ${input.confidence ? `&nbsp;<span style="font-weight:400;font-size:13px;">(${input.confidence} confidence)</span>` : ''}
    </div>
  </div>

  ${input.repairQuoteTotal ? `
  <div class="section">
    <h2>What We Reviewed</h2>
    <table>
      ${quoteRow}
    </table>
  </div>` : ''}

  <div class="section">
    <h2>Analysis Factors</h2>
    <table>
      <tbody>${factorsHtml}</tbody>
    </table>
  </div>

  <div class="section">
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
      This analysis is based on the information you provided and standard industry
      reference data. It is intended to inform your decision, not replace the advice
      of a licensed contractor. Costs, part availability, and local conditions may vary.
    </p>
  </div>

  <div class="footer">
    Report ID: ${input.reportId} &nbsp;·&nbsp;
    Engine: v${input.engineVersion} &nbsp;·&nbsp;
    Generated: ${input.generatedAt}<br/>
    KODU · kodu.com · This report was generated at your request.
  </div>
</div>
</body>
</html>`;
}

// ── PDF generation via Cloudflare Browser Rendering ──────────────────────────

/**
 * Attempt to render the HTML to a real PDF using the BROWSER binding.
 *
 * Pass `browserBinding` from env.BROWSER (type: Fetcher, the CF puppeteer
 * binding). If the binding is absent or PDF rendering fails, returns
 * format='html' (degraded mode) with a clear degradationReason.
 */
export async function generatePdf(
  input: PdfInput,
  browserBinding?: unknown
): Promise<PdfResult> {
  const html = generateReportHtml(input);

  // ── No browser binding: explicit degradation ──────────────────────────────
  if (!browserBinding) {
    console.warn(
      '[pdf] BROWSER binding not configured. ' +
      'Report will be sent as inline HTML. ' +
      'To produce a real PDF: add browser binding to wrangler.jsonc, ' +
      'install @cloudflare/puppeteer, and deploy on a paid Workers plan.'
    );
    return { format: 'html', html, degradationReason: 'browser_binding_missing' } as PdfResult & { degradationReason: string };
  }

  // ── Attempt PDF rendering ─────────────────────────────────────────────────
  try {
    // Dynamic import — @cloudflare/puppeteer is a Worker-only package
    // that cannot be imported in local tsc/jest environments.
    // The import will succeed at Worker runtime when the binding is present.
    // @ts-expect-error — @cloudflare/puppeteer is not installed as a dev dep;
    // install it only for production CF Worker builds (see wrangler.jsonc comment).
    const puppeteer = await import('@cloudflare/puppeteer');
    const browser = await (puppeteer as any).default.launch(browserBinding as any);

    try {
      const page = await browser.newPage();

      // Set the HTML content directly (no network fetch needed)
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBytes = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      }) as ArrayBuffer;

      return { format: 'pdf', html, pdfBytes };
    } finally {
      await browser.close();
    }
  } catch (err) {
    // If @cloudflare/puppeteer is not installed or rendering fails,
    // fall back to HTML with an explicit reason — never silently treat
    // an HTML file as a PDF.
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[pdf] PDF rendering failed, degrading to HTML:', reason);
    return {
      format: 'html',
      html,
      degradationReason: `render_failed: ${reason}`,
    } as PdfResult & { degradationReason: string };
  }
}
