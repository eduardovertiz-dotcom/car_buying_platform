import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logError";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision ?? "proceed";

  const adminDb = createAdminClient();

  // Lifecycle guard — only paid transactions can have a decision recorded
  const { data: tx, error: fetchError } = await adminDb
    .from("transactions")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (tx.status !== "paid") {
    return NextResponse.json({ error: "Transaction not in paid state" }, { status: 400 });
  }

  console.log("[decision]", { id, decision });

  const { error } = await adminDb
    .from("transactions")
    .update({ status: "decision_made", decision })
    .eq("id", id);

  if (error) {
    console.error("[decision] DB error:", { id, code: error.code, message: error.message });
    await logError("decision_route", error.message, { id, decision, code: error.code });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[decision] recorded OK:", id);
  return NextResponse.json({ success: true });
}
