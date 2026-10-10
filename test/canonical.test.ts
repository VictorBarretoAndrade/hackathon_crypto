import { describe, expect, it } from "vitest";
import { canonicalize, hashDocument, sha256Hex } from "@/lib/receipts/canonical";

const RECEIPT = {
  type: "recebi.receipt",
  v: 1,
  network: "solana:devnet",
  amount: "1200.00",
  symbol: "USDC",
  mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  amount_brl: "6518.52",
  fx: { source: "BCB PTAX", rule: "ptax_buy", date: "2026-10-07", rate: "5.4321" },
  block_time: "2026-10-07T14:03:11Z",
  payment_tx: "5x".repeat(44),
  payer_wallet: "8sh86hmWL4ka7U44dFn3U72ZagLsAME4iRMwajfgR8QT",
  recipient_wallet: "75AjMdh7Gn1TLigfze541AVJGJ4TyqBEaRZk3pozfBza",
  category: "service",
  counterparty: "Acme Labs",
  description: "Web app development, September",
  invoice_hash: null,
  issued_at: "2026-10-08T15:20:00Z",
};

describe("canonicalize", () => {
  it("sorts keys at every level and uses no whitespace", () => {
    expect(canonicalize({ b: 1, a: { d: "x", c: [{ z: null, y: true }] } })).toBe(
      '{"a":{"c":[{"y":true,"z":null}],"d":"x"},"b":1}',
    );
  });

  it("starts the receipt with its alphabetically first keys", () => {
    expect(canonicalize(RECEIPT).startsWith('{"amount":"1200.00","amount_brl":"6518.52","block_time":')).toBe(true);
  });

  it("keeps array order, which is meaningful", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("refuses values JSON cannot represent exactly", () => {
    expect(() => canonicalize({ amount: 1200.5 })).toThrow(/only allows integers/);
    expect(() => canonicalize({ amount: NaN })).toThrow(/only allows integers/);
    expect(() => canonicalize({ when: undefined })).toThrow(/cannot contain undefined/);
    expect(() => canonicalize({ big: 10n })).toThrow(/cannot contain bigint/);
  });
});

describe("sha256Hex", () => {
  it("matches the published SHA-256 test vectors", async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes text as UTF-8", async () => {
    expect(await sha256Hex("São Paulo")).toBe(await sha256Hex("São Paulo"));
    expect(await sha256Hex("São Paulo")).not.toBe(await sha256Hex("Sao Paulo"));
  });
});

describe("hashDocument", () => {
  it("gives the same hash for the same receipt", async () => {
    expect((await hashDocument(RECEIPT)).hash).toBe((await hashDocument({ ...RECEIPT })).hash);
  });

  it("does not depend on the order of keys in the input", async () => {
    const reversed = Object.fromEntries(Object.entries(RECEIPT).reverse());
    const shuffledFx = { ...RECEIPT, fx: { rate: "5.4321", date: "2026-10-07", rule: "ptax_buy", source: "BCB PTAX" } };
    const { hash } = await hashDocument(RECEIPT);
    expect((await hashDocument(reversed)).hash).toBe(hash);
    expect((await hashDocument(shuffledFx)).hash).toBe(hash);
  });

  it("does not depend on whitespace in the JSON text it was parsed from", async () => {
    const pretty = JSON.parse(JSON.stringify(RECEIPT, null, 4));
    expect((await hashDocument(pretty)).hash).toBe((await hashDocument(RECEIPT)).hash);
  });

  it("changes when any field changes, even by one character", async () => {
    const { hash } = await hashDocument(RECEIPT);
    const tampered = [
      { ...RECEIPT, amount: "1300.00" },
      { ...RECEIPT, amount_brl: "6518.53" },
      { ...RECEIPT, counterparty: "Acme Lab" },
      { ...RECEIPT, fx: { ...RECEIPT.fx, rate: "5.4322" } },
      { ...RECEIPT, invoice_hash: "" },
      { ...RECEIPT, extra: "field" },
    ];
    for (const receipt of tampered) {
      expect((await hashDocument(receipt)).hash).not.toBe(hash);
    }
  });

  it("produces a 64-character lowercase hex hash", async () => {
    expect((await hashDocument(RECEIPT)).hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
