import { redirect } from "next/navigation";
import AIInterface from "@/components/AIInterface";
import Header from "@/components/Header";
import DocumentsPanel from "@/components/panels/DocumentsPanel";
import VerificationPanel from "@/components/panels/VerificationPanel";
import ActivityPanel from "@/components/panels/ActivityPanel";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TransactionPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  // ── Validate UUID format ───────────────────────────────────────────────────
  if (!UUID_RE.test(id)) {
    redirect("/");
  }

  // ── Fetch transaction from Supabase ───────────────────────────────────────
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/transactions?id=eq.${encodeURIComponent(id)}&select=id,status,email,plan&limit=1`,
    {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    redirect("/");
  }

  const rows: { id: string; status: string; email: string | null; plan: string | null }[] =
    await res.json();

  // ── Not found or not paid → block access ──────────────────────────────────
  if (rows.length === 0 || rows[0].status !== "paid") {
    redirect("/");
  }

  const plan = (rows[0].plan as "49" | "79" | null) ?? null;

  // ── Render step flow ───────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main className="px-6 pb-16">
        <div className="max-w-[680px] mx-auto">
          <AIInterface plan={plan} />
          <DocumentsPanel />
          <VerificationPanel />
          <ActivityPanel />
        </div>
      </main>
    </>
  );
}
