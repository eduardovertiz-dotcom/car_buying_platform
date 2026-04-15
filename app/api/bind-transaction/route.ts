import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { transactionId } = await req.json();

  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Ownership pre-check (RLS enforced) ────────────────────────────────────
  // The SELECT policy requires LOWER(email) match for unbound transactions.
  // If this returns no row, the caller doesn't own it — reject before UPDATE.
  // This prevents any authenticated user from binding a stranger's transaction.
  const { data: owned } = await supabase
    .from("transactions")
    .select("id")
    .eq("id", transactionId)
    .is("user_id", null)
    .single();

  if (!owned) {
    console.warn("BIND REJECTED — email mismatch or already bound", {
      transactionId,
      userId: user.id,
    });
    return NextResponse.json(
      { error: "Transaction not found or already bound" },
      { status: 403 }
    );
  }

  // ── Bind: set user_id (RLS UPDATE policy enforces user_id IS NULL) ────────
  const { data, error } = await supabase
    .from("transactions")
    .update({ user_id: user.id })
    .eq("id", transactionId)
    .is("user_id", null)
    .select();

  if (error) {
    console.error("BIND TRANSACTION FAILED", { transactionId, userId: user.id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
