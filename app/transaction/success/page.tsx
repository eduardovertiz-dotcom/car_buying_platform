import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { sendAdminAlert } from "@/lib/notifications/sendAdminAlert";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function ErrorPage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-white font-semibold text-lg mb-2">{title}</p>
        <p className="text-[var(--foreground-muted)] text-sm mb-6">{body}</p>
        <Link href="/start" className="text-sm text-[var(--accent)] hover:opacity-80 transition-opacity">
          ← Start new verification
        </Link>
      </div>
    </main>
  );
}

export default async function TransactionSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;

  // ── No session_id ─────────────────────────────────────────────────────────
  if (!sessionId) {
    return <ErrorPage title="Missing session" body="No payment session was found. This link may be invalid or expired." />;
  }

  // ── Retrieve + verify Stripe session ──────────────────────────────────────
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return <ErrorPage title="Session not found" body="Could not retrieve your payment session. Please contact support." />;
  }

  if (session.payment_status !== "paid") {
    return <ErrorPage title="Payment incomplete" body="Your payment has not been confirmed yet. If you believe this is an error, please contact support." />;
  }

  // ── Extract plan from Stripe metadata (set at checkout creation) ─────────
  const plan = session.metadata?.plan ?? null;
  if (!plan) {
    console.error("Missing plan metadata on Stripe session", session.id);
  }

  // ── Extract email with logging if absent ──────────────────────────────────
  const email = session.customer_details?.email ?? null;
  if (!email) {
    console.error("Stripe session missing email", session.id);
  }

  const amount = session.amount_total ?? 0;
  const existingTransactionId = session.metadata?.transaction_id ?? null;

  // ── UPGRADE: update plan on existing transaction ──────────────────────────
  if (existingTransactionId) {
    const update = await fetch(
      `${SUPABASE_URL}/rest/v1/transactions?id=eq.${encodeURIComponent(existingTransactionId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ plan, stripe_session_id: sessionId }),
      }
    );

    if (!update.ok) {
      console.error("Supabase upgrade PATCH failed:", await update.text());
      return <ErrorPage title="Something went wrong" body="Your payment was received but we could not upgrade your transaction. Please contact support." />;
    }

    // Notify admin of plan upgrade — documents status unknown at this point
    await sendAdminAlert({
      transactionId: existingTransactionId,
      userEmail: email ?? "unknown",
      hasINE: false,
      hasFactura: false,
      hasCirculation: false,
    });

    // Return to the existing transaction step flow
    redirect(`/transaction/${existingTransactionId}`);
  }

  // ── NEW TRANSACTION: upsert — safe under concurrent/duplicate requests ────
  const upsert = await fetch(
    `${SUPABASE_URL}/rest/v1/transactions?on_conflict=stripe_session_id`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        stripe_session_id: sessionId,
        email,
        amount,
        plan,
        status: "paid",
      }),
    }
  );

  if (!upsert.ok) {
    console.error("Supabase upsert failed:", await upsert.text());
    return <ErrorPage title="Something went wrong" body="Your payment was received but we could not initialize your transaction. Please contact support." />;
  }

  const rows: { id: string }[] = await upsert.json();
  const transactionId: string | null = rows[0]?.id ?? null;

  if (!transactionId) {
    return <ErrorPage title="Something went wrong" body="Could not retrieve your transaction ID. Please contact support." />;
  }

  // Notify admin of new paid transaction — documents not yet uploaded at this stage
  await sendAdminAlert({
    transactionId,
    userEmail: email ?? "unknown",
    hasINE: false,
    hasFactura: false,
    hasCirculation: false,
  });

  // ── Redirect to transactions hub with new= param ─────────────────────────
  redirect(`/transactions?new=${transactionId}`);
}
