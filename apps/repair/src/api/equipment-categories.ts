import type { KoduD1Client } from "@kodu/database";

export async function handleCategories(db: KoduD1Client): Promise<Response> {
  const categories = await db.query<{
    key: string;
    label: string;
    group_name: string;
    typical_lifespan_yrs: number | null;
  }>("SELECT key, label, group_name, typical_lifespan_yrs FROM equipment_categories ORDER BY group_name, label");

  return Response.json({ categories });
}
