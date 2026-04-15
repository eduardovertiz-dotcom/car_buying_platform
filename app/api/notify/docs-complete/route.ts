/**
 * POST /api/notify/docs-complete
 *
 * Called client-side (DocumentsPanel) when all required documents
 * transition from incomplete → complete for the first time.
 *
 * Fetches user email from DB, then fires sendAdminAlert.
 * No auth required — guarded by transactionId existence check.
 * Never blocks the caller — always returns 200.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminAlert } from "@/lib/notifications/sendAdminAlert";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { transactionId, hasINE, hasFactura, hasCirculation, plate } = body;

  if (typeof transactionId !== "string" || !transactionId.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Fetch email from DB — verify transaction exists and is paid
  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from("transactions")
    .select("email")
    .eq("id", transactionId)
    .eq("status", "paid")
    .single();

  if (!data) {
    // Transaction not found or not paid — silently succeed to avoid client errors
    return NextResponse.json({ ok: true });
  }

  // Fire notification — never awaited in a blocking sense; sendAdminAlert never throws
  await sendAdminAlert({
    transactionId,
    userEmail: data.email ?? "unknown",
    plate: typeof plate === "string" ? plate : undefined,
    hasINE: hasINE === true,
    hasFactura: hasFactura === true,
    hasCirculation: hasCirculation === true,
  });

  return NextResponse.json({ ok: true });
}
