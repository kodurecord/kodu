/**
 * Provenance factory helpers.
 *
 * Every fact in KODU can carry a provenance source — where the data came from,
 * how confident we are, and when it was obtained. These helpers make creating
 * provenance records concise and consistent.
 *
 * All helpers return a CreateProvenanceSourceInput that can be passed to
 * ProvenanceRepository.create().
 */

import type { CreateProvenanceSourceInput } from "@kodu/entity-schema";

/** User typed this value directly into a KODU form. */
export function userEntered(opts: {
  notes?: string;
  confidence?: number;
} = {}): CreateProvenanceSourceInput {
  return {
    sourceType: "user_entered",
    isUserEntered: true,
    isDocumentExtracted: false,
    isContractorProvided: false,
    isAuthoritativeExternal: false,
    isKoduCalculated: false,
    isKoduInferred: false,
    obtainedAt: new Date().toISOString(),
    confidence: opts.confidence ?? 0.8,
    confidenceBasis: "user_self_reported",
    notes: opts.notes,
  };
}

/**
 * Data was extracted from a document (invoice, label, manual, warranty).
 * documentId should reference the documents table ULID.
 */
export function documentExtracted(opts: {
  documentId: string;
  extractionMethod?: "manual" | "ocr" | "ai_vision";
  confidence?: number;
  notes?: string;
}): CreateProvenanceSourceInput {
  return {
    sourceType: "document_extracted",
    isUserEntered: false,
    isDocumentExtracted: true,
    isContractorProvided: false,
    isAuthoritativeExternal: false,
    isKoduCalculated: false,
    isKoduInferred: false,
    sourceIdentifier: `document:${opts.documentId}`,
    extractionMethod: opts.extractionMethod ?? "manual",
    obtainedAt: new Date().toISOString(),
    confidence: opts.confidence ?? 0.7,
    confidenceBasis: "document_extraction",
    notes: opts.notes,
  };
}

/**
 * A contractor provided this information (verbally or in a quote).
 * Stored with their name so we know the source without creating a canonical identity.
 */
export function contractorProvided(opts: {
  contractorName?: string;
  notes?: string;
  confidence?: number;
}): CreateProvenanceSourceInput {
  return {
    sourceType: "contractor_provided",
    isUserEntered: false,
    isDocumentExtracted: false,
    isContractorProvided: true,
    isAuthoritativeExternal: false,
    isKoduCalculated: false,
    isKoduInferred: false,
    sourceIdentifier: opts.contractorName
      ? `contractor:${opts.contractorName}`
      : undefined,
    obtainedAt: new Date().toISOString(),
    confidence: opts.confidence ?? 0.65,
    confidenceBasis: "contractor_statement",
    notes: opts.notes,
  };
}

/**
 * KODU calculated this value deterministically from other known facts.
 * engineVersion should match the analysis engine version string.
 */
export function koduCalculated(opts: {
  engineVersion: string;
  notes?: string;
  confidence?: number;
}): CreateProvenanceSourceInput {
  return {
    sourceType: "kodu_calculated",
    isUserEntered: false,
    isDocumentExtracted: false,
    isContractorProvided: false,
    isAuthoritativeExternal: false,
    isKoduCalculated: true,
    isKoduInferred: false,
    sourceIdentifier: `engine:${opts.engineVersion}`,
    obtainedAt: new Date().toISOString(),
    confidence: opts.confidence ?? 0.9,
    confidenceBasis: "deterministic_calculation",
    notes: opts.notes,
  };
}

/**
 * KODU inferred this value (e.g., estimated install year from age range).
 * Lower confidence than calculated — there's an assumption involved.
 */
export function koduInferred(opts: {
  basis: string;
  notes?: string;
  confidence?: number;
}): CreateProvenanceSourceInput {
  return {
    sourceType: "kodu_inferred",
    isUserEntered: false,
    isDocumentExtracted: false,
    isContractorProvided: false,
    isAuthoritativeExternal: false,
    isKoduCalculated: false,
    isKoduInferred: true,
    obtainedAt: new Date().toISOString(),
    confidence: opts.confidence ?? 0.5,
    confidenceBasis: opts.basis,
    notes: opts.notes,
  };
}
