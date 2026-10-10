import { requireSessionWallet } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { getDeps } from "@/lib/services/deps";
import { checkPendingInvoices } from "@/lib/services/invoices";
import { importReceipts } from "@/lib/services/receipts";

// Scanning a long history against a rate-limited RPC can take a while.
export const maxDuration = 60;

/** "Import from wallet". Idempotent: running it twice imports nothing new. */
export const POST = route(async () => {
  const wallet = await requireSessionWallet();
  const deps = getDeps();
  // Invoice payments first, so they arrive linked to their invoice.
  await checkPendingInvoices(deps, wallet);
  return importReceipts(deps, wallet);
});
