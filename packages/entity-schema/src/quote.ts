// Quote — a contractor estimate for a repair event.
// Multiple quotes per repair event. is_selected flags the one used in analysis.
// Contractor information is stored as source data on the quote record —
// NOT as a canonical Person/Contractor entity (professional identity model is deferred).

export type QuoteLineType =
  | "labor"
  | "parts"
  | "diagnostic"
  | "disposal"
  | "markup"
  | "other";

export interface Quote {
  id: string; // ULID
  repairEventId: string;
  // Contractor info as raw source data — not a canonical identity
  contractorName?: string;
  contractorPhone?: string;
  contractorLicense?: string;
  quoteDate?: string;
  totalAmount?: number; // USD
  currency: string; // default: 'USD'
  isSelected: boolean; // the quote used in analysis
  sourceDocumentId?: string; // FK to documents.id if quote came from uploaded PDF
  notes?: string;
  provenanceId?: number;
  createdAt: string;
}

export interface QuoteLineItem {
  id: number;
  quoteId: string;
  sortOrder: number;
  description: string;
  amount?: number;
  lineType?: QuoteLineType;
  notes?: string;
}

export interface QuoteWithLineItems extends Quote {
  lineItems: QuoteLineItem[];
}

export interface CreateQuoteInput {
  repairEventId: string;
  contractorName?: string;
  contractorPhone?: string;
  contractorLicense?: string;
  quoteDate?: string;
  totalAmount?: number;
  isSelected?: boolean;
  sourceDocumentId?: string;
  provenanceId?: number;
  notes?: string;
  lineItems?: Omit<QuoteLineItem, "id" | "quoteId">[];
}
