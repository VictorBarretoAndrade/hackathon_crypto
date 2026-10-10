import { requireSessionWallet } from "@/lib/auth/session";
import { badRequest } from "@/lib/errors";
import { readJson, route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { confirmSeal, prepareSeal } from "@/lib/services/receipts";

type Context = { params: Promise<{ id: string }> };

/** Seal step 1: freezes the receipt and returns its hash and the memo to sign. */
export const POST = route(async (_request: Request, { params }: Context) => {
  const wallet = await requireSessionWallet();
  return prepareSeal(getDeps(), wallet, (await params).id);
});

/** Seal step 2: the memo transaction is onchain; verify it and record its signature. */
export const PUT = route(async (request: Request, { params }: Context) => {
  const wallet = await requireSessionWallet();
  const { signature } = await readJson(request);
  if (typeof signature !== "string" || !signature) throw badRequest("Missing seal signature");
  return { receipt: await confirmSeal(getDeps(), wallet, (await params).id, signature) };
});
