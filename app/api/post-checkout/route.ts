import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan");

  console.log("[post-checkout] plan:", plan);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL not set" }, { status: 500 });
  }

  const res = await fetch(`${baseUrl}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });

  const data = await res.json();

  if (!res.ok || !data.id) {
    console.error("[post-checkout] transaction create failed:", data);
    return NextResponse.redirect(baseUrl);
  }

  console.log("[post-checkout] transaction created:", data.id);

  return NextResponse.redirect(`${baseUrl}/transaction/${data.id}`);
}
