import { PublicKey } from "@solana/web3.js";

/** A stablecoin Recebi accepts, as configured in NEXT_PUBLIC_STABLE_MINTS. */
export interface StableMint {
  /** Mint address, base58. */
  mint: string;
  symbol: string;
  decimals: number;
  /** Human-readable name shown in the UI, e.g. "USDC (devnet)". */
  label: string;
}

/** Circle's USDC on devnet. Checked against Circle's docs and the chain. */
export const DEVNET_USDC: StableMint = {
  mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  symbol: "USDC",
  decimals: 6,
  label: "USDC (devnet)",
};

function isValidAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses the NEXT_PUBLIC_STABLE_MINTS JSON. An unset or empty value falls back
 * to devnet USDC; a malformed value throws, so a typo in the env file fails
 * loudly instead of silently importing nothing.
 */
export function parseStableMints(raw: string | undefined): StableMint[] {
  if (raw === undefined || raw.trim() === "") return [DEVNET_USDC];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_STABLE_MINTS is not valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("NEXT_PUBLIC_STABLE_MINTS must be a non-empty JSON array");
  }

  const seen = new Set<string>();
  return parsed.map((entry: unknown, index) => {
    const where = `NEXT_PUBLIC_STABLE_MINTS[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`${where} must be an object`);
    }
    const { mint, symbol, decimals, label } = entry as Record<string, unknown>;

    if (typeof mint !== "string" || !isValidAddress(mint)) {
      throw new Error(`${where}.mint is not a valid Solana address`);
    }
    if (seen.has(mint)) {
      throw new Error(`${where}.mint is listed twice: ${mint}`);
    }
    seen.add(mint);
    if (typeof symbol !== "string" || symbol.trim() === "") {
      throw new Error(`${where}.symbol must be a non-empty string`);
    }
    // SPL token decimals are a u8.
    if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error(`${where}.decimals must be an integer between 0 and 255`);
    }
    if (label !== undefined && typeof label !== "string") {
      throw new Error(`${where}.label must be a string`);
    }

    return { mint, symbol, decimals, label: label?.trim() || symbol };
  });
}

export const STABLE_MINTS: StableMint[] = parseStableMints(
  process.env.NEXT_PUBLIC_STABLE_MINTS,
);

export function findStableMint(mint: string): StableMint | undefined {
  return STABLE_MINTS.find((entry) => entry.mint === mint);
}
