import { requireSessionWallet } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { classifyReceipt, getReceiptView, parseClassifyInput } from "@/lib/services/receipts";

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Context) => {
  const wallet = await requireSessionWallet();
  return { receipt: await getReceiptView(getDeps(), wallet, (await params).id) };
});

/** Classifies a payment: category, description and (optionally) who the payer is. */
export const PATCH = route(async (request: Request, { params }: Context) => {
  const wallet = await requireSessionWallet();
  const input = parseClassifyInput(await readJson(request));
  return { receipt: await classifyReceipt(getDeps(), wallet, (await params).id, input) };
});
