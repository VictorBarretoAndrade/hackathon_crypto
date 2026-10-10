import type { FxRule, ReceiptCategory } from "@/lib/db/types";

/**
 * The receipt that gets sealed. Field names are part of the open format: once
 * a receipt is sealed, its canonical JSON must hash to the value in the memo.
 */
export interface ReceiptDocument {
  type: "recebi.receipt";
  v: 1;
  /** "solana:devnet", or "recebi:mock" for receipts made in mock mode. */
  network: string;
  /** Token amount as a decimal string with at least two places: "1200.00". */
  amount: string;
  symbol: string;
  mint: string;
  /** Value in reais, two places: "6518.52". */
  amount_brl: string;
  fx: { source: string; rule: FxRule; date: string; rate: string };
  /** When the payment was confirmed, UTC, no milliseconds. */
  block_time: string;
  payment_tx: string;
  payer_wallet: string | null;
  recipient_wallet: string;
  category: ReceiptCategory;
  /** Declared by the recipient. Not proven by the chain. */
  counterparty: string | null;
  description: string | null;
  /** Set when the payment settled a Recebi invoice. */
  invoice_hash: string | null;
  /** When the recipient generated this receipt. */
  issued_at: string;
}

/** Shape check for a parsed receipt. Returns a human-readable problem, or null if it is fine. */
export function describeReceiptProblem(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "The receipt is not a JSON object";
  }
  const doc = value as Record<string, unknown>;
  if (doc.type !== "recebi.receipt") return 'Field "type" must be "recebi.receipt"';
  if (doc.v !== 1) return 'Unsupported receipt version: field "v" must be 1';
  for (const field of ["network", "amount", "mint", "payment_tx", "recipient_wallet"]) {
    if (typeof doc[field] !== "string" || doc[field] === "") {
      return `Field "${field}" is missing`;
    }
  }
  if (doc.payer_wallet !== null && typeof doc.payer_wallet !== "string") {
    return 'Field "payer_wallet" must be a string or null';
  }
  if (doc.invoice_hash !== null && typeof doc.invoice_hash !== "string") {
    return 'Field "invoice_hash" must be a string or null';
  }
  return null;
}

/**
 * The file a user downloads: the receipt plus the signature of its seal. It is
 * everything /verify needs, with no call to Recebi's servers.
 */
export interface ReceiptFile {
  receipt: ReceiptDocument;
  seal_signature: string;
}
