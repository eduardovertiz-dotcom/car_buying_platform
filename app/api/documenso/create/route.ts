import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.DOCUMENSO_BASE_URL ?? "https://api.documenso.com";
const API_KEY  = process.env.DOCUMENSO_API_KEY  ?? "";

const FALLBACK = NextResponse.json({ success: false, fallback: true });

type CreateBody = {
  buyer_name:     string;
  buyer_email:    string;
  seller_name:    string;
  seller_email:   string;
  agreement_html: string;
};

export async function POST(req: NextRequest) {
  // Parse body — fall back on any parse error
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    console.error("[documenso] invalid request body");
    return FALLBACK;
  }

  const { buyer_name, buyer_email, seller_name, seller_email, agreement_html } = body;

  if (!buyer_email || !seller_email || !agreement_html) {
    console.error("[documenso] missing required fields");
    return FALLBACK;
  }

  // No API key configured — surface fallback immediately, no network call
  if (!API_KEY) {
    console.error("[documenso] DOCUMENSO_API_KEY not set");
    return FALLBACK;
  }

  try {
    const authHeaders = {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };

    // ── Step 1: Upload document ────────────────────────────────────────────
    // Try JSON first; if rejected as unsupported media, retry as multipart.
    let document_id: string | null = null;

    const jsonUploadRes = await fetch(`${BASE_URL}/api/v1/documents`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ title: "Vehicle Purchase Agreement" }),
    });

    if (jsonUploadRes.ok) {
      const json = await jsonUploadRes.json();
      document_id = json.id ?? null;
    } else if (jsonUploadRes.status === 415) {
      // Multipart fallback
      const form = new FormData();
      form.append(
        "file",
        new Blob([Buffer.from(agreement_html, "utf-8")], { type: "text/html" }),
        "purchase_agreement.html"
      );
      form.append("title", "Vehicle Purchase Agreement");

      const mpRes = await fetch(`${BASE_URL}/api/v1/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` },
        body: form,
      });

      if (mpRes.ok) {
        const json = await mpRes.json();
        document_id = json.id ?? null;
      } else {
        console.error("[documenso] multipart upload failed:", await mpRes.text());
        return FALLBACK;
      }
    } else {
      console.error("[documenso] upload failed:", jsonUploadRes.status, await jsonUploadRes.text());
      return FALLBACK;
    }

    if (!document_id) {
      console.error("[documenso] upload succeeded but no document id returned");
      return FALLBACK;
    }

    // ── Step 2: Add recipients ─────────────────────────────────────────────
    const recipientsRes = await fetch(
      `${BASE_URL}/api/v1/documents/${document_id}/recipients`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          recipients: [
            { name: buyer_name,  email: buyer_email,  role: "SIGNER" },
            { name: seller_name, email: seller_email, role: "SIGNER" },
          ],
        }),
      }
    );

    if (!recipientsRes.ok) {
      // Document created but recipients failed — still return success with the id
      // so the UI can show "pending" and we don't lose the document reference.
      console.error("[documenso] recipients failed:", await recipientsRes.text());
      return NextResponse.json({ success: true, document_id });
    }

    // ── Step 3: Send for signing ───────────────────────────────────────────
    const sendRes = await fetch(
      `${BASE_URL}/api/v1/documents/${document_id}/send`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ sendEmail: true }),
      }
    );

    if (!sendRes.ok) {
      console.error("[documenso] send failed:", await sendRes.text());
      // Document and recipients exist — return success so UI reflects pending state
      return NextResponse.json({ success: true, document_id });
    }

    return NextResponse.json({ success: true, document_id });

  } catch (err) {
    // Network error, timeout, or unexpected exception — always fall back
    console.error("[documenso] unexpected error:", err);
    return FALLBACK;
  }
}
