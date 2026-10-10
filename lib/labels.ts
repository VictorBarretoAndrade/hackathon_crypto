import type { ContactKind, FxRule, ReceiptCategory } from "@/lib/db/types";
import { formatBrazilian } from "@/lib/money/units";

export const CATEGORY_LABELS: Record<ReceiptCategory | "unclassified", string> = {
  service: "Service",
  prize: "Prize",
  grant: "Grant",
  own_transfer: "Own transfer",
  other: "Other",
  unclassified: "Unclassified",
};

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  client: "Client",
  platform: "Platform",
  self: "My own wallet",
  other: "Other",
};

export const FX_RULE_LABELS: Record<FxRule, string> = {
  ptax_buy: "PTAX buy",
  ptax_sell: "PTAX sell",
};

/** "Rate: R$ 5,4321 · PTAX buy · 2026-10-07": the rule and date are always shown with the rate. */
export function describeRate(fx: { rule: FxRule; date: string; rate: string }): string {
  return `Rate: R$ ${formatBrazilian(fx.rate, 4)} · ${FX_RULE_LABELS[fx.rule]} · ${fx.date}`;
}
