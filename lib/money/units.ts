export interface FormatUnitsOptions {
  /** Pad the fraction with zeros up to this many digits. Default 0. */
  minFractionDigits?: number;
  /** Cut the fraction at this many digits. Truncates, never rounds. */
  maxFractionDigits?: number;
}

/**
 * Turns an integer amount in base units into a plain decimal string, without
 * ever going through a float: formatUnits(1200000000n, 6) === "1200".
 * No thousands separators; this is the exact value, not a display format.
 */
export function formatUnits(
  raw: bigint,
  decimals: number,
  options: FormatUnitsOptions = {},
): string {
  const { minFractionDigits = 0, maxFractionDigits } = options;

  const digits = (raw < 0n ? -raw : raw).toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  let fraction = digits.slice(digits.length - decimals);

  if (maxFractionDigits !== undefined) fraction = fraction.slice(0, maxFractionDigits);
  fraction = fraction.replace(/0+$/, "").padEnd(minFractionDigits, "0");

  // After truncation a tiny negative amount can become zero: no "-0".
  const isZero = /^0+$/.test(whole + fraction);
  const sign = raw < 0n && !isZero ? "-" : "";
  return sign + whole + (fraction ? `.${fraction}` : "");
}
