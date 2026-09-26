import {
  createEquipmentRepository,
  createProvenanceRepository,
} from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";
import { userEntered } from "@kodu/provenance";

export async function handleEquipment(
  request: Request,
  db: KoduD1Client
): Promise<Response> {
  const body = await request.json() as {
    propertyId: string;
    categoryKey: string;
    // Optional initial facts
    installYear?: number;
    ageYearsEstimated?: number;
    manufacturer?: string;
    modelNumber?: string;
  };

  if (!body.propertyId || !body.categoryKey) {
    return Response.json(
      { error: "propertyId and categoryKey are required" },
      { status: 400 }
    );
  }

  const equipRepo = createEquipmentRepository(db);
  const provRepo = createProvenanceRepository(db);

  const equipment = await equipRepo.create({
    propertyId: body.propertyId,
    categoryKey: body.categoryKey,
  });

  // Persist any initial facts the homeowner provided
  const factsToAdd: Array<[string, string]> = [];
  if (body.installYear) factsToAdd.push(["install_year", String(body.installYear)]);
  if (body.ageYearsEstimated) factsToAdd.push(["age_years_estimated", String(body.ageYearsEstimated)]);
  if (body.manufacturer) factsToAdd.push(["manufacturer", body.manufacturer]);
  if (body.modelNumber) factsToAdd.push(["model_number", body.modelNumber]);

  if (factsToAdd.length > 0) {
    const prov = await provRepo.create(userEntered());
    for (const [key, val] of factsToAdd) {
      await equipRepo.addFact(equipment.id, key, val, prov.id);
    }
  }

  const withFacts = await equipRepo.findWithFacts(equipment.id);
  return Response.json({ equipment: withFacts }, { status: 201 });
}

export async function handleEquipmentFacts(
  request: Request,
  db: KoduD1Client,
  equipmentId: string
): Promise<Response> {
  const body = await request.json() as {
    factKey: string;
    factValue: string;
    source?: "user_entered" | "contractor_provided";
  };

  if (!body.factKey || !body.factValue) {
    return Response.json(
      { error: "factKey and factValue are required" },
      { status: 400 }
    );
  }

  const equipRepo = createEquipmentRepository(db);
  const provRepo = createProvenanceRepository(db);

  const prov = await provRepo.create(userEntered());
  const fact = await equipRepo.addFact(equipmentId, body.factKey, body.factValue, prov.id);

  return Response.json({ fact }, { status: 201 });
}
