/**
 * @kodu/database
 *
 * Repository layer for all KODU D1 access.
 * Workers should import from here, never call d1.prepare() directly.
 *
 * Usage:
 *   import { createClient, createEquipmentRepository } from '@kodu/database';
 *
 *   export default {
 *     async fetch(request, env) {
 *       const db = createClient(env.DB);
 *       const equipment = createEquipmentRepository(db);
 *       const item = await equipment.findById('...');
 *     }
 *   }
 */

export { createClient } from "./client";
export type { KoduD1Client } from "./client";

export { createPropertyRepository } from "./repositories/property";
export type { PropertyRepository } from "./repositories/property";

export { createEquipmentRepository } from "./repositories/equipment";
export type { EquipmentRepository } from "./repositories/equipment";

export { createRepairEventRepository } from "./repositories/repair-event";
export type { RepairEventRepository } from "./repositories/repair-event";

export { createQuoteRepository } from "./repositories/quote";
export type { QuoteRepository } from "./repositories/quote";

export { createAnalysisRepository } from "./repositories/analysis";
export type { AnalysisRepository } from "./repositories/analysis";

export { createProvenanceRepository } from "./repositories/provenance";
export type { ProvenanceRepository } from "./repositories/provenance";

export { ulid } from "./ulid";
