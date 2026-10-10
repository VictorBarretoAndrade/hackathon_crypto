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

/**
 * The inverse of formatUnits: parseUnits("1200.5", 6) === 1200500000n.
 * Throws on anything that is not a plain non-negative decimal, or that has
 * more fraction digits than the token supports (we never round user input).
 */
export function parseUnits(value: string, decimals: number): bigint {
  const text = value.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`"${value}" is not a valid amount`);
  }
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) {
    throw new Error(`"${value}" has more than ${decimals} decimal places`);
  }
  return BigInt(whole + fraction.padEnd(decimals, "0"));
}

function groupThousands(whole: string, separator: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** Display format for token amounts: formatTokenAmount(1200000000n, 6) === "1,200.00". */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const [whole, fraction] = formatUnits(raw, decimals, { minFractionDigits: 2 }).split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  return `${sign}${groupThousands(whole.replace("-", ""), ",")}.${fraction}`;
}

/**
 * Brazilian format for a decimal string: formatBrazilian("6518.52") === "6.518,52".
 * `fractionDigits` pads (it does not round): the value is already rounded.
 */
export function formatBrazilian(value: string, fractionDigits = 2): string {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const padded = fraction.padEnd(fractionDigits, "0");
  return `${negative ? "-" : ""}${groupThousands(whole, ".")}${padded ? `,${padded}` : ""}`;
}

/** formatBRL("6518.52") === "R$ 6.518,52" */
export function formatBRL(value: string): string {
  return `R$ ${formatBrazilian(value, 2)}`;
}
