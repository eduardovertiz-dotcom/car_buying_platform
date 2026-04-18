import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logError";

const API_URL = process.env.DOCUMENSO_API_URL ?? "https://app.documenso.com/api/v2";
const API_KEY = process.env.DOCUMENSO_API_KEY ?? "";

const FALLBACK = NextResponse.json({ success: false });

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return FALLBACK;
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let transaction_id: string;
  let agreement_html: string;
  try {
    const body = await req.json();
    transaction_id = body.transaction_id;
    agreement_html = body.agreement_html;
  } catch {
    await logError("documenso_upload", "invalid request body", {});
    return FALLBACK;
  }

  if (!transaction_id || !agreement_html) {
    await logError("documenso_upload", "missing transaction_id or agreement_html", { transaction_id });
    return FALLBACK;
  }

  // ── Ownership check ─────────────────────────────────────────────────────────
  const adminDb = createAdminClient();
  const { data: tx } = await adminDb
    .from("transactions")
    .select("id, user_id")
    .eq("id", transaction_id)
    .single();

  if (!tx || tx.user_id !== user.id) {
    await logError("documenso_upload", "ownership check failed", { transaction_id, userId: user.id });
    return FALLBACK;
  }

  if (!API_KEY) {
    await logError("documenso_upload", "DOCUMENSO_API_KEY not configured", { transaction_id });
    return FALLBACK;
  }

  const authHeader = { Authorization: `Bearer ${API_KEY}` };

  try {
    // ── Step 1: Upload document (multipart) ─────────────────────────────────
    const form = new FormData();
    form.append(
      "file",
      new Blob([agreement_html], { type: "text/html" }),
      "Vehicle_Purchase_Agreement.html"
    );
    form.append("title", "Vehicle Purchase Agreement");

    const uploadRes = await fetch(`${API_URL}/documents`, {
      method: "POST",
      headers: authHeader,
      body: form,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      await logError("documenso_upload", `upload failed: ${uploadRes.status}`, { transaction_id, body: text });
      return FALLBACK;
    }

    const uploadData = await uploadRes.json();
    const documentId: string | null = uploadData.documentId ?? uploadData.id ?? null;

    if (!documentId) {
      await logError("documenso_upload", "documentId missing from upload response", { transaction_id, response: uploadData });
      return FALLBACK;
    }

    // ── Step 2: Add recipient — signer email from auth session ───────────────
    const recipientsRes = await fetch(`${API_URL}/documents/${documentId}/recipients`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: [{ name: user.email, email: user.email, role: "SIGNER" }],
      }),
    });

    if (!recipientsRes.ok) {
      const text = await recipientsRes.text();
      await logError("documenso_recipient", `recipients failed: ${recipientsRes.status}`, { transaction_id, documentId, body: text });
      return FALLBACK;
    }

    const recipientsData = await recipientsRes.json();
    const recipients: Array<{ recipientId?: string; id?: string }> =
      recipientsData.recipients ?? recipientsData ?? [];
    const recipientId: string | null =
      recipients[0]?.recipientId ?? recipients[0]?.id ?? null;

    if (!recipientId) {
      await logError("documenso_recipient", "recipientId missing from recipients response", { transaction_id, documentId, response: recipientsData });
      return FALLBACK;
    }

    // ── Step 3: Send document for signing ────────────────────────────────────
    const sendRes = await fetch(`${API_URL}/documents/${documentId}/send`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail: false }),
    });

    if (!sendRes.ok) {
      const text = await sendRes.text();
      await logError("documenso_send", `send failed: ${sendRes.status}`, { transaction_id, documentId, body: text });
      return FALLBACK;
    }

    // ── Step 4: Retrieve signing URL ─────────────────────────────────────────
    const recipientRes = await fetch(
      `${API_URL}/documents/${documentId}/recipients/${recipientId}`,
      { method: "GET", headers: authHeader }
    );

    if (!recipientRes.ok) {
      const text = await recipientRes.text();
      await logError("documenso_signing_url", `recipient fetch failed: ${recipientRes.status}`, { transaction_id, documentId, recipientId, body: text });
      return FALLBACK;
    }

    const recipientData = await recipientRes.json();
    const signingUrl: string | null =
      recipientData.signingUrl ?? recipientData.signing_url ?? null;

    if (!signingUrl) {
      await logError("documenso_empty_url", "signingUrl missing from recipient response", { transaction_id, documentId, recipientId, response: recipientData });
      return FALLBACK;
    }

    return NextResponse.json({ success: true, signing_url: signingUrl });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logError("documenso_upload", `unexpected error: ${message}`, { transaction_id });
    return FALLBACK;
  }
}
