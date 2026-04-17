import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (process.env.NODE_ENV === "development") {
    console.log("API: DECISION_RECORDED", id);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("transactions")
    .update({ status: "decision_made", accepted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("API: DECISION ERROR", error);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
