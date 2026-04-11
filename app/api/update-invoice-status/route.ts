import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

const ALLOWED_STATUSES = ["pending", "processing", "completed"] as const;
type Status = (typeof ALLOWED_STATUSES)[number];

export async function POST(req: NextRequest) {
  const { transaction_id, status } = await req.json();

  if (!transaction_id) {
    return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });
  }

  if (!ALLOWED_STATUSES.includes(status as Status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/invoice_requests?transaction_id=eq.${encodeURIComponent(transaction_id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("Supabase update failed:", detail);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
