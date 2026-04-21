/**
 * POST /api/webhooks/stripe
 *
 * Reliability backstop + async-payment settlement for Stripe Checkout.
 *
 * Event handling:
 *   checkout.session.completed
 *     - payment_status === "paid"  → mark paid (card flow)
 *     - otherwise                  → mark pending (OXXO voucher / SPEI instructions issued)
 *   checkout.session.async_payment_succeeded → mark paid
 *   checkout.session.async_payment_failed    → mark failed
 *
 * Two transaction modes in any of the above:
 *   UPGRADE  — metadata.transaction_id present → UPDATE existing row
 *   NEW      — no transaction_id → idempotent upsert on stripe_session_id
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logError";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type SettlementOutcome = "paid" | "pending" | "failed";

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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const outcome: SettlementOutcome =
          session.payment_status === "paid" ? "paid" : "pending";
        await applyOutcome(session, outcome);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await applyOutcome(session, "paid");
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await applyOutcome(session, "failed");
        break;
      }
      default:
        // Ignore unrelated event types.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook] handler error:", message);
    await logError("webhook_handler", message, { event_type: event.type, event_id: event.id });
    return NextResponse.json({ error: "Handler failure" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Apply a settlement outcome to the transactions table.
 * Idempotent with respect to (stripe_session_id, transaction_id).
 */
async function applyOutcome(
  session: Stripe.Checkout.Session,
  outcome: SettlementOutcome
) {
  const stripe_session_id = session.id;
  const email             = session.customer_details?.email ?? null;
  const amount            = session.amount_total ?? 0;
  const plan              = session.metadata?.plan ?? null;
  const transaction_id    = session.metadata?.transaction_id ?? null;
  const isUpgrade         = !!transaction_id;

  console.log("[webhook] apply", {
    session_id: stripe_session_id,
    outcome,
    plan,
    transaction_id,
    isUpgrade,
    payment_status: session.payment_status,
  });

  if (!plan) {
    console.error("[webhook] missing plan metadata:", stripe_session_id);
  }

  const adminDb = createAdminClient();

  if (isUpgrade) {
    // ── UPGRADE ──────────────────────────────────────────────────────────
    // Only promote plan when the async payment has actually settled.
    // Never downgrade the row's status — the prior purchase is already "paid".
    if (outcome === "paid") {
      const { data: existing } = await adminDb
        .from("transactions")
        .select("plan")
        .eq("id", transaction_id)
        .single();

      if (existing?.plan === "69") {
        console.log("[webhook] already upgraded, skipping:", transaction_id);
        return;
      }

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
        await logError("webhook_upgrade", error.message, {
          transaction_id,
          stripe_session_id,
          code: error.code,
        });
        throw new Error(`DB update failed: ${error.message}`);
      }

      console.log("[webhook] transaction upgraded OK:", transaction_id);
      return;
    }

    // outcome === "pending" or "failed" — do not mutate the existing row's
    // plan or status. Log only.
    console.log("[webhook] upgrade non-terminal:", { transaction_id, outcome });
    return;
  }

  // ── NEW PURCHASE ───────────────────────────────────────────────────────
  // Upsert the row with the latest outcome. For OXXO/SPEI this first runs
  // with outcome="pending" (voucher issued) and later with "paid" or "failed"
  // when the async event settles.
  if (!email) {
    console.error("[webhook] missing customer email:", stripe_session_id);
  }

  const upsertPayload: Record<string, unknown> = {
    stripe_session_id,
    email,
    amount,
    plan,
    status: outcome,
  };

  const { error } = await adminDb
    .from("transactions")
    .upsert(upsertPayload, { onConflict: "stripe_session_id" });

  if (error) {
    console.error("[webhook] upsert failed:", {
      stripe_session_id,
      code: error.code,
      message: error.message,
    });
    await logError("webhook_new_purchase", error.message, {
      stripe_session_id,
      plan,
      code: error.code,
    });
    throw new Error(`DB upsert failed: ${error.message}`);
  }

  console.log("[webhook] transaction upserted OK:", {
    stripe_session_id,
    outcome,
  });
}
