import { NextRequest, NextResponse } from "next/server";
import { validate as isUUID } from "uuid";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const REQUIRED_FIELDS = ["transaction_id", "rfc", "razon_social", "regimen_fiscal", "uso_cfdi"] as const;

function log(event: string, fields: Record<string, unknown>) {
  console.log(`[factura] ${JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields })}`);
}

function logError(event: string, fields: Record<string, unknown>) {
  console.error(`[factura] ${JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields })}`);
}

export async function POST(req: NextRequest) {
  // ── Correlation ID ────────────────────────────────────────────────────────
  const request_id = crypto.randomUUID();

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── Required field check ──────────────────────────────────────────────────
  for (const field of REQUIRED_FIELDS) {
    const val = body[field];
    if (!val || String(val).trim() === "") {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  const transaction_id = String(body.transaction_id).trim();
  const rfc            = String(body.rfc).trim();
  const razon_social   = String(body.razon_social).trim();
  const regimen_fiscal = String(body.regimen_fiscal).trim();
  const uso_cfdi       = String(body.uso_cfdi).trim();
  const address        = body.address ? String(body.address).trim() : null;

  // ── UUID validation (no regex) ────────────────────────────────────────────
  if (!isUUID(transaction_id)) {
    return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });
  }

  // ── Log: request received (after validation, before DB) ───────────────────
  log("factura.received", { request_id, transaction_id });

  // ── Fetch transaction (server-side key) ───────────────────────────────────
  let transaction: { id: string; status: string; email: string | null } | null = null;
  try {
    const txRes = await fetch(
      `${SUPABASE_URL}/rest/v1/transactions?id=eq.${encodeURIComponent(transaction_id)}&select=id,status,email&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      }
    );
    if (!txRes.ok) throw new Error("fetch failed");
    const rows: { id: string; status: string; email: string | null }[] = await txRes.json();
    transaction = rows[0] ?? null;
  } catch {
    logError("factura.error", { request_id, transaction_id, stage: "transaction_fetch" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── Transaction not found ─────────────────────────────────────────────────
  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // ── Not paid ──────────────────────────────────────────────────────────────
  if (transaction.status !== "paid") {
    return NextResponse.json({ error: "Transaction is not paid" }, { status: 403 });
  }

  const email = transaction.email ?? "";

  // ── Upsert factura_request (first write wins) ─────────────────────────────
  let alreadyExists = false;
  try {
    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/factura_requests?on_conflict=transaction_id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify({
          transaction_id,
          email,
          rfc,
          razon_social,
          regimen_fiscal,
          uso_cfdi,
          address,
          status: "pending",
        }),
      }
    );

    if (!upsertRes.ok) throw new Error("upsert failed");

    const inserted: unknown[] = await upsertRes.json();
    // Empty array = row already existed (ignored), populated = newly inserted
    alreadyExists = inserted.length === 0;
  } catch {
    logError("factura.error", { request_id, transaction_id, stage: "upsert" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── Log: outcome ──────────────────────────────────────────────────────────
  if (alreadyExists) {
    log("factura.duplicate", { request_id, transaction_id, already_exists: true });
  } else {
    log("factura.submitted", { request_id, transaction_id, already_exists: false });
  }

  return NextResponse.json({ success: true, already_exists: alreadyExists });
}
