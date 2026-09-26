/**
 * KODU Repair — Deterministic Analysis Engine
 *
 * This engine calculates a repair-vs-replace recommendation from structured
 * inputs and reference data. It does NOT call an LLM. Each factor is
 * calculated, weighted, and persisted. An optional AI explanation step can
 * be added on top, but the lean (repair / replace / inconclusive) is always
 * determined here.
 *
 * Engine version matches LIFESPAN_REFERENCE_VERSION from @kodu/shared-types.
 * All reference data used is snapshotted in deterministic_inputs for auditability.
 */

import {
  LIFESPAN_REFERENCES,
  REPLACEMENT_COST_REFERENCES,
  LIFESPAN_REFERENCE_VERSION,
  getLifespan,
  getReplacementCost,
} from "@kodu/shared-types";
import type { EquipmentFact } from "@kodu/entity-schema";

export interface AnalysisInputData {
  // Equipment
  categoryKey: string;
  // Known facts (current active values)
  installYear?: number;
  ageYearsEstimated?: number;
  // Repair event context
  repairQuoteTotal?: number;   // USD — lowest quote for this repair
  priorRepairCount?: number;
  priorRepairSpendApprox?: number;
  isFirstRepair?: boolean;
  urgency?: string;
  homeownerContext?: string;
  currentYear: number;
}

export interface CalculatedFactor {
  factorType: string;
  direction: "favors_repair" | "favors_replace" | "neutral" | "unknown";
  weight: "primary" | "secondary" | "contextual" | "informational";
  calculatedValue?: number;
  referenceValue?: number;
  unit?: string;
  dataQuality: "high" | "medium" | "low" | "insufficient";
  explanation: string;
}

export interface EngineResult {
  overallLean: "repair" | "replace" | "inconclusive";
  confidence: "high" | "medium" | "low";
  factors: CalculatedFactor[];
  deterministicInputsJson: string;   // snapshot for audit
  engineVersion: string;
}

export function runAnalysis(inputs: AnalysisInputData): EngineResult {
  const factors: CalculatedFactor[] = [];
  const lifespan = getLifespan(inputs.categoryKey);
  const costRef = getReplacementCost(inputs.categoryKey);

  // Snapshot all reference data used (for reproducibility)
  const snapshot = {
    engineVersion: LIFESPAN_REFERENCE_VERSION,
    lifespan: lifespan ?? null,
    costRef: costRef ?? null,
    inputs: { ...inputs },
  };

  // ── FACTOR 1: Age vs expected lifespan ─────────────────────────────────
  let ageYears: number | undefined;
  let ageDataQuality: "high" | "medium" | "low" | "insufficient" = "insufficient";

  if (inputs.installYear) {
    ageYears = inputs.currentYear - inputs.installYear;
    ageDataQuality = "high";
  } else if (inputs.ageYearsEstimated) {
    ageYears = inputs.ageYearsEstimated;
    ageDataQuality = "medium";
  }

  if (lifespan && ageYears !== undefined) {
    const pctOfLife = ageYears / lifespan.expectedYears;
    let direction: CalculatedFactor["direction"];
    let explanation: string;

    if (pctOfLife < 0.5) {
      direction = "favors_repair";
      explanation = `At ${ageYears} years old, this ${inputs.categoryKey.replace(/_/g, " ")} has used roughly ${Math.round(pctOfLife * 100)}% of its expected ${lifespan.expectedYears}-year life (NAHB/HUD). Repair is likely cost-effective at this stage.`;
    } else if (pctOfLife < 0.75) {
      direction = "neutral";
      explanation = `At ${ageYears} years old, this unit has used about ${Math.round(pctOfLife * 100)}% of its expected ${lifespan.expectedYears}-year life. The decision depends on repair cost and condition.`;
    } else if (pctOfLife < 1.0) {
      direction = "favors_replace";
      explanation = `At ${ageYears} years old, this unit is in the final quarter of its expected ${lifespan.expectedYears}-year life (NAHB/HUD). Replacement deserves serious consideration — repairs now may be followed by more failures soon.`;
    } else {
      direction = "favors_replace";
      explanation = `At ${ageYears} years old, this unit has exceeded its expected ${lifespan.expectedYears}-year lifespan (NAHB/HUD). Replacement is generally the prudent choice.`;
    }

    factors.push({
      factorType: "equipment_age_vs_lifespan",
      direction,
      weight: "primary",
      calculatedValue: ageYears,
      referenceValue: lifespan.expectedYears,
      unit: "years",
      dataQuality: ageDataQuality,
      explanation,
    });
  } else {
    factors.push({
      factorType: "equipment_age_vs_lifespan",
      direction: "unknown",
      weight: "primary",
      dataQuality: "insufficient",
      explanation: "Equipment age is unknown. Without age data, the lifespan factor cannot be evaluated. Adding the install year or estimated age will significantly improve this analysis.",
    });
  }

  // ── FACTOR 2: Repair cost ratio ────────────────────────────────────────
  if (inputs.repairQuoteTotal && costRef) {
    const ratio = inputs.repairQuoteTotal / costRef.medianUsd;
    let direction: CalculatedFactor["direction"];
    let explanation: string;

    if (ratio < 0.33) {
      direction = "favors_repair";
      explanation = `The repair quote of $${inputs.repairQuoteTotal.toLocaleString()} is ${Math.round(ratio * 100)}% of the national median replacement cost ($${costRef.medianUsd.toLocaleString()}). At under 33%, repair is strongly favored economically.`;
    } else if (ratio < 0.5) {
      direction = "favors_repair";
      explanation = `The repair quote ($${inputs.repairQuoteTotal.toLocaleString()}) is ${Math.round(ratio * 100)}% of estimated replacement cost ($${costRef.medianUsd.toLocaleString()} median). Repair is economically reasonable if the unit is in good condition.`;
    } else if (ratio < 1.0) {
      direction = "neutral";
      explanation = `The repair quote ($${inputs.repairQuoteTotal.toLocaleString()}) is ${Math.round(ratio * 100)}% of estimated replacement cost ($${costRef.medianUsd.toLocaleString()} median). This is a significant cost — weigh it alongside equipment age and history.`;
    } else {
      direction = "favors_replace";
      explanation = `The repair quote ($${inputs.repairQuoteTotal.toLocaleString()}) approaches or exceeds the estimated replacement cost ($${costRef.medianUsd.toLocaleString()} median). At this price, replacement may deliver better long-term value.`;
    }

    factors.push({
      factorType: "repair_cost_ratio",
      direction,
      weight: "primary",
      calculatedValue: inputs.repairQuoteTotal,
      referenceValue: costRef.medianUsd,
      unit: "usd",
      dataQuality: "medium", // replacement costs are national medians, not local quotes
      explanation,
    });
  } else if (inputs.repairQuoteTotal && !costRef) {
    factors.push({
      factorType: "repair_cost_ratio",
      direction: "unknown",
      weight: "primary",
      calculatedValue: inputs.repairQuoteTotal,
      dataQuality: "low",
      explanation: `A repair quote of $${inputs.repairQuoteTotal.toLocaleString()} was provided, but no replacement cost reference is available for this equipment type. Compare the repair cost to 2–3 replacement quotes for a complete picture.`,
    });
  }

  // ── FACTOR 3: Repair history ────────────────────────────────────────────
  if (inputs.priorRepairCount !== undefined && inputs.priorRepairCount > 0) {
    const totalSpend = (inputs.priorRepairSpendApprox ?? 0) + (inputs.repairQuoteTotal ?? 0);
    let direction: CalculatedFactor["direction"];
    let explanation: string;

    if (inputs.priorRepairCount >= 3) {
      direction = "favors_replace";
      explanation = `This unit has been repaired ${inputs.priorRepairCount} times previously${inputs.priorRepairSpendApprox ? ` (≈$${inputs.priorRepairSpendApprox.toLocaleString()} total spent)` : ""}. Repeated failures suggest systemic deterioration — further repairs may not solve the underlying problem.`;
    } else if (inputs.priorRepairCount === 2) {
      direction = "favors_replace";
      explanation = `Two prior repairs indicate this unit has an established failure pattern. Consider whether additional repair addresses the root cause or only postpones replacement.`;
    } else {
      direction = "neutral";
      explanation = `One prior repair is within normal range for most equipment types. This alone does not signal a pattern.`;
    }

    factors.push({
      factorType: "repair_history",
      direction,
      weight: "secondary",
      calculatedValue: inputs.priorRepairCount,
      dataQuality: inputs.priorRepairSpendApprox ? "medium" : "low",
      explanation,
    });
  } else if (inputs.isFirstRepair === true) {
    factors.push({
      factorType: "first_major_repair",
      direction: "favors_repair",
      weight: "secondary",
      dataQuality: "high",
      explanation: "This is the first repair for this unit. A single incident without prior history generally favors repair — most equipment types can have isolated failures.",
    });
  }

  // ── FACTOR 4: Urgency context ───────────────────────────────────────────
  if (inputs.urgency === "immediate") {
    factors.push({
      factorType: "homeowner_context",
      direction: "neutral",
      weight: "contextual",
      dataQuality: "high",
      explanation: "The problem is urgent. If replacement is the right choice, the timeline may require a temporary fix or rental while a permanent solution is arranged.",
    });
  }

  // ── OVERALL LEAN ────────────────────────────────────────────────────────
  const primaryFactors = factors.filter((f) => f.weight === "primary");
  const secondary = factors.filter((f) => f.weight === "secondary");

  let repairScore = 0;
  let replaceScore = 0;
  let unknownPrimary = 0;

  for (const f of primaryFactors) {
    if (f.direction === "favors_repair") repairScore += 2;
    else if (f.direction === "favors_replace") replaceScore += 2;
    else if (f.direction === "unknown") unknownPrimary++;
  }
  for (const f of secondary) {
    if (f.direction === "favors_repair") repairScore += 1;
    else if (f.direction === "favors_replace") replaceScore += 1;
  }

  let overallLean: EngineResult["overallLean"];
  let confidence: EngineResult["confidence"];

  if (unknownPrimary >= primaryFactors.length || primaryFactors.length === 0) {
    overallLean = "inconclusive";
    confidence = "low";
  } else if (repairScore > replaceScore * 1.5) {
    overallLean = "repair";
    confidence = unknownPrimary > 0 ? "medium" : "high";
  } else if (replaceScore > repairScore * 1.5) {
    overallLean = "replace";
    confidence = unknownPrimary > 0 ? "medium" : "high";
  } else if (repairScore > replaceScore) {
    overallLean = "repair";
    confidence = "medium";
  } else if (replaceScore > repairScore) {
    overallLean = "replace";
    confidence = "medium";
  } else {
    overallLean = "inconclusive";
    confidence = "low";
  }

  return {
    overallLean,
    confidence,
    factors,
    deterministicInputsJson: JSON.stringify(snapshot),
    engineVersion: LIFESPAN_REFERENCE_VERSION,
  };
}
