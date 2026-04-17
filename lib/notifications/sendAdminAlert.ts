/**
 * sendAdminAlert — fire-and-forget admin notification.
 *
 * Called in two places:
 *   1. After successful payment    (app/transaction/success/page.tsx)
 *   2. After all documents uploaded (app/api/notify/docs-complete/route.ts)
 *
 * Required env:
 *   RESEND_API_KEY
 *   ADMIN_EMAIL
 *
 * Optional env:
 *   RESEND_FROM_EMAIL   (default: noreply@mexguardian.com)
 *   SLACK_WEBHOOK_URL
 *   NEXT_PUBLIC_BASE_URL
 *
 * Never throws — all failures are logged and swallowed.
 */

import { Resend } from "resend";

type AlertInput = {
  transactionId: string;
  userEmail: string;
  plate?: string;
  hasINE: boolean;
  hasFactura: boolean;
  hasCirculation: boolean;
};

export async function sendAdminAlert(input: AlertInput): Promise<void> {
  const { transactionId, userEmail, plate, hasINE, hasFactura, hasCirculation } = input;

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_BASE_URL is not set");
  }
  const txUrl = `${appUrl}/transaction/${transactionId}`;
  const adminEmail = process.env.ADMIN_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@mexguardian.com";

  if (!adminEmail) {
    console.error("NOTIFY: ADMIN_EMAIL not set — skipping admin alert");
    return;
  }

  const emailText = [
    "A new verification request is ready.",
    "",
    `Transaction: ${transactionId}`,
    `User: ${userEmail}`,
    `Plate: ${plate ?? "not provided"}`,
    "",
    "Documents:",
    `  • INE: ${hasINE ? "yes" : "no"}`,
    `  • Factura: ${hasFactura ? "yes" : "no"}`,
    `  • Circulation: ${hasCirculation ? "yes" : "no"}`,
    "",
    `Open: ${txUrl}`,
  ].join("\n");

  // ── Email via Resend ────────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("NOTIFY: RESEND_API_KEY not set — skipping email");
  } else {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: "New Verification Request — Action Required",
        text: emailText,
      });
    } catch {
      console.error("NOTIFY: Resend email failed for transaction", transactionId);
    }
  }

  // ── Slack webhook (optional) ────────────────────────────────────────────
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 New verification request\nTransaction: ${transactionId}\nUser: ${userEmail}\nOpen: ${txUrl}`,
        }),
      });
    } catch {
      console.error("NOTIFY: Slack webhook failed for transaction", transactionId);
    }
  }
}
