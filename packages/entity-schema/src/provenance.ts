// Provenance — normalized tracking of where a data point came from.
// Referenced by ID from equipment_facts, quotes, analyses, and any
// field where source matters for trust and auditability.

export type ProvenanceSourceType =
  | "user_entered"
  | "document_extracted"
  | "contractor_provided"
  | "authoritative_external"
  | "kodu_calculated"
  | "kodu_inferred"
  | "imported";

export interface ProvenanceSource {
  id: number;
  sourceType: ProvenanceSourceType;
  // Boolean flags (fast filtering)
  isUserEntered: boolean;
  isDocumentExtracted: boolean;
  isContractorProvided: boolean;
  isAuthoritativeExternal: boolean;
  isKoduCalculated: boolean;
  isKoduInferred: boolean;
  // Traceability
  sourceIdentifier?: string; // document_id, API name, algorithm name, form field
  extractionMethod?: string; // 'ocr_v2', 'llm_parse_v1', 'user_form', 'lookup_table_v3'
  // Temporal
  obtainedAt: string; // ISO-8601
  lastVerifiedAt?: string;
  // Confidence
  confidence?: number; // 0.0–1.0
  confidenceBasis?: string;
  notes?: string;
}

export type CreateProvenanceInput = Omit<ProvenanceSource, "id">;
// Alias used by provenance factory helpers
export type CreateProvenanceSourceInput = CreateProvenanceInput;
