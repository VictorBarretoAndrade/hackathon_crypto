import { describe, expect, it } from "vitest";
import { formatUnits } from "@/lib/money/units";

describe("formatUnits", () => {
  it("converts base units to a decimal string", () => {
    expect(formatUnits(1_200_000_000n, 6)).toBe("1200");
    expect(formatUnits(1_234_560_000n, 6)).toBe("1234.56");
    expect(formatUnits(1n, 6)).toBe("0.000001");
    expect(formatUnits(0n, 6)).toBe("0");
  });

  it("handles tokens with no decimals", () => {
    expect(formatUnits(42n, 0)).toBe("42");
  });

  it("pads the fraction when asked", () => {
    expect(formatUnits(1_200_000_000n, 6, { minFractionDigits: 2 })).toBe("1200.00");
    expect(formatUnits(1_200_500_000n, 6, { minFractionDigits: 2 })).toBe("1200.50");
    expect(formatUnits(1_200_123_400n, 6, { minFractionDigits: 2 })).toBe("1200.1234");
  });

  it("truncates instead of rounding", () => {
    expect(formatUnits(1_999_999_999n, 9, { maxFractionDigits: 4 })).toBe("1.9999");
    expect(formatUnits(5_000_000n, 9, { maxFractionDigits: 2 })).toBe("0");
  });

  it("stays exact beyond the float-safe range", () => {
    expect(formatUnits(16_286_767_455_977_782_163n, 6)).toBe("16286767455977.782163");
  });

  it("formats negative amounts and never prints -0", () => {
    expect(formatUnits(-1_500_000n, 6)).toBe("-1.5");
    expect(formatUnits(-1n, 6, { maxFractionDigits: 2 })).toBe("0");
  });
});
