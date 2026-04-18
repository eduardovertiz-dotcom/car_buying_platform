import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision ?? "proceed";

  console.log("[decision]", { id, decision });

  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from("transactions")
    .update({ status: "decision_made", decision })
    .eq("id", id);

  if (error) {
    console.error("[decision] DB error:", { id, code: error.code, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[decision] recorded OK:", id);
  return NextResponse.json({ success: true });
}
