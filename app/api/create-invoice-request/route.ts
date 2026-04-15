import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

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

  // ── Duplicate check ───────────────────────────────────────────────────────
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invoice_requests?transaction_id=eq.${encodeURIComponent(transaction_id)}&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Factura already requested for this transaction" },
        { status: 409 }
      );
    }
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const row = {
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
  };

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/invoice_requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!insertRes.ok) {
    const detail = await insertRes.text();
    if (detail.includes("unique") || detail.includes("23505")) {
      return NextResponse.json(
        { error: "Factura already requested for this transaction" },
        { status: 409 }
      );
    }
    console.error("Supabase insert failed:", detail);
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
