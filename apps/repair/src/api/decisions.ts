import { createClient } from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";
import { ulid } from "@kodu/database";

export async function handleDecide(
  request: Request,
  db: KoduD1Client,
  repairEventId: string
): Promise<Response> {
  const body = await request.json() as {
    decision: "repair" | "replace" | "defer" | "undecided";
    analysisId?: string;
    homeownerNotes?: string;
  };

  if (!body.decision) {
    return Response.json({ error: "decision is required" }, { status: 400 });
  }

  const id = ulid();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO decisions (id, repair_event_id, analysis_id, decision, decided_at, homeowner_notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, repairEventId, body.analysisId ?? null, body.decision, now, body.homeownerNotes ?? null, now]
  );

  // Update repair event status
  if (body.decision === "repair" || body.decision === "replace") {
    await db.run(
      "UPDATE repair_events SET status = 'decided', updated_at = ? WHERE id = ?",
      [now, repairEventId]
    );
  }

  const decision = await db.queryOne(
    "SELECT * FROM decisions WHERE id = ?",
    [id]
  );

  return Response.json({ decision }, { status: 201 });
}
