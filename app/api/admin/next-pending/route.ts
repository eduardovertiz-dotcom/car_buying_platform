/**
 * GET /api/admin/next-pending?exclude={id}
 *
 * Returns the next pending transaction for the operator flow.
 * Auth required. Returns { id } or { id: null } — never 404.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminDb = createAdminClient();
  const { searchParams } = new URL(req.url);
  const exclude = searchParams.get("exclude") ?? "";

  let query = adminDb
    .from("transactions")
    .select("id")
    .eq("status", "paid")
    .eq("admin_verification_status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (exclude) query = query.neq("id", exclude);

  const { data, error } = await query;

  if (error) {
    console.error("NEXT PENDING: query failed");
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data?.[0]?.id ?? null });
}
