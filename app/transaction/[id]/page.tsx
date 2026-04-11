export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import AIInterface from "@/components/AIInterface";
import BindBanner from "@/components/BindBanner";
import Header from "@/components/Header";
import DocumentsPanel from "@/components/panels/DocumentsPanel";
import VerificationPanel from "@/components/panels/VerificationPanel";
import ActivityPanel from "@/components/panels/ActivityPanel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const { data, error } = await supabase
    .from("transactions")
    .select("id, status, email, plan, user_id")
    .eq("id", id)
    .single();

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

  return (
    <>
      <Header />
      <main className="px-6 pb-16">
        <div className="max-w-[680px] mx-auto">
          <BindBanner transactionId={id} hasOwner={hasOwner} />
          <AIInterface plan={plan} />
          <DocumentsPanel />
          <VerificationPanel />
          <ActivityPanel />
        </div>
      </main>
    </>
  );
}
