import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    let { plan } = body;

    console.log("API: CREATE_TRANSACTION START", { plan });

    if (!plan) {
      throw new Error("PLAN_MISSING");
    }

    // normalize legacy values
    const PLAN_MAP: Record<string, string> = {
      basic: "39",
      pro: "69",
    };

    plan = PLAN_MAP[plan] || plan;

    const VALID_PLANS = ["39", "69"];

    if (!VALID_PLANS.includes(plan)) {
      console.error("INVALID PLAN", plan);
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        plan,
        status: "in_progress",
      })
      .select()
      .single();

    if (error) {
      console.error("DB ERROR", error);
      return NextResponse.json(
        { error: "DB error" },
        { status: 500 }
      );
    }

    console.log("API: CREATE_TRANSACTION SUCCESS", {
      id: data.id,
      plan,
    });

    return NextResponse.json({
      id: data.id,
    });

  } catch (err) {
    console.error("API ERROR", err);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
