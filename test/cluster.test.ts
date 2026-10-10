import { describe, expect, it } from "vitest";
import {
  PUBLIC_DEVNET_RPC,
  assertDevnetCluster,
  explorerAddressUrl,
  explorerTxUrl,
  resolveRpcUrl,
} from "@/lib/solana/cluster";

describe("assertDevnetCluster", () => {
  it("accepts devnet and an unset value", () => {
    expect(() => assertDevnetCluster("devnet")).not.toThrow();
    expect(() => assertDevnetCluster(undefined)).not.toThrow();
    expect(() => assertDevnetCluster("")).not.toThrow();
  });

  it("refuses any other cluster", () => {
    expect(() => assertDevnetCluster("mainnet-beta")).toThrow(/only runs on devnet/);
    expect(() => assertDevnetCluster("testnet")).toThrow(/only runs on devnet/);
  });
});

describe("resolveRpcUrl", () => {
  it("uses the configured URL", () => {
    expect(resolveRpcUrl(" https://devnet.example.com/?api-key=k ")).toBe(
      "https://devnet.example.com/?api-key=k",
    );
  });

  it("falls back to the public devnet endpoint", () => {
    expect(resolveRpcUrl(undefined)).toBe(PUBLIC_DEVNET_RPC);
    expect(resolveRpcUrl("")).toBe(PUBLIC_DEVNET_RPC);
  });
});

describe("explorer links", () => {
  it("always point at devnet", () => {
    expect(explorerTxUrl("abc")).toBe("https://explorer.solana.com/tx/abc?cluster=devnet");
    expect(explorerAddressUrl("def")).toBe(
      "https://explorer.solana.com/address/def?cluster=devnet",
    );
  });
});
