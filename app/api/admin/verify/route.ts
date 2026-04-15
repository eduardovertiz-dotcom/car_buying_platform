/**
 * POST /api/admin/verify
 *
 * Admin submits a manual verification result for a transaction.
 * Updates: admin_verification_status, admin_verification_notes, admin_verified_at.
 * Sends a results email to the user via Resend.
 *
 * Auth: any authenticated user (no role system in MVP).
 * Overwrites previous result on re-submission (idempotent by design).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const ALLOWED_STATUSES = ["safe", "caution", "high_risk"] as const;
type AdminStatus = (typeof ALLOWED_STATUSES)[number];

export async function POST(req: Request) {
  // ── Auth (session client) ────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Admin allowlist guard ─────────────────────────────────────────────────
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes((user.email ?? "").toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Admin DB client (service role — bypasses RLS) ────────────────────────
  const adminDb = createAdminClient();

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { transactionId, status, notes } = body;

  // ── Input validation ─────────────────────────────────────────────────────
  if (typeof transactionId !== "string" || !transactionId.trim()) {
    return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.includes(status as AdminStatus)) {
    return NextResponse.json(
      { error: "status must be safe, caution, or high_risk" },
      { status: 400 }
    );
  }
  if (typeof notes !== "string") {
    return NextResponse.json({ error: "notes is required" }, { status: 400 });
  }

  // ── Fetch transaction (need email + created_at for processing time) ───────
  const { data: txData, error: fetchError } = await adminDb
    .from("transactions")
    .select("email, created_at")
    .eq("id", transactionId)
    .single();

  if (fetchError || !txData) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // ── Compute processing time ───────────────────────────────────────────────
  const now = new Date();
  const createdAt = txData.created_at ? new Date(txData.created_at) : null;
  const processingTimeSeconds = createdAt
    ? Math.round((now.getTime() - createdAt.getTime()) / 1000)
    : null;

  // ── Update transaction ───────────────────────────────────────────────────
  const { error: updateError } = await adminDb
    .from("transactions")
    .update({
      admin_verification_status: status,
      admin_verification_notes: notes.trim(),
      admin_verified_at: now.toISOString(),
      admin_verified_by: user.email ?? null,
      processing_time_seconds: processingTimeSeconds,
    })
    .eq("id", transactionId);

  if (updateError) {
    console.error("ADMIN VERIFY: DB update failed", transactionId);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // ── Email user with results (fire-and-forget, never blocks response) ─────
  const userEmail = txData.email;
  if (userEmail) {
    const apiKey = process.env.RESEND_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://mexguardian.com";
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@mexguardian.com";

    if (apiKey) {
      try {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: fromEmail,
          to: userEmail,
          subject: "Your Vehicle Verification is Ready",
          text: [
            "Your verification is complete.",
            "",
            "View your report:",
            `${appUrl}/transaction/${transactionId}`,
          ].join("\n"),
        });
      } catch {
        console.error("ADMIN VERIFY: user email failed", transactionId);
      }
    }
  }

  return NextResponse.json({ success: true });
}
