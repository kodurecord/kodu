import type { KoduD1Client } from "../client";
import type { Quote, QuoteLineItem, CreateQuoteInput } from "@kodu/entity-schema";
import { ulid } from "../ulid";

export interface QuoteRepository {
  findById(id: string): Promise<Quote | null>;
  findByRepairEvent(repairEventId: string): Promise<Quote[]>;
  findWithLineItems(id: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | null>;
  create(input: CreateQuoteInput): Promise<Quote>;
  addLineItem(
    quoteId: string,
    description: string,
    amount?: number,
    lineType?: string,
    sortOrder?: number
  ): Promise<QuoteLineItem>;
  setSelected(id: string, repairEventId: string): Promise<void>;
}

export function createQuoteRepository(db: KoduD1Client): QuoteRepository {
  return {
    async findById(id) {
      return db.queryOne<Quote>("SELECT * FROM quotes WHERE id = ?", [id]);
    },

    async findByRepairEvent(repairEventId) {
      return db.query<Quote>(
        `SELECT * FROM quotes
         WHERE repair_event_id = ?
         ORDER BY quote_date ASC, created_at ASC`,
        [repairEventId]
      );
    },

    async findWithLineItems(id) {
      const quote = await db.queryOne<Quote>(
        "SELECT * FROM quotes WHERE id = ?",
        [id]
      );
      if (!quote) return null;

      const lineItems = await db.query<QuoteLineItem>(
        `SELECT * FROM quote_line_items
         WHERE quote_id = ?
         ORDER BY sort_order ASC`,
        [id]
      );

      return { ...quote, lineItems };
    },

    async create(input) {
      const id = ulid();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO quotes (
           id, repair_event_id, contractor_name, contractor_phone,
           contractor_license, quote_date, total_amount, currency,
           is_selected, source_document_id, notes, provenance_id,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', 0, ?, ?, ?, ?, ?)`,
        [
          id,
          input.repairEventId,
          input.contractorName ?? null,
          input.contractorPhone ?? null,
          input.contractorLicense ?? null,
          input.quoteDate ?? null,
          input.totalAmount ?? null,
          input.sourceDocumentId ?? null,
          input.notes ?? null,
          input.provenanceId ?? null,
          now,
          now,
        ]
      );
      const created = await db.queryOne<Quote>(
        "SELECT * FROM quotes WHERE id = ?",
        [id]
      );
      if (!created) throw new Error("Failed to retrieve created quote");
      return created;
    },

    async addLineItem(quoteId, description, amount, lineType, sortOrder) {
      const maxSort = await db.queryOne<{ max_sort: number | null }>(
        "SELECT MAX(sort_order) as max_sort FROM quote_line_items WHERE quote_id = ?",
        [quoteId]
      );
      const nextSort = sortOrder ?? (maxSort?.max_sort ?? -1) + 1;

      const { last_row_id } = await db.run(
        `INSERT INTO quote_line_items (quote_id, sort_order, description, amount, line_type)
         VALUES (?, ?, ?, ?, ?)`,
        [quoteId, nextSort, description, amount ?? null, lineType ?? null]
      );

      const item = await db.queryOne<QuoteLineItem>(
        "SELECT * FROM quote_line_items WHERE rowid = ?",
        [last_row_id]
      );
      if (!item) throw new Error("Failed to retrieve created line item");
      return item;
    },

    async setSelected(id, repairEventId) {
      // Unselect all others first
      await db.run(
        "UPDATE quotes SET is_selected = 0 WHERE repair_event_id = ?",
        [repairEventId]
      );
      await db.run(
        "UPDATE quotes SET is_selected = 1 WHERE id = ?",
        [id]
      );
    },
  };
}
