import type { KoduD1Client } from "../client";
import type {
  Analysis,
  AnalysisFactor,
  AnalysisLean,
} from "@kodu/entity-schema";

interface CreateAnalysisInput {
  repairEventId: string;
  engineVersion: string;
  deterministicInputs: string;
  overallLean: AnalysisLean;
  confidence?: string; // "high" | "medium" | "low"
}
import { ulid } from "../ulid";

export interface AnalysisRepository {
  findById(id: string): Promise<Analysis | null>;
  findByRepairEvent(repairEventId: string): Promise<Analysis[]>;
  findLatestByRepairEvent(repairEventId: string): Promise<Analysis | null>;
  findWithFactors(id: string): Promise<(Analysis & { factors: AnalysisFactor[] }) | null>;
  create(input: CreateAnalysisInput): Promise<Analysis>;
  addFactor(
    analysisId: string,
    factorType: string,
    direction: string,
    weight: string,
    explanation: string,
    opts?: {
      calculatedValue?: number;
      referenceValue?: number;
      unit?: string;
      dataQuality?: string;
      sortOrder?: number;
    }
  ): Promise<AnalysisFactor>;
  setAiExplanation(id: string, explanation: string): Promise<void>;
}

export function createAnalysisRepository(db: KoduD1Client): AnalysisRepository {
  return {
    async findById(id) {
      return db.queryOne<Analysis>(
        "SELECT * FROM analyses WHERE id = ?",
        [id]
      );
    },

    async findByRepairEvent(repairEventId) {
      return db.query<Analysis>(
        "SELECT * FROM analyses WHERE repair_event_id = ? ORDER BY generated_at DESC",
        [repairEventId]
      );
    },

    async findLatestByRepairEvent(repairEventId) {
      return db.queryOne<Analysis>(
        `SELECT * FROM analyses
         WHERE repair_event_id = ?
         ORDER BY generated_at DESC
         LIMIT 1`,
        [repairEventId]
      );
    },

    async findWithFactors(id) {
      const analysis = await db.queryOne<Analysis>(
        "SELECT * FROM analyses WHERE id = ?",
        [id]
      );
      if (!analysis) return null;

      const factors = await db.query<AnalysisFactor>(
        "SELECT * FROM analysis_factors WHERE analysis_id = ? ORDER BY sort_order ASC",
        [id]
      );

      return { ...analysis, factors };
    },

    async create(input) {
      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO analyses (
           id, repair_event_id, generated_at, engine_version,
           deterministic_inputs, overall_lean, confidence,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.repairEventId,
          now,
          input.engineVersion,
          input.deterministicInputs,
          input.overallLean,
          input.confidence ?? null,
          now,
        ]
      );
      const created = await db.queryOne<Analysis>(
        "SELECT * FROM analyses WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created analysis");
      return created;
    },

    async addFactor(analysisId, factorType, direction, weight, explanation, opts = {}) {
      const maxSort = await db.queryOne<{ max_sort: number | null }>(
        "SELECT MAX(sort_order) as max_sort FROM analysis_factors WHERE analysis_id = ?",
        [analysisId]
      );
      const nextSort = opts.sortOrder ?? (maxSort?.max_sort ?? -1) + 1;

      const { last_row_id } = await db.run(
        `INSERT INTO analysis_factors (
           analysis_id, factor_type, direction, weight,
           calculated_value, reference_value, unit,
           data_quality, explanation, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          analysisId,
          factorType,
          direction,
          weight,
          opts.calculatedValue ?? null,
          opts.referenceValue ?? null,
          opts.unit ?? null,
          opts.dataQuality ?? "medium",
          explanation,
          nextSort,
        ]
      );

      const factor = await db.queryOne<AnalysisFactor>(
        "SELECT * FROM analysis_factors WHERE rowid = ?",
        [last_row_id]
      );
      if (!factor) throw new Error("Failed to retrieve created factor");
      return factor;
    },

    async setAiExplanation(id, explanation) {
      await db.run(
        "UPDATE analyses SET ai_explanation = ? WHERE id = ?",
        [explanation, id]
      );
    },
  };
}
