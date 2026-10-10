import { requireSessionWallet } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { listReceiptViews } from "@/lib/services/receipts";

export const GET = route(async () => {
  const wallet = await requireSessionWallet();
  return { receipts: await listReceiptViews(getDeps(), wallet) };
});
