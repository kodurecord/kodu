import type { KoduD1Client } from "../client";
import type { ProvenanceSource, CreateProvenanceSourceInput } from "@kodu/entity-schema";

export interface ProvenanceRepository {
  findById(id: number): Promise<ProvenanceSource | null>;
  create(input: CreateProvenanceSourceInput): Promise<ProvenanceSource>;
}

export function createProvenanceRepository(
  db: KoduD1Client
): ProvenanceRepository {
  return {
    async findById(id) {
      return db.queryOne<ProvenanceSource>(
        "SELECT * FROM provenance_sources WHERE id = ?",
        [id]
      );
    },

    async create(input) {
      const now = new Date().toISOString();
      const { last_row_id } = await db.run(
        `INSERT INTO provenance_sources (
           source_type, is_user_entered, is_document_extracted,
           is_contractor_provided, is_authoritative_external,
           is_kodu_calculated, is_kodu_inferred,
           source_identifier, extraction_method,
           obtained_at, last_verified_at, confidence, confidence_basis, notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.sourceType,
          input.isUserEntered ? 1 : 0,
          input.isDocumentExtracted ? 1 : 0,
          input.isContractorProvided ? 1 : 0,
          input.isAuthoritativeExternal ? 1 : 0,
          input.isKoduCalculated ? 1 : 0,
          input.isKoduInferred ? 1 : 0,
          input.sourceIdentifier ?? null,
          input.extractionMethod ?? null,
          input.obtainedAt ?? now,
          input.lastVerifiedAt ?? null,
          input.confidence ?? null,
          input.confidenceBasis ?? null,
          input.notes ?? null,
        ]
      );

      const created = await db.queryOne<ProvenanceSource>(
        "SELECT * FROM provenance_sources WHERE id = ?",
        [last_row_id]
      );
      if (!created) throw new Error("Failed to retrieve created provenance source");
      return created;
    },
  };
}
