import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@mexguardian.com";

export async function GET(req: NextRequest) {
  // ── Auth required — session data contains customer PII ───────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const customerEmail = session.customer_details?.email ?? "—";
  const plan = session.metadata?.plan ?? "—";
  const amount = session.amount_total != null ? `$${(session.amount_total / 100).toFixed(2)}` : "—";

  // ── Admin payment notification (non-blocking) ─────────────────────────────
  if (resend) {
    resend.emails.send({
      from: "MexGuardian <noreply@mexguardian.com>",
      to: ADMIN_EMAIL,
      subject: "New Payment — MexGuardian",
      text: [
        "New payment received.",
        "",
        `Customer: ${customerEmail}`,
        `Plan:     $${plan}`,
        `Amount:   ${amount}`,
        `Session:  ${session.id}`,
      ].join("\n"),
    }).catch((err: unknown) => console.error("[admin email] payment failed:", err));
  }

  return NextResponse.json({
    id: session.id,
    customer_email: customerEmail,
    amount_total: session.amount_total,
    metadata: session.metadata,
  });
}
