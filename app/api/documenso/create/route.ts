import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.DOCUMENSO_BASE_URL ?? "https://api.documenso.com";
const API_KEY  = process.env.DOCUMENSO_API_KEY  ?? "";

type CreateBody = {
  buyer_name:    string;
  buyer_email:   string;
  seller_name:   string;
  seller_email:  string;
  agreement_html: string;
};

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Documenso not configured" }, { status: 500 });
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { buyer_name, buyer_email, seller_name, seller_email, agreement_html } = body;

  if (!buyer_email || !seller_email || !agreement_html) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    // ── Step 1: Upload document ──────────────────────────────────────────────
    // Documenso accepts base64-encoded file content via JSON (v1 API)
    const fileBase64 = Buffer.from(agreement_html, "utf-8").toString("base64");

    const uploadRes = await fetch(`${BASE_URL}/api/v1/documents`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Vehicle Purchase Agreement",
        documentDataId: null,
        formValues: {},
      }),
    });

    // Documenso's document upload uses multipart — fall back to multipart if JSON rejected
    if (!uploadRes.ok && uploadRes.status === 415) {
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

      if (!mpRes.ok) {
        const text = await mpRes.text();
        console.error("[documenso] upload failed:", text);
        return NextResponse.json({ error: "Documenso upload failed" }, { status: 500 });
      }

      const { id: document_id } = await mpRes.json();
      return await addRecipientsAndSend(document_id, { buyer_name, buyer_email, seller_name, seller_email, fileBase64, headers, BASE_URL });
    }

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.error("[documenso] create failed:", text);
      return NextResponse.json({ error: "Documenso create failed" }, { status: 500 });
    }

    const { id: document_id } = await uploadRes.json();
    return await addRecipientsAndSend(document_id, { buyer_name, buyer_email, seller_name, seller_email, fileBase64, headers, BASE_URL });

  } catch (err) {
    console.error("[documenso] unexpected error:", err);
    return NextResponse.json({ error: "Documenso integration error" }, { status: 500 });
  }
}

type SigningData = {
  buyer_name: string;
  buyer_email: string;
  seller_name: string;
  seller_email: string;
  fileBase64: string;
  headers: Record<string, string>;
  BASE_URL: string;
};

async function addRecipientsAndSend(
  document_id: string,
  { buyer_name, buyer_email, seller_name, seller_email, headers, BASE_URL }: SigningData
): Promise<NextResponse> {
  // ── Step 2: Add recipients ─────────────────────────────────────────────────
  const recipientsRes = await fetch(
    `${BASE_URL}/api/v1/documents/${document_id}/recipients`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        recipients: [
          { name: buyer_name,  email: buyer_email,  role: "SIGNER" },
          { name: seller_name, email: seller_email, role: "SIGNER" },
        ],
      }),
    }
  );

  if (!recipientsRes.ok) {
    const text = await recipientsRes.text();
    console.error("[documenso] recipients failed:", text);
    // Non-fatal — document was created; return id so UI doesn't block
    return NextResponse.json({ document_id, warning: "Recipients could not be added" });
  }

  // ── Step 3: Send for signing ───────────────────────────────────────────────
  const sendRes = await fetch(
    `${BASE_URL}/api/v1/documents/${document_id}/send`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ sendEmail: true }),
    }
  );

  if (!sendRes.ok) {
    const text = await sendRes.text();
    console.error("[documenso] send failed:", text);
    return NextResponse.json({ document_id, warning: "Document could not be sent" });
  }

  return NextResponse.json({ document_id });
}
