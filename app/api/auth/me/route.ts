import { getSessionWallet } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";

/** Who is signed in, if anyone. */
export const GET = route(async () => {
  const wallet = await getSessionWallet();
  if (!wallet) return { wallet: null, fx_rule: null };
  const profile = await getDeps().store.ensureProfile(wallet);
  return { wallet, fx_rule: profile.fx_rule };
});
