import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type VerifyResult =
  | { verified: true }
  | { verified: false; reason: string };

/**
 * Server-side Stripe session verification.
 * Called when session_id is present in the success redirect URL.
 *
 * - Validates payment_status === "paid"
 * - Validates metadata.transaction_id matches the page's transaction
 * - Idempotently marks the transaction as "paid" in the DB
 * - Never downgrades an already-paid transaction
 */
export async function verifyStripeSession(
  sessionId: string,
  expectedTransactionId: string
): Promise<VerifyResult> {
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verifySession] retrieve failed", { sessionId, msg });
    return { verified: false, reason: `stripe_retrieve_failed` };
  }

  // Security: reject if session belongs to a different transaction
  const metaTxId = session.metadata?.transaction_id;
  if (metaTxId !== expectedTransactionId) {
    console.error("[verifySession] MISMATCH — possible tampering", {
      sessionId,
      metaTxId,
      expectedTransactionId,
    });
    return { verified: false, reason: "transaction_id_mismatch" };
  }

  if (session.payment_status !== "paid") {
    console.log("[verifySession] not yet paid", {
      sessionId,
      payment_status: session.payment_status,
    });
    return { verified: false, reason: `payment_status=${session.payment_status}` };
  }

  // Idempotent DB update — skip if already paid to avoid no-op writes
  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from("transactions")
    .update({
      status: "paid",
      stripe_session_id: sessionId,
      email: session.customer_details?.email ?? null,
      amount: session.amount_total ?? 0,
    })
    .eq("id", expectedTransactionId)
    .neq("status", "paid");

  if (error) {
    // Non-fatal — Stripe confirmed payment; DB will be settled by webhook
    console.error("[verifySession] DB update failed (non-fatal)", { error: error.message });
  } else {
    console.log("[verifySession] verified + DB updated", {
      sessionId,
      transactionId: expectedTransactionId,
    });
  }

  return { verified: true };
}
