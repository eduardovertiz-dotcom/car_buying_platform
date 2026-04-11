import { redirect } from "next/navigation";
import Header from "@/components/Header";
import TransactionComplete from "@/components/TransactionComplete";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default async function TransactionCompletePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  // ── Validate UUID format before hitting DB ────────────────────────────────
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    redirect("/");
  }

  // ── Fetch transaction from Supabase ───────────────────────────────────────
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/transactions?id=eq.${encodeURIComponent(id)}&select=id,status,email&limit=1`,
    {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    redirect("/");
  }

  const rows: { id: string; status: string; email: string | null }[] = await res.json();

  // ── Not found or not paid → block access ─────────────────────────────────
  if (rows.length === 0 || rows[0].status !== "paid") {
    redirect("/");
  }

  const email = rows[0].email ?? null;

  // ── Access granted ────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main className="px-6 pb-16">
        <div className="max-w-[680px] mx-auto">
          <TransactionComplete transactionId={id} email={email} />
        </div>
      </main>
    </>
  );
}
