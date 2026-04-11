import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRepuve } from "@/lib/verification/providers/verifik";
import type { VerifyInput } from "@/lib/verification/types";

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

  // Call Verifik
  const repuve = await checkRepuve(plate);

  return NextResponse.json({
    success: repuve.ok,
    checks: {
      repuve,
    },
  });
}
