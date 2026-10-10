import { verifyChallenge } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";

/** Login step 2: checks the wallet's signature and opens the session. */
export const POST = route(async (request: Request) => {
  const { wallet, signature } = await readJson(request);
  const signedIn = await verifyChallenge(String(wallet ?? ""), String(signature ?? ""));
  const profile = await getDeps().store.ensureProfile(signedIn);
  return { wallet: signedIn, fx_rule: profile.fx_rule };
});
