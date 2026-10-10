import { route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { getPublicReceipt } from "@/lib/services/receipts";

type Context = { params: Promise<{ id: string }> };

/**
 * Public: the sealed receipt and its seal signature, for /verify/[id]. This is
 * a convenience. The verify page trusts none of it: it recomputes the hash and
 * checks both transactions onchain.
 */
export const GET = route(async (_request: Request, { params }: Context) => {
  return getPublicReceipt(getDeps(), (await params).id);
});
