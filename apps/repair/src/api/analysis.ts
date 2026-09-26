import {
  createAnalysisRepository,
  createRepairEventRepository,
  createEquipmentRepository,
  createQuoteRepository,
} from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";
import { runAnalysis } from "../engine/analysis";

export async function handleAnalyse(
  request: Request,
  db: KoduD1Client,
  repairEventId: string
): Promise<Response> {
  // Load repair event
  const repairRepo = createRepairEventRepository(db);
  const repairEvent = await repairRepo.findById(repairEventId);
  if (!repairEvent) {
    return Response.json({ error: "Repair event not found" }, { status: 404 });
  }

  // D1 returns snake_case column names; cast for safe access
  const re = repairEvent as unknown as Record<string, unknown>;

  // Load equipment with current facts
  const equipRepo = createEquipmentRepository(db);
  const equipmentId = (re["equipment_id"] ?? re["equipmentId"]) as string;
  const equipment = await equipRepo.findWithFacts(equipmentId);
  if (!equipment) {
    return Response.json({ error: "Equipment not found" }, { status: 404 });
  }

  // equipment.facts is EquipmentFact[] — D1 rows with snake_case columns
  const facts = (equipment.facts ?? []) as unknown as Array<Record<string, string>>;
  const getFact = (key: string) => facts.find((f) => f["fact_key"] === key)?.["fact_value"];

  const installYearStr = getFact("install_year");
  const ageEstStr = getFact("age_years_estimated");

  // Get the lowest repair quote total
  const quoteRepo = createQuoteRepository(db);
  const quotes = await quoteRepo.findByRepairEvent(repairEventId);
  const repairQuotes = quotes.filter((q: any) => q.total_amount != null);
  const lowestQuote = repairQuotes.length > 0
    ? Math.min(...repairQuotes.map((q: any) => q.total_amount as number))
    : undefined;

  // D1 returns snake_case for equipment too
  const eq = equipment as unknown as Record<string, unknown>;

  // Run the deterministic engine
  const result = runAnalysis({
    categoryKey: (eq["category_key"] ?? eq["categoryKey"]) as string,
    installYear: installYearStr ? parseInt(installYearStr, 10) : undefined,
    ageYearsEstimated: ageEstStr ? parseFloat(ageEstStr) : undefined,
    repairQuoteTotal: lowestQuote,
    priorRepairCount: (re["prior_repair_count"] ?? re["priorRepairCount"]) as number | undefined,
    priorRepairSpendApprox: (re["prior_repair_spend_approx"] ?? re["priorRepairSpendApprox"]) as number | undefined,
    isFirstRepair: re["is_first_repair"] === 1 ? true
      : re["is_first_repair"] === 0 ? false : undefined,
    urgency: (re["urgency"]) as string | undefined,
    homeownerContext: (re["homeowner_context"] ?? re["homeownerContext"]) as string | undefined,
    currentYear: new Date().getFullYear(),
  });

  // Persist analysis + factors
  const analysisRepo = createAnalysisRepository(db);
  const analysis = await analysisRepo.create({
    repairEventId,
    engineVersion: result.engineVersion,
    deterministicInputs: result.deterministicInputsJson,
    overallLean: result.overallLean,
    confidence: result.confidence,
  });

  for (let i = 0; i < result.factors.length; i++) {
    const f = result.factors[i]!;
    await analysisRepo.addFactor(
      analysis.id,
      f.factorType,
      f.direction,
      f.weight,
      f.explanation,
      {
        calculatedValue: f.calculatedValue,
        referenceValue: f.referenceValue,
        unit: f.unit,
        dataQuality: f.dataQuality,
        sortOrder: i,
      }
    );
  }

  const withFactors = await analysisRepo.findWithFactors(analysis.id);
  return Response.json({ analysis: withFactors }, { status: 201 });
}

export async function handleAnalysis(
  db: KoduD1Client,
  repairEventId: string
): Promise<Response> {
  const analysisRepo = createAnalysisRepository(db);
  const latest = await analysisRepo.findLatestByRepairEvent(repairEventId);

  if (!latest) {
    return Response.json(
      { error: "No analysis found for this repair event" },
      { status: 404 }
    );
  }

  const withFactors = await analysisRepo.findWithFactors(latest.id);
  return Response.json({ analysis: withFactors });
}
