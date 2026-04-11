import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRepuve } from "@/lib/verification/providers/verifik";
import { validateFactura } from "@/lib/verification/providers/validacfdi";
import type { ProviderResult, FacturaResult, VerifyInput } from "@/lib/verification/types";

const FACTURA_NOT_PROVIDED: ProviderResult<FacturaResult> = {
  ok: false,
  error: "invalid_response",
  source: "validacfdi",
};

export async function POST(req: Request) {
  // Require authenticated session
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate input
  let body: Partial<VerifyInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plate = body.plate?.trim().toUpperCase();
  if (!plate) {
    return NextResponse.json({ error: "plate is required" }, { status: 400 });
  }

  // Run Verifik + ValidaCFDI in parallel
  const [repuve, factura] = await Promise.all([
    checkRepuve(plate),
    body.factura ? validateFactura(body.factura) : Promise.resolve(FACTURA_NOT_PROVIDED),
  ]);

  return NextResponse.json({
    success: true,
    checks: {
      repuve,
      factura,
    },
  });
}
