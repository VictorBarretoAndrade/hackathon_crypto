import { clearSession } from "@/lib/auth/session";
import { route } from "@/lib/http";

export const POST = route(async () => {
  await clearSession();
  return { ok: true };
});
