import {
  createRepairEventRepository,
  createEquipmentRepository,
} from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";

export async function handleRepairEvents(
  request: Request,
  db: KoduD1Client
): Promise<Response> {
  const body = await request.json() as {
    equipmentId: string;
    propertyId: string;
    eventDate?: string;
    descriptionOfProblem: string;
    isFirstRepair?: boolean;
    priorRepairCount?: number;
    priorRepairSpendApprox?: number;
    urgency?: "immediate" | "soon" | "can_wait" | "unknown";
    homeownerContext?: string;
  };

  if (!body.equipmentId || !body.propertyId || !body.descriptionOfProblem) {
    return Response.json(
      { error: "equipmentId, propertyId, and descriptionOfProblem are required" },
      { status: 400 }
    );
  }

  const repo = createRepairEventRepository(db);
  const repairEvent = await repo.create({
    equipmentId: body.equipmentId,
    propertyId: body.propertyId,
    eventDate: body.eventDate ?? new Date().toISOString().split("T")[0]!,
    descriptionOfProblem: body.descriptionOfProblem,
    isFirstRepair: body.isFirstRepair,
    priorRepairCount: body.priorRepairCount,
    priorRepairSpendApprox: body.priorRepairSpendApprox,
    urgency: body.urgency ?? "unknown",
    homeownerContext: body.homeownerContext,
  });

  return Response.json({ repairEvent }, { status: 201 });
}

export async function handleRepairEventById(
  db: KoduD1Client,
  id: string
): Promise<Response> {
  const repo = createRepairEventRepository(db);
  const repairEvent = await repo.findById(id);

  if (!repairEvent) {
    return Response.json({ error: "Repair event not found" }, { status: 404 });
  }

  // Also return current equipment facts so the analysis page has what it needs
  const equipRepo = createEquipmentRepository(db);
  const raw = repairEvent as unknown as Record<string, unknown>;
  const equipment = await equipRepo.findWithFacts((raw["equipment_id"] ?? raw["equipmentId"]) as string);

  return Response.json({ repairEvent, equipment });
}
