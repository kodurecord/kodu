// Document — metadata for an uploaded file.
// The file binary lives in R2. D1 stores metadata and extraction status.
// Structured data extracted from documents (quote line items, equipment facts)
// retains provenance linking back to the source document.

export type DocumentType =
  | "contractor_quote"
  | "receipt"
  | "warranty_document"
  | "equipment_label"
  | "manual"
  | "insurance_policy"
  | "insurer_estimate"
  | "invoice"
  | "permit"
  | "inspection_report"
  | "other";

export type DocumentExtractionStatus =
  | "pending"
  | "processing"
  | "complete"
  | "failed"
  | "not_required";

export type DocumentUploadSource = "homeowner" | "contractor" | "kodu" | "imported";

export interface Document {
  id: string; // ULID; used as R2 key prefix
  propertyId?: string;
  equipmentId?: string;
  r2Bucket: string; // bucket name: 'kodu-documents'
  r2Key: string; // full R2 object key: {propertyId}/{docType}/{id}/{filename}
  originalFilename?: string;
  documentType: DocumentType;
  mimeType?: string;
  fileSizeBytes?: number;
  uploadSource?: DocumentUploadSource;
  extractionStatus: DocumentExtractionStatus;
  extractedAt?: string;
  extractionVersion?: string;
  createdAt: string;
}

export interface DocumentAssociation {
  id: number;
  documentId: string;
  entityType: "repair_event" | "quote" | "equipment" | "property" | "project";
  entityId: string;
  association: "source" | "supporting" | "reference";
  createdAt: string;
}
