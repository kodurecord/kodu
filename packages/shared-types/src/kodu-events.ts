// KODU_EVENTS — canonical event names shared across all KODU products.
// Use these constants (never raw strings) when emitting events so that
// all products contribute to a consistent event schema.
//
// Event names use snake_case to match D1 column storage and
// analytics tooling conventions.

export const KODU_EVENTS = {
  // ── Page / Session ─────────────────────────────────────────────────────────
  LANDING_PAGE_VIEWED:      'landing_page_viewed',
  RETURN_VISIT:             'return_visit',

  // ── Repair Flow ────────────────────────────────────────────────────────────
  ANALYSIS_STARTED:         'analysis_started',
  EQUIPMENT_SELECTED:       'equipment_selected',
  EQUIPMENT_DETAILS_ENTERED:'equipment_details_entered',
  MANUFACTURER_ENTERED:     'manufacturer_entered',
  MODEL_ENTERED:            'model_entered',
  REPAIR_DETAILS_ENTERED:   'repair_details_entered',
  QUOTE_ENTERED:            'quote_entered',
  QUOTE_UPLOADED:           'quote_uploaded',
  ANALYSIS_COMPLETED:       'analysis_completed',
  ANALYSIS_VIEWED:          'analysis_viewed',

  // ── PDF Conversion ─────────────────────────────────────────────────────────
  PDF_CTA_VIEWED:           'pdf_cta_viewed',
  PDF_REQUESTED:            'pdf_requested',
  CONTACT_FORM_VIEWED:      'contact_form_viewed',
  CONTACT_SUBMITTED:        'contact_submitted',
  MARKETING_OPT_IN:         'marketing_opt_in',
  PDF_GENERATED:            'pdf_generated',
  // NOTE: PDF_DELIVERED is legacy — prefer EMAIL_DELIVERED (set via Mailgun webhook)
  PDF_DELIVERED:            'pdf_delivered',

  // ── Email Delivery Lifecycle (webhook-driven) ──────────────────────────────
  // Emitted by the report pipeline when Mailgun accepts the send request
  EMAIL_QUEUED:             'email_queued',
  // Emitted by Mailgun webhook when the MTA accepts the message for delivery
  EMAIL_ACCEPTED:           'email_accepted',
  // Emitted by Mailgun webhook when the recipient's server confirms delivery
  EMAIL_DELIVERED:          'email_delivered',
  // Emitted by Mailgun webhook on permanent delivery failure
  EMAIL_FAILED:             'email_failed',
  // Emitted by Mailgun webhook on soft bounce
  EMAIL_BOUNCED:            'email_bounced',
  // Emitted by Mailgun webhook when recipient marks as spam
  EMAIL_COMPLAINED:         'email_complained',
  // Emitted by Mailgun webhook on unsubscribe
  EMAIL_UNSUBSCRIBED:       'email_unsubscribed',

  // ── CTA / Affiliate ────────────────────────────────────────────────────────
  CTA_CLICKED:              'cta_clicked',

  // ── Warranty / Permit (future products) ───────────────────────────────────
  WARRANTY_CHECK_STARTED:   'warranty_check_started',
  PERMIT_LOOKUP_STARTED:    'permit_lookup_started',

  // ── KODU Record Waitlist ───────────────────────────────────────────────────
  RECORD_LANDING_VIEWED:                  'record_landing_viewed',
  RECORD_WAITLIST_CTA_VIEWED:             'record_waitlist_cta_viewed',
  RECORD_WAITLIST_CTA_CLICKED:            'record_waitlist_cta_clicked',
  RECORD_WAITLIST_FORM_VIEWED:            'record_waitlist_form_viewed',
  RECORD_WAITLIST_SUBMITTED:              'record_waitlist_submitted',
  RECORD_WAITLIST_CONFIRMATION_SENT:      'record_waitlist_confirmation_sent',
  RECORD_WAITLIST_CONFIRMATION_DELIVERED: 'record_waitlist_confirmation_delivered',

  // ── Identity ───────────────────────────────────────────────────────────────
  ACCOUNT_CREATED:          'account_created',
} as const;

export type KoduEventName = typeof KODU_EVENTS[keyof typeof KODU_EVENTS];
