/**
 * Currency resolution — single source of truth for both server and client.
 *
 * Supported currencies are locked to USD / CAD / MXN because those are the
 * only Stripe Prices we have pre-created. Any other input falls back to USD.
 */

export type Currency = "USD" | "CAD" | "MXN";

export const SUPPORTED_CURRENCIES: Currency[] = ["USD", "CAD", "MXN"];

/** Map an ISO-3166-1 alpha-2 country code to a supported currency. */
export function countryToCurrency(country: string | null | undefined): Currency {
  const c = (country ?? "").trim().toUpperCase();
  if (c === "MX") return "MXN";
  if (c === "CA") return "CAD";
  return "USD";
}

/**
 * Deterministic resolver used server-side at checkout.
 *
 * Priority:
 *   1. Explicit user selection (body.currency) — must be one of the supported set.
 *   2. Geo header (x-vercel-ip-country) mapped to MXN / CAD.
 *   3. USD fallback.
 */
export function resolveCurrency(
  explicit: string | null | undefined,
  countryHeader: string | null | undefined
): Currency {
  if (explicit) {
    const up = explicit.trim().toUpperCase();
    if ((SUPPORTED_CURRENCIES as string[]).includes(up)) return up as Currency;
  }
  return countryToCurrency(countryHeader);
}

/** Normalises to the Stripe lower-case ISO code. */
export function toStripeCurrency(c: Currency): "usd" | "cad" | "mxn" {
  return c.toLowerCase() as "usd" | "cad" | "mxn";
}
