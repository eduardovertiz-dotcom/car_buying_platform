import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logError";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const adminDb = createAdminClient();

  const { data: tx, error: fetchError } = await adminDb
    .from("transactions")
    .select("status, plan")
    .eq("id", id)
    .single();

  if (fetchError || !tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (tx.status !== "paid") {
    return NextResponse.json({ error: "Transaction not in paid state" }, { status: 400 });
  }

  if (tx.status === "decision_made") {
    return NextResponse.json({ error: "Locked" }, { status: 400 });
  }

  const { error } = await adminDb
    .from("transactions")
    .update({ admin_verification_status: "pending" })
    .eq("id", id);

  if (error) {
    await logError("verify_route", error.message, { id, code: error.code });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
