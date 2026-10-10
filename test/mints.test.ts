import { describe, expect, it } from "vitest";
import { DEVNET_USDC, parseStableMints } from "@/lib/config/mints";

const TEST_MINT = "So11111111111111111111111111111111111111112";

describe("parseStableMints", () => {
  it("falls back to devnet USDC when the variable is unset or blank", () => {
    expect(parseStableMints(undefined)).toEqual([DEVNET_USDC]);
    expect(parseStableMints("   ")).toEqual([DEVNET_USDC]);
  });

  it("parses the value documented in .env.example", () => {
    const raw =
      '[{"mint":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","symbol":"USDC","decimals":6,"label":"USDC (devnet)"}]';
    expect(parseStableMints(raw)).toEqual([DEVNET_USDC]);
  });

  it("keeps the order of several mints", () => {
    const raw = JSON.stringify([
      DEVNET_USDC,
      { mint: TEST_MINT, symbol: "TUSD", decimals: 6, label: "Test USD (devnet)" },
    ]);
    expect(parseStableMints(raw).map((entry) => entry.label)).toEqual([
      "USDC (devnet)",
      "Test USD (devnet)",
    ]);
  });

  it("uses the symbol when the label is missing", () => {
    const raw = JSON.stringify([{ mint: TEST_MINT, symbol: "TUSD", decimals: 6 }]);
    expect(parseStableMints(raw)[0].label).toBe("TUSD");
  });

  it("rejects malformed JSON and non-arrays", () => {
    expect(() => parseStableMints("[{")).toThrow(/not valid JSON/);
    expect(() => parseStableMints("{}")).toThrow(/non-empty JSON array/);
    expect(() => parseStableMints("[]")).toThrow(/non-empty JSON array/);
  });

  it("rejects an invalid mint address", () => {
    const raw = JSON.stringify([{ mint: "not-a-mint", symbol: "X", decimals: 6 }]);
    expect(() => parseStableMints(raw)).toThrow(/\[0\]\.mint is not a valid Solana address/);
  });

  it("rejects a duplicated mint", () => {
    const raw = JSON.stringify([DEVNET_USDC, DEVNET_USDC]);
    expect(() => parseStableMints(raw)).toThrow(/\[1\]\.mint is listed twice/);
  });

  it("rejects decimals that are not a whole number", () => {
    for (const decimals of [6.5, -1, "6", 256]) {
      const raw = JSON.stringify([{ mint: TEST_MINT, symbol: "X", decimals }]);
      expect(() => parseStableMints(raw)).toThrow(/decimals must be an integer/);
    }
  });
});
