import { notFound } from "@/lib/errors";
import { route } from "@/lib/http";
import { seedMock } from "@/lib/mock/seed";
import { IS_MOCK } from "@/lib/mode";

/** Mock mode only: wipes the mock ledger and database and recreates the demo payments. */
export const POST = route(async () => {
  if (!IS_MOCK) throw notFound("Route");
  seedMock();
  return { ok: true };
});
