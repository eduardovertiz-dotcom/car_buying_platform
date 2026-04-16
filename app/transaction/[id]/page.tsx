export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isManualMode } from "@/lib/verification/mode";
import { ownsTransaction } from "@/lib/owns-transaction";
import AIInterface from "@/components/AIInterface";
import BindBanner from "@/components/BindBanner";
import Header from "@/components/Header";
import AdminVerifyPanel from "@/components/AdminVerifyPanel";
import VerificationReport from "@/components/VerificationReport";
import DocumentsPanel from "@/components/panels/DocumentsPanel";
import VerificationPanel from "@/components/panels/VerificationPanel";
import ActivityPanel from "@/components/panels/ActivityPanel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminStatus = "pending" | "safe" | "caution" | "high_risk";

function renderError(message: string) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <p className="text-white font-semibold">Unable to load transaction</p>
        <p className="text-sm text-[var(--foreground-muted)]">{message}</p>
      </div>
    </main>
  );
}

export default async function TransactionPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  if (!UUID_RE.test(id)) {
    return renderError("This transaction link is invalid.");
  }

  // Auth check via session client; data fetch via admin client (works without session)
  const supabase = createClient();
  const adminDb = createAdminClient();

  const [authResult, txResult] = await Promise.all([
    supabase.auth.getUser(),
    adminDb
      .from("transactions")
      .select("id, status, email, plan, user_id, admin_verification_status, admin_verification_notes")
      .eq("id", id)
      .maybeSingle(),                 // maybeSingle: no error when row absent (vs .single() throws)
  ]);

  const { data, error } = txResult;
  const sessionUser = authResult.data.user;
  const isAuthenticated = !!sessionUser;

  // ── Diagnostic logging — remove after root cause confirmed ───────────────
  console.log("[TX_LOAD] id:", id);
  console.log("[TX_LOAD] auth:", {
    isAuthenticated,
    userId: sessionUser?.id ?? null,
    userEmail: sessionUser?.email ?? null,
  });
  console.log("[TX_LOAD] query result:", {
    hasData: !!data,
    dataId: data?.id ?? null,
    dataEmail: data?.email ?? null,
    dataUserId: data?.user_id ?? null,
    dataStatus: data?.status ?? null,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    errorDetails: error?.details ?? null,
  });
  // ─────────────────────────────────────────────────────────────────────────

  // ── Query error — show actual Postgres error, not generic message ─────────
  if (error) {
    console.error("[TX_LOAD] QUERY ERROR", { id, code: error.code, message: error.message });
    return renderError(`Query failed: ${error.message} (code: ${error.code})`);
  }

  // ── Row not found ─────────────────────────────────────────────────────────
  if (!data) {
    console.error("[TX_LOAD] NOT FOUND", { id });
    return renderError("Transaction not found. The link may be invalid or the transaction may not exist yet.");
  }

  if (data.status !== "paid") {
    console.error("[TX_LOAD] NOT PAID", { id, status: data.status });
    return renderError("This transaction has not been completed.");
  }

  // Require authentication — unauthenticated users are sent to login with return URL
  if (!isAuthenticated) {
    redirect(`/login?redirect=/transaction/${id}`);
  }

  // Resolve admin status — fail-secure: if ADMIN_EMAILS is not set, no one is an admin
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin =
    ADMIN_EMAILS.length > 0 &&
    ADMIN_EMAILS.includes((sessionUser?.email ?? "").toLowerCase());

  // Ownership check — authenticated non-admins must own this transaction.
  // Admins bypass so they can review transactions from the queue.
  if (isAuthenticated && !isAdmin) {
    const owned = ownsTransaction(data, sessionUser!);

    console.log("[TX_LOAD] ownership check:", {
      owned,
      dataUserId:    data.user_id,
      sessionUserId: sessionUser!.id,
      txEmail:       (data.email ?? "").toLowerCase().trim(),
      authEmail:     (sessionUser!.email ?? "").toLowerCase().trim(),
    });

    if (!owned) {
      const txEmail   = (data.email   ?? "").toLowerCase().trim();
      const authEmail = (sessionUser!.email ?? "").toLowerCase().trim();
      console.warn("[TX_LOAD] ACCESS DENIED", { id, txEmail, authEmail });
      return renderError(
        `Access denied. Transaction email (${txEmail || "none"}) does not match your account email (${authEmail}). Sign in with the email address used at checkout.`
      );
    }
  }

  const plan = (data.plan as "49" | "79" | null) ?? null;
  const hasOwner = !!data.user_id;
  const adminStatus = ((data as Record<string, unknown>).admin_verification_status as AdminStatus) ?? "pending";
  const adminNotes = ((data as Record<string, unknown>).admin_verification_notes as string | null) ?? null;

  // Admin panel: show in manual mode only to admins when result not yet submitted
  const showAdminPanel = isManualMode() && isAdmin && adminStatus === "pending";

  // Report: show when admin has submitted a result
  const showReport = adminStatus === "safe" || adminStatus === "caution" || adminStatus === "high_risk";

  return (
    <>
      <Header plan={plan} />
      <main className="px-6 pb-16">
        <div className="max-w-[680px] mx-auto">
          <BindBanner transactionId={id} hasOwner={hasOwner} />
          <AIInterface plan={plan} />
          <DocumentsPanel />
          <VerificationPanel />
          {showReport && (
            <VerificationReport
              status={adminStatus as "safe" | "caution" | "high_risk"}
              notes={adminNotes}
            />
          )}
          {showAdminPanel && <AdminVerifyPanel transactionId={id} />}
          <ActivityPanel />
        </div>
      </main>
    </>
  );
}
