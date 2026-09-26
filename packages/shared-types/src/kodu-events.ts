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
  PDF_DELIVERED:            'pdf_delivered',

  // ── CTA / Affiliate ────────────────────────────────────────────────────────
  CTA_CLICKED:              'cta_clicked',

  // ── Warranty / Permit / Record (future products) ───────────────────────────
  WARRANTY_CHECK_STARTED:   'warranty_check_started',
  PERMIT_LOOKUP_STARTED:    'permit_lookup_started',

  // ── Identity ───────────────────────────────────────────────────────────────
  ACCOUNT_CREATED:          'account_created',
} as const;

export type KoduEventName = typeof KODU_EVENTS[keyof typeof KODU_EVENTS];
