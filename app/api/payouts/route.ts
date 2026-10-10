import { requireSessionWallet } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { getPayoutProvider } from "@/lib/services/payouts";

export const GET = route(async () => {
  const wallet = await requireSessionWallet();
  return { payouts: await getDeps().store.listPayouts(wallet) };
});

/** Records a SIMULATED Pix payout. No tokens move and no Pix is sent. */
export const POST = route(async (request: Request) => {
  const wallet = await requireSessionWallet();
  const { mint, amount, pix_key } = await readJson(request);
  const payout = await getPayoutProvider(getDeps()).requestPayout({
    owner: wallet,
    mint: String(mint ?? ""),
    amount: String(amount ?? ""),
    pixKey: String(pix_key ?? ""),
  });
  return { payout };
});
