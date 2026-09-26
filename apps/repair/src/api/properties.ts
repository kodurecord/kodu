import { createClient, createPropertyRepository } from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";

export async function handleProperties(
  request: Request,
  db: KoduD1Client
): Promise<Response> {
  const body = await request.json() as {
    streetLine1: string;
    streetLine2?: string;
    city: string;
    state: string;
    zip: string;
    yearBuilt?: number;
    grossSqft?: number;
    propertyType?: string;
  };

  if (!body.streetLine1 || !body.city || !body.state || !body.zip) {
    return Response.json(
      { error: "streetLine1, city, state, and zip are required" },
      { status: 400 }
    );
  }

  const repo = createPropertyRepository(db);
  const property = await repo.create({
    streetLine1: body.streetLine1,
    streetLine2: body.streetLine2,
    city: body.city,
    state: body.state,
    zip: body.zip,
    yearBuilt: body.yearBuilt,
    grossSqft: body.grossSqft,
    propertyType: body.propertyType,
  });

  return Response.json({ property }, { status: 201 });
}
