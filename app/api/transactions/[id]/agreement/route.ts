import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from("transactions")
    .update({ agreement_generated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[agreement] DB error:", { id, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
