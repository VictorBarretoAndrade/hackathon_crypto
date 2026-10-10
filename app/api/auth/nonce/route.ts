import { createChallenge } from "@/lib/auth/session";
import { readJson, requestOrigin, route } from "@/lib/http";

/** Login step 1: returns the message the wallet must sign. */
export const POST = route(async (request: Request) => {
  const { wallet } = await readJson(request);
  return { message: await createChallenge(String(wallet ?? ""), requestOrigin(request)) };
});
