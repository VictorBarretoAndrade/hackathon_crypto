import { requireSessionWallet } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { renderSummaryPdf } from "@/lib/reports/pdf";
import { getDeps } from "@/lib/services/deps";
import { buildMonthlyReport } from "@/lib/services/reports";

// @react-pdf/renderer needs Node.js APIs.
export const runtime = "nodejs";

/** The month's summary as a PDF. */
export const GET = route(async (request: Request) => {
  const wallet = await requireSessionWallet();
  const month = new URL(request.url).searchParams.get("month");
  const report = await buildMonthlyReport(getDeps(), wallet, month);
  const pdf = await renderSummaryPdf(report, wallet);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recebi-summary-${report.month}.pdf"`,
    },
  });
});
