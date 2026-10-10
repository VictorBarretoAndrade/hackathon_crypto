import { badRequest, notFound } from "@/lib/errors";
import { readJson, route } from "@/lib/http";
import { MOCK_KEYS } from "@/lib/mock/keys";
import { mockPay } from "@/lib/mock/seed";
import { IS_MOCK } from "@/lib/mode";
import { formatUnits } from "@/lib/money/units";
import { getDeps } from "@/lib/services/deps";
import { getInvoiceView } from "@/lib/services/invoices";

/**
 * Mock mode only: plays the client. Signs the invoice's payment with the demo
 * client key and runs it on the mock ledger, standing in for a phone wallet
 * scanning the QR code. The pay page then detects it exactly as it would a
 * real payment.
 */
export const POST = route(async (request: Request) => {
  if (!IS_MOCK) throw notFound("Route");
  const { invoice_id } = await readJson(request);
  if (typeof invoice_id !== "string") throw badRequest("Missing invoice_id");

  const invoice = await getInvoiceView(getDeps(), invoice_id);
  const signature = mockPay({
    payer: MOCK_KEYS.clientAcme,
    recipient: invoice.issuer_wallet,
    amount: formatUnits(BigInt(invoice.amount_raw), invoice.decimals),
    memo: invoice.memo,
    reference: invoice.reference,
  });
  return { signature };
});
