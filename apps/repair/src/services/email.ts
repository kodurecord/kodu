/**
 * KODU Email Service — Mailgun adapter
 *
 * This module isolates all Mailgun-specific logic behind a clean interface.
 * Any other KODU product (Warranty, Permit) can import and use the same
 * sendEmail() function by passing the same Env bindings.
 *
 * Credentials are kept in Cloudflare Worker secrets (env.MAILGUN_API_KEY,
 * env.MAILGUN_DOMAIN) and are never exposed to the browser.
 *
 * The report PDF is attached directly to the email (base64-encoded).
 * If PDF bytes are not yet available, the email is queued with a PDF link
 * pointing to a signed R2 URL instead.
 */

export interface EmailEnv {
  MAILGUN_API_KEY: string;   // Worker secret
  MAILGUN_DOMAIN: string;    // e.g. "mg.kodu.com"
  MAILGUN_FROM_NAME?: string; // e.g. "KODU Repair"
  MAILGUN_FROM_EMAIL?: string; // e.g. "reports@mg.kodu.com"
}

export interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  tag?: string;
  // If pdfBytes is provided, attach the PDF directly
  pdfBytes?: ArrayBuffer;
  pdfFilename?: string;
}

export interface MailgunSendResult {
  messageId: string;
  queued: boolean;
}

export async function sendEmail(
  env: EmailEnv,
  options: SendEmailOptions
): Promise<MailgunSendResult> {
  const domain = env.MAILGUN_DOMAIN;
  const apiKey = env.MAILGUN_API_KEY;
  const fromName = env.MAILGUN_FROM_NAME ?? "KODU Repair";
  const fromEmail = env.MAILGUN_FROM_EMAIL ?? `reports@${domain}`;

  const formData = new FormData();
  formData.set("from", `${fromName} <${fromEmail}>`);
  formData.set("to", options.toName ? `${options.toName} <${options.to}>` : options.to);
  formData.set("subject", options.subject);
  formData.set("html", options.htmlBody);
  if (options.textBody) formData.set("text", options.textBody);
  if (options.tag) formData.set("o:tag", options.tag);

  // Attach PDF if bytes provided
  if (options.pdfBytes) {
    const blob = new Blob([options.pdfBytes], { type: "application/pdf" });
    formData.set("attachment", blob, options.pdfFilename ?? "KODU-Repair-Report.pdf");
  }

  const response = await fetch(
    `https://api.mailgun.net/v3/${domain}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mailgun error ${response.status}: ${text}`);
  }

  const data = await response.json() as { id?: string; message?: string };
  const messageId = data.id ?? "";

  return { messageId, queued: true };
}

/**
 * Build the HTML body for the KODU Repair Report delivery email.
 * This is the transactional email — no promotional content.
 */
export function buildReportEmailHtml(opts: {
  firstName: string;
  overallLean: string;
  equipmentLabel: string;
  reportId: string;
  hasPdfAttachment: boolean;
}): string {
  const leanLabel =
    opts.overallLean === "repair"
      ? "leans toward repair"
      : opts.overallLean === "replace"
      ? "leans toward replacement"
      : "is inconclusive — more information may help";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your KODU Repair Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f4f6f9; margin: 0; padding: 0; }
  .wrapper { max-width: 600px; margin: 32px auto; background: #fff;
             border-radius: 8px; overflow: hidden; }
  .header { background: #0f1c2e; padding: 24px 32px; text-align: center; }
  .header img { height: 36px; }
  .body { padding: 32px; color: #1a1a2e; line-height: 1.6; }
  h1 { font-size: 22px; margin: 0 0 16px; color: #0f1c2e; }
  .verdict { background: #e4f3f1; border-left: 4px solid #1d7a6b;
             padding: 16px 20px; border-radius: 4px; margin: 24px 0;
             font-size: 15px; }
  .footer { background: #f4f6f9; padding: 20px 32px; font-size: 12px;
            color: #666; text-align: center; }
  a { color: #1d7a6b; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="https://repair.kodu.com/kodu-logo.png" alt="KODU" />
  </div>
  <div class="body">
    <h1>Hi ${opts.firstName}, your KODU Repair Report is ready.</h1>
    <p>
      Based on the information you provided about your <strong>${opts.equipmentLabel}</strong>,
      your analysis <strong>${leanLabel}</strong>.
    </p>
    <div class="verdict">
      Your full report ${opts.hasPdfAttachment
        ? "is attached to this email as a PDF."
        : "is included below."}
      It covers the key factors KODU evaluated, their individual weight in the
      decision, and context to help you make the best choice for your home.
    </div>
    <p>
      This report is yours to keep. If your situation changes — a new quote,
      additional repair history, or further information — you can run a new
      analysis at any time.
    </p>
    <p style="margin-top: 32px;">— The KODU Team</p>
  </div>
  <div class="footer">
    <p>
      You received this email because you requested a KODU Repair Report.<br />
      This is a transactional message and is not a marketing email.<br />
      KODU · <a href="https://kodu.com/privacy">Privacy Policy</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

export function buildReportEmailText(opts: {
  firstName: string;
  overallLean: string;
  equipmentLabel: string;
}): string {
  const leanLabel =
    opts.overallLean === "repair"
      ? "leans toward repair"
      : opts.overallLean === "replace"
      ? "leans toward replacement"
      : "is inconclusive";

  return `Hi ${opts.firstName},

Your KODU Repair Report for your ${opts.equipmentLabel} is ready.

Your analysis ${leanLabel}. Your full report is attached as a PDF.

This report is yours to keep.

— The KODU Team

---
You received this email because you requested a KODU Repair Report.
This is a transactional message, not a marketing email.
`;
}
