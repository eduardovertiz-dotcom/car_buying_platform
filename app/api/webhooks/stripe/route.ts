/**
 * POST /api/webhooks/stripe
 *
 * Reliability backstop — ensures transactions exist in the DB even if the
 * user never completes the browser redirect back to the success page.
 *
 * Two modes:
 *   UPGRADE  — metadata.transaction_id present → UPDATE existing row to plan 69
 *   NEW      — no transaction_id → idempotent upsert on stripe_session_id
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

  // Raw body required for signature verification
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
    const session = event.data.object as Stripe.Checkout.Session;

    const stripe_session_id = session.id;
    const email             = session.customer_details?.email ?? null;
    const amount            = session.amount_total ?? 0;
    const plan              = session.metadata?.plan ?? null;
    const transaction_id    = session.metadata?.transaction_id ?? null;
    const isUpgrade         = !!transaction_id;

    console.log("[webhook]", { session_id: stripe_session_id, plan, transaction_id, isUpgrade });

    if (!plan) {
      console.error("[webhook] missing plan metadata:", stripe_session_id);
    }

    const adminDb = createAdminClient();

    if (isUpgrade) {
      // ── UPGRADE: update existing transaction, never create a new row ───────
      const { error } = await adminDb
        .from("transactions")
        .update({ plan: "69", status: "paid" })
        .eq("id", transaction_id);

      if (error) {
        console.error("[webhook] upgrade update failed:", {
          transaction_id,
          code: error.code,
          message: error.message,
        });
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      console.log("[webhook] transaction upgraded OK:", transaction_id);
    } else {
      // ── NEW PURCHASE: idempotent upsert on stripe_session_id ──────────────
      if (!email) {
        console.error("[webhook] missing customer email:", stripe_session_id);
      }

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
        return NextResponse.json({ error: "DB upsert failed" }, { status: 500 });
      }

      console.log("[webhook] transaction upserted OK:", stripe_session_id);
    }
  }

  return NextResponse.json({ received: true });
}
