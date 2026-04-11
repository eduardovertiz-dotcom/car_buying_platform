export const dynamic = "force-dynamic";

import AIInterface from "@/components/AIInterface";
import BindBanner from "@/components/BindBanner";
import Header from "@/components/Header";
import DocumentsPanel from "@/components/panels/DocumentsPanel";
import VerificationPanel from "@/components/panels/VerificationPanel";
import ActivityPanel from "@/components/panels/ActivityPanel";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  status: string;
  email: string | null;
  plan: string | null;
  user_id: string | null;
};

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

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/transactions?id=eq.${encodeURIComponent(id)}&select=id,status,email,plan,user_id&limit=1`,
    { headers, cache: "no-store" }
  );

  if (!res.ok) {
    console.error("TRANSACTION FETCH FAILED", { id, status: res.status });
    return renderError("We could not load this transaction. Please try again or contact support.");
  }

  const rows: Row[] = await res.json();

  if (rows.length === 0) {
    console.error("TRANSACTION NOT FOUND", { id });
    return renderError("This transaction does not exist.");
  }

  if (rows[0].status !== "paid") {
    console.error("TRANSACTION NOT PAID", { id, status: rows[0].status });
    return renderError("This transaction has not been completed.");
  }

  const plan = (rows[0].plan as "49" | "79" | null) ?? null;
  const hasOwner = !!rows[0].user_id;

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
