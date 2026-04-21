import { NextResponse } from "next/server";
import { countryToCurrency, toStripeCurrency } from "@/lib/currency";

export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country");
  const currency = toStripeCurrency(countryToCurrency(country));
  return NextResponse.json({ currency });
}
