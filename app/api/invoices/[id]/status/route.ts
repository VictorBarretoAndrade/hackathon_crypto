import { route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { checkInvoicePayment } from "@/lib/services/invoices";

type Context = { params: Promise<{ id: string }> };

/**
 * Public, polled by the pay page every few seconds. Looks onchain for a
 * payment carrying this invoice's reference and settles the invoice if found.
 */
export const GET = route(async (_request: Request, { params }: Context) => {
  return { invoice: await checkInvoicePayment(getDeps(), (await params).id) };
});
