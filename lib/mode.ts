/**
 * Recebi runs in one of two modes, chosen by NEXT_PUBLIC_RECEBI_MODE:
 *
 * - "live": Solana devnet, a real wallet (Phantom), Supabase and the Central
 *   Bank's PTAX API. This is the product.
 * - "mock": an in-memory fake Solana node, a built-in demo wallet, a local
 *   JSON file instead of Supabase and synthetic exchange rates. Nothing leaves
 *   the machine. For development and rehearsal only.
 *
 * The business logic is identical in both: only the transports are swapped.
 */
export type RecebiMode = "live" | "mock";

export function resolveMode(value: string | undefined): RecebiMode {
  const mode = value?.trim().toLowerCase() || "live";
  if (mode !== "live" && mode !== "mock") {
    throw new Error(`NEXT_PUBLIC_RECEBI_MODE must be "live" or "mock", got "${value}"`);
  }
  return mode;
}

export const MODE: RecebiMode = resolveMode(process.env.NEXT_PUBLIC_RECEBI_MODE);

export const IS_MOCK = MODE === "mock";

/**
 * Written into every receipt and invoice and checked on verification, so a
 * document produced in mock mode can never pass for a devnet one.
 */
export const NETWORK_ID = IS_MOCK ? "recebi:mock" : "solana:devnet";

/**
 * Where records live, for sentences shown to the user: "recorded on Solana".
 * In mock mode the interface must never claim something is on Solana.
 */
export const LEDGER_NAME = IS_MOCK ? "the mock ledger (not Solana)" : "Solana";
