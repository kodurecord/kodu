/**
 * KODU Record Email Service — Mailgun adapter
 *
 * Mirrors the structure of apps/repair/src/services/email.ts.
 * Both products share the same Mailgun infrastructure; the only difference
 * is branding and template content.
 *
 * Credentials are kept in Cloudflare Worker secrets — never exposed to browser.
 */

export interface EmailEnv {
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  MAILGUN_FROM_NAME?: string;
  MAILGUN_FROM_EMAIL?: string;
}

export interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  tag?: string;
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
  const fromName = env.MAILGUN_FROM_NAME ?? "KODU Record";
  const fromEmail = env.MAILGUN_FROM_EMAIL ?? `hello@${domain}`;

  const formData = new FormData();
  formData.set("from", `${fromName} <${fromEmail}>`);
  formData.set("to", options.toName ? `${options.toName} <${options.to}>` : options.to);
  formData.set("subject", options.subject);
  formData.set("html", options.htmlBody);
  if (options.textBody) formData.set("text", options.textBody);
  if (options.tag) formData.set("o:tag", options.tag);

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
 * Confirmation email sent when a homeowner joins the KODU Record waitlist.
 */
export function buildWaitlistConfirmationHtml(opts: {
  firstName: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>You're on the KODU Record waitlist</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f4f6f9; margin: 0; padding: 0; }
  .wrapper { max-width: 600px; margin: 32px auto; background: #fff;
             border-radius: 8px; overflow: hidden; }
  .header { background: #0f1c2e; padding: 24px 32px; text-align: center; }
  .header-title { color: rgba(255,255,255,.8); font-size: 14px;
                  letter-spacing: .06em; text-transform: uppercase;
                  font-weight: 600; }
  .body { padding: 40px 32px; color: #1a1a2e; line-height: 1.7; }
  h1 { font-size: 22px; margin: 0 0 16px; color: #0f1c2e; }
  .highlight { background: #e8f4f0; border-left: 4px solid #1d7a6b;
               padding: 16px 20px; border-radius: 4px; margin: 24px 0;
               font-size: 15px; line-height: 1.6; }
  .footer { background: #f4f6f9; padding: 20px 32px; font-size: 12px;
            color: #888; text-align: center; }
  a { color: #1d7a6b; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <span class="header-title">KODU Record</span>
  </div>
  <div class="body">
    <h1>You're on the list, ${opts.firstName}.</h1>
    <p>
      Thanks for your interest in KODU Record — the intelligent home file for
      homeowners who want to stay ahead of maintenance, repairs, and what their
      property is really worth.
    </p>
    <div class="highlight">
      We're building KODU Record carefully and inviting homeowners in waves.
      You'll hear from us when your spot is ready — no spam, just your invite.
    </div>
    <p>
      In the meantime, you can use <a href="https://repair.kodu.com">KODU Repair</a>
      today to get an instant repair-or-replace recommendation the next time something
      breaks down at home.
    </p>
    <p style="margin-top: 32px;">— The KODU Team</p>
  </div>
  <div class="footer">
    <p>
      You're on this list because you joined the KODU Record waitlist.<br />
      <a href="https://kodurecord.com">kodurecord.com</a> &nbsp;·&nbsp;
      <a href="https://kodu.com/privacy">Privacy Policy</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

export function buildWaitlistConfirmationText(opts: { firstName: string }): string {
  return `Hi ${opts.firstName},

You're on the KODU Record waitlist.

We're building KODU Record carefully and inviting homeowners in waves. You'll hear from us when your spot is ready.

In the meantime, try KODU Repair at https://repair.kodu.com to get an instant repair-or-replace recommendation the next time something breaks down at home.

— The KODU Team

---
You're on this list because you joined the KODU Record waitlist.
kodurecord.com | https://kodu.com/privacy
`;
}
