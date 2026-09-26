/**
 * KODU PDF Generation Service
 *
 * v1 generates a plain-text/HTML representation of the analysis report
 * formatted as an email-ready PDF-like document.
 *
 * Full PDF generation (binary PDF bytes) requires a headless browser or
 * a PDF generation library. In Cloudflare Workers, options are:
 *   - Cloudflare Browser Rendering (Workers + Puppeteer binding)
 *   - html-pdf-chrome via a Cloudflare Queue consumer
 *   - External API (PDFMonkey, DocRaptor, etc.)
 *
 * For v1: generate a self-contained HTML string that is emailed directly
 * (no binary PDF attachment). The email contains the full report inline.
 * The generated_reports.format is set to 'html' until binary PDF is wired.
 *
 * When a real PDF provider is connected:
 *   1. Set env.PDF_PROVIDER = 'browser_rendering' | 'pdfmonkey' | etc.
 *   2. Implement the provider branch below.
 *   3. Update generated_reports.format = 'pdf' and store r2_key.
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
  html: string;           // always populated — used as email body
  pdfBytes?: ArrayBuffer; // populated only when binary PDF is generated
  r2Key?: string;         // populated when stored to R2
}

/**
 * Generate the report content.
 * Returns both HTML (for email body) and optionally binary PDF bytes.
 */
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
