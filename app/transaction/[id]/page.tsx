export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { isManualMode } from "@/lib/verification/mode";
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

  const supabase = createClient();

  // Run auth check and transaction fetch in parallel
  const [authResult, txResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("transactions")
      .select("id, status, email, plan, user_id, admin_verification_status, admin_verification_notes")
      .eq("id", id)
      .single(),
  ]);

  const { data, error } = txResult;
  const isAuthenticated = !!authResult.data.user;

  if (error || !data) {
    console.error("TRANSACTION FETCH FAILED", { id, error: error?.message });
    return renderError("We could not load this transaction. Please try again or contact support.");
  }

  if (data.status !== "paid") {
    console.error("TRANSACTION NOT PAID", { id, status: data.status });
    return renderError("This transaction has not been completed.");
  }

  const plan = (data.plan as "49" | "79" | null) ?? null;
  const hasOwner = !!data.user_id;
  const adminStatus = ((data as Record<string, unknown>).admin_verification_status as AdminStatus) ?? "pending";
  const adminNotes = ((data as Record<string, unknown>).admin_verification_notes as string | null) ?? null;

  // Admin panel: show in manual mode when user is logged in and result not yet submitted
  const showAdminPanel = isManualMode() && isAuthenticated && adminStatus === "pending";

  // Report: show when admin has submitted a result
  const showReport = adminStatus === "safe" || adminStatus === "caution" || adminStatus === "high_risk";

  return (
    <>
      <Header />
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
