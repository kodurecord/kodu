import { createQuoteRepository } from "@kodu/database";
import type { KoduD1Client } from "@kodu/database";

export async function handleQuotes(
  request: Request,
  db: KoduD1Client,
  repairEventId: string
): Promise<Response> {
  const body = await request.json() as {
    contractorName?: string;
    contractorPhone?: string;
    contractorLicense?: string;
    quoteDate?: string;
    totalAmount?: number;
    notes?: string;
    lineItems?: Array<{
      description: string;
      amount?: number;
      lineType?: string;
    }>;
  };

  const repo = createQuoteRepository(db);
  const quote = await repo.create({
    repairEventId,
    contractorName: body.contractorName,
    contractorPhone: body.contractorPhone,
    contractorLicense: body.contractorLicense,
    quoteDate: body.quoteDate,
    totalAmount: body.totalAmount,
    notes: body.notes,
  });

  // Add line items if provided
  if (body.lineItems && body.lineItems.length > 0) {
    for (let i = 0; i < body.lineItems.length; i++) {
      const item = body.lineItems[i]!;
      await repo.addLineItem(quote.id, item.description, item.amount, item.lineType, i);
    }
  }

  const withLineItems = await repo.findWithLineItems(quote.id);
  return Response.json({ quote: withLineItems }, { status: 201 });
}
