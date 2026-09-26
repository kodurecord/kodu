// Analysis — KODU's structured repair-vs-replace reasoning.
//
// Architecture:
//   Structured inputs → deterministic calculations → analysis_factors
//   → optional AI explanation of those factors
//
// The AI explains the structured evidence in homeowner-friendly language.
// It does NOT independently determine the recommendation.
// deterministic_inputs stores all reference data used, enabling full reproducibility.

export type AnalysisLean = "repair" | "replace" | "inconclusive";
export type FactorDirection = "favors_repair" | "favors_replace" | "neutral" | "unknown";
export type FactorWeight = "low" | "medium" | "high";
export type DataQuality = "confirmed" | "estimated" | "assumed" | "unknown";

export type AnalysisFactorType =
  | "equipment_age_vs_lifespan"   // age as % of expected life
  | "repair_cost_ratio"           // repair cost / replacement cost
  | "repair_history"              // number and cost of recent repairs
  | "first_major_repair"          // first significant repair on this equipment
  | "efficiency_delta"            // operating cost difference new vs existing
  | "warranty_status"             // active warranty coverage (hook for KODU Warranty)
  | "recall_status"               // active recall (hook for KODU Recall)
  | "parts_availability"          // parts still available / equipment EOL
  | "regional_cost_context"       // repair cost relative to regional benchmarks
  | "homeowner_context"           // financial/life circumstances weighting
  | "permit_complexity";          // permit requirements for replacement

export interface AnalysisFactor {
  id: number;
  analysisId: string;
  factorType: AnalysisFactorType;
  direction: FactorDirection;
  weight: FactorWeight;
  calculatedValue?: number;   // numeric result: 0.38 for cost ratio, 12 for age in years
  referenceValue?: number;    // benchmark: 15 years expected lifespan, 0.50 cost ratio threshold
  unit?: string;              // 'years', 'usd', 'ratio', 'pct'
  dataQuality: DataQuality;
  explanation: string;        // concise homeowner-facing factor explanation
  sortOrder: number;
}

export interface Analysis {
  id: string; // ULID
  repairEventId: string;
  generatedAt: string;
  engineVersion: string;        // semver: which rule set + reference data version
  deterministicInputs: string;  // JSON: all reference data used (lifespan tables, cost benchmarks)
  aiExplanation?: string;       // homeowner-facing narrative (optional, explains the factors)
  overallLean: AnalysisLean;
  confidence?: number;          // 0.0–1.0
  createdAt: string;
}

export interface AnalysisWithFactors extends Analysis {
  factors: AnalysisFactor[];
}

// The structured inputs fed to the deterministic engine
export interface AnalysisInputs {
  equipment: {
    categoryKey: string;
    ageYears?: number;
    expectedLifespanYears?: number; // from reference table
    ageDataQuality: DataQuality;
  };
  repairEvent: {
    isFirstRepair?: boolean;
    priorRepairCount?: number;
    priorRepairSpendApprox?: number;
    urgency: string;
    homeownerContext?: string;
  };
  quote: {
    totalAmount?: number;
    estimatedReplacementCost?: number;
  };
  referenceData: {
    expectedLifespanYears: number;
    replacementCostLow: number;
    replacementCostHigh: number;
    referenceDataVersion: string;
  };
}
