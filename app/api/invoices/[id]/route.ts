import { route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { getInvoiceView } from "@/lib/services/invoices";

type Context = { params: Promise<{ id: string }> };

/** Public: whoever has the link can see the invoice and pay it. */
export const GET = route(async (_request: Request, { params }: Context) => {
  return { invoice: await getInvoiceView(getDeps(), (await params).id) };
});
