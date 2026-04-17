import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (process.env.NODE_ENV === "development") {
    console.log("API: UPGRADE START", id);
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
    return NextResponse.json({ error: "Locked" }, { status: 400 });
  }

  const { error } = await supabase
    .from("transactions")
    .update({ plan: "69" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("API: UPGRADE SUCCESS", id);
  }

  return NextResponse.json({ success: true });
}
