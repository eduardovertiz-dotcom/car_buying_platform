/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe events and ensures transactions are created in the DB
 * even if the user never completes the redirect back to the success page.
 *
 * This is the reliability backstop — the success page upsert remains
 * in place and is idempotent (onConflict: stripe_session_id).
 * Whichever fires first wins; the second is a no-op.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  console.log("WEBHOOK RECEIVED");

  // ── Signature verification ────────────────────────────────────────────────
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("[webhook] missing stripe-signature header");
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Raw body is required for signature verification — do NOT use req.json()
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook] signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  // ── Handle checkout.session.completed ────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    console.log("CHECKOUT COMPLETED");
    const session = event.data.object as Stripe.Checkout.Session;

    const stripe_session_id = session.id;
    const email             = session.customer_details?.email ?? null;
    const amount            = session.amount_total ?? 0;
    const plan              = session.metadata?.plan ?? null;

    console.log("[webhook] checkout.session.completed", {
      stripe_session_id,
      plan,
      email,
      amount,
    });

    if (!plan) {
      console.error("[webhook] missing plan metadata on session:", stripe_session_id);
    }
    if (!email) {
      console.error("[webhook] missing customer email on session:", stripe_session_id);
    }

    const adminDb = createAdminClient();

    // Upsert is idempotent — if the success page already ran, this is a no-op.
    // If the user closed their browser before the redirect, this creates the row.
    const { error } = await adminDb
      .from("transactions")
      .upsert(
        { stripe_session_id, email, amount, plan, status: "paid" },
        { onConflict: "stripe_session_id" }
      );

    if (error) {
      console.error("[webhook] upsert failed:", {
        stripe_session_id,
        code: error.code,
        message: error.message,
      });
      // Return 500 so Stripe retries the webhook
      return NextResponse.json({ error: "DB upsert failed" }, { status: 500 });
    }

    console.log("[webhook] transaction upserted OK:", stripe_session_id);
  }

  // Acknowledge all other event types so Stripe doesn't retry them
  return NextResponse.json({ received: true });
}
