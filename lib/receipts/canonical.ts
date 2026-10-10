/**
 * Canonical JSON: the one and only byte sequence for a given document, so that
 * everybody who hashes it gets the same hash.
 *
 * Rules: object keys sorted (recursively), no whitespace, and no value that
 * JSON cannot represent exactly. Money is always a string, never a number.
 */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function sortKeys(value: unknown, path: string): Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Canonical JSON only allows integers as numbers (at ${path || "root"})`);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => sortKeys(item, `${path}[${index}]`));
  if (typeof value === "object") {
    const sorted: { [key: string]: Json } = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key], `${path}.${key}`);
    }
    return sorted;
  }
  throw new Error(`Canonical JSON cannot contain ${typeof value} (at ${path || "root"})`);
}

/** Serialises `value` as canonical JSON. The order of keys in the input does not matter. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value, ""));
}

/**
 * SHA-256 of a string (as UTF-8), in lowercase hex. Uses the Web Crypto API,
 * which is the same code path in Node.js and in the browser.
 */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Canonicalises a document and hashes it. */
export async function hashDocument(value: unknown): Promise<{ json: string; hash: string }> {
  const json = canonicalize(value);
  return { json, hash: await sha256Hex(json) };
}
