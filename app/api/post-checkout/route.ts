import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_BASE_URL is not set");
  }

  if (!sessionId) {
    console.error("[post-checkout] missing session_id");
    return NextResponse.redirect(baseUrl);
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("[post-checkout] failed to retrieve session:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(baseUrl);
  }

  const plan           = session.metadata?.plan ?? null;
  const transactionId  = session.metadata?.transaction_id ?? null;
  const email          = session.customer_details?.email ?? null;
  const amount         = session.amount_total ?? 0;
  const isUpgrade      = !!transactionId;

  console.log("[post-checkout]", { transaction_id: transactionId, isUpgrade, plan, email, amount });

  if (!plan) {
    console.error("[post-checkout] no plan in session metadata:", sessionId);
    return NextResponse.redirect(baseUrl);
  }

  const adminDb = createAdminClient();

  // Best-effort: attach user_id if session is still active
  const { data: { user } } = await createClient().auth.getUser();

  if (isUpgrade) {
    // ── UPGRADE: mutate the existing transaction, never create a new one ─────
    const updatePayload: Record<string, unknown> = { plan: "69", status: "paid" };
    if (user?.id) updatePayload.user_id = user.id;

    const { error } = await adminDb
      .from("transactions")
      .update(updatePayload)
      .eq("id", transactionId);

    if (error) {
      console.error("[post-checkout] upgrade update failed:", error.message);
      return NextResponse.redirect(baseUrl);
    }

    console.log("[post-checkout] transaction upgraded:", transactionId);
    return NextResponse.redirect(`${baseUrl}/transaction/${transactionId}`);
  }

  // ── NEW PURCHASE: idempotent upsert on stripe_session_id ─────────────────
  const upsertPayload: Record<string, unknown> = {
    stripe_session_id: sessionId,
    email,
    amount,
    plan,
    status: "paid",
  };
  if (user?.id) upsertPayload.user_id = user.id;

  const { data, error } = await adminDb
    .from("transactions")
    .upsert(upsertPayload, { onConflict: "stripe_session_id" })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[post-checkout] upsert failed:", error?.message);
    return NextResponse.redirect(baseUrl);
  }

  console.log("[post-checkout] transaction upserted:", data.id);
  return NextResponse.redirect(`${baseUrl}/transaction/${data.id}`);
}
