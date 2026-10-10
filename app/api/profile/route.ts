import { requireSessionWallet } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { changeFxRule } from "@/lib/services/receipts";

/** Changes the exchange-rate rule and revalues the receipts that are not sealed. */
export const PATCH = route(async (request: Request) => {
  const wallet = await requireSessionWallet();
  const { fx_rule } = await readJson(request);
  return { fx_rule: await changeFxRule(getDeps(), wallet, fx_rule) };
});
