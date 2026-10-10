import { requireSessionWallet } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { createInvoice, listInvoiceViews } from "@/lib/services/invoices";

export const GET = route(async () => {
  const wallet = await requireSessionWallet();
  return { invoices: await listInvoiceViews(getDeps(), wallet) };
});

export const POST = route(async (request: Request) => {
  const wallet = await requireSessionWallet();
  return { invoice: await createInvoice(getDeps(), wallet, await readJson(request)) };
});
