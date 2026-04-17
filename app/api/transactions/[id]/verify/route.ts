import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (process.env.NODE_ENV === "development") {
    console.log("API: VERIFY START", id);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tx } = await supabase
    .from("transactions")
    .select("status")
    .eq("id", id)
    .single();

  if (tx?.status === "decision_made") {
    if (process.env.NODE_ENV === "development") {
      console.log("API: VERIFY BLOCKED — decision already made", id);
    }
    return NextResponse.json({ error: "Locked" }, { status: 400 });
  }

  const { error } = await supabase
    .from("transactions")
    .update({ admin_verification_status: "pending" })
    .eq("id", id);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("API: VERIFY ERROR", error);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("API: VERIFY SUCCESS", id);
  }

  return NextResponse.json({ success: true });
}
