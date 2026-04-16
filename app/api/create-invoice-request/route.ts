import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownsTransaction } from "@/lib/owns-transaction";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@mexguardian.com";

const RFC_REGEX = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
const CP_REGEX  = /^[0-9]{5}$/;

// email removed from REQUIRED — derived from auth session, not request body
const REQUIRED = [
  "transaction_id",
  "amount",
  "plan",
  "rfc",
  "razon_social",
  "regimen_fiscal",
  "uso_cfdi",
  "codigo_postal",
] as const;

export async function POST(req: NextRequest) {
  // ── Auth required ─────────────────────────────────────────────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // ── Required field check ──────────────────────────────────────────────────
  for (const field of REQUIRED) {
    const val = body[field];
    if (val === undefined || val === null || String(val).trim() === "") {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const rfc            = String(body.rfc).toUpperCase().trim();
  const codigo_postal  = String(body.codigo_postal).trim();
  const razon_social   = String(body.razon_social).trim();
  const transaction_id = String(body.transaction_id).trim();
  // Email comes from the verified session — never from the request body
  const email          = user.email ?? "";

  // ── RFC validation ────────────────────────────────────────────────────────
  if (!RFC_REGEX.test(rfc)) {
    return NextResponse.json({ error: "Invalid RFC" }, { status: 400 });
  }

  // ── Código Postal validation ──────────────────────────────────────────────
  if (!CP_REGEX.test(codigo_postal)) {
    return NextResponse.json({ error: "Invalid postal code" }, { status: 400 });
  }

  // ── Ownership check — user must own the transaction ───────────────────────
  // Uses service role to fetch the transaction so we always get a row even if
  // the user's session client can't see it yet (e.g. unbound, RLS timing).
  const adminDb = createAdminClient();
  const { data: tx } = await adminDb
    .from("transactions")
    .select("id, email, user_id")
    .eq("id", transaction_id)
    .maybeSingle();

  if (!tx || !ownsTransaction(tx, user)) {
    console.warn("[invoice-request] ownership check failed", {
      transaction_id,
      userId: user.id,
      userEmail: user.email,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Duplicate check (admin client — bypasses RLS on invoice_requests) ─────
  const { data: existing } = await adminDb
    .from("invoice_requests")
    .select("id")
    .eq("transaction_id", transaction_id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Factura already requested for this transaction" },
      { status: 409 }
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { error: insertError } = await adminDb
    .from("invoice_requests")
    .insert({
      transaction_id,
      email,
      amount:         body.amount,
      plan:           String(body.plan).trim(),
      rfc,
      razon_social,
      regimen_fiscal: String(body.regimen_fiscal).trim(),
      uso_cfdi:       String(body.uso_cfdi).trim(),
      codigo_postal,
      status:         "pending",
      created_at:     new Date().toISOString(),
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Factura already requested for this transaction" },
        { status: 409 }
      );
    }
    console.error("[invoice-request] insert failed:", insertError.message);
    return NextResponse.json(
      { error: "Failed to save invoice request" },
      { status: 500 }
    );
  }

  if (resend) {
    // ── User confirmation (non-blocking) ───────────────────────────────────
    if (email) {
      resend.emails.send({
        from:    "MexGuardian <noreply@mexguardian.com>",
        to:      email,
        subject: "Solicitud de factura recibida",
        text:    "Hola, hemos recibido tu solicitud de factura. La recibirás en 24–48 horas hábiles.",
      }).catch((err: unknown) => console.error("[user email] factura failed:", err));
    }

    // ── Admin notification (non-blocking) ──────────────────────────────────
    resend.emails.send({
      from:    "MexGuardian <noreply@mexguardian.com>",
      to:      ADMIN_EMAIL,
      subject: "Factura Request — MexGuardian",
      text: [
        "New factura request received.",
        "",
        `Email:          ${email}`,
        `RFC:            ${rfc}`,
        `Razón Social:   ${razon_social}`,
        `Transaction ID: ${transaction_id}`,
      ].join("\n"),
    }).catch((err: unknown) => console.error("[admin email] factura failed:", err));
  }

  return NextResponse.json({ success: true });
}
