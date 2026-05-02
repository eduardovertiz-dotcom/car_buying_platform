import { NextResponse } from "next/server";
import { countryToCurrency } from "@/lib/currency";

/**
 * GET /api/geo-currency
 *
 * Returns the visitor's detected country and the corresponding supported
 * currency based on the Vercel geo header. Safe to call client-side on mount.
 *
 * Response shape:
 *   { country: string | null, currency: "USD" | "CAD" | "MXN" }
 */
export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country") ?? null;
  const currency = countryToCurrency(country);
  return NextResponse.json({ country, currency });
}
