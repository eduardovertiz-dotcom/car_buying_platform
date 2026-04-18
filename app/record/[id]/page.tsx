export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RecordClient from "./RecordClient";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RecordPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  if (!UUID_RE.test(id)) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-[var(--foreground-muted)]">Invalid record ID.</p>
      </main>
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirect=/record/${id}`);

  const adminDb = createAdminClient();
  const { data: tx } = await adminDb
    .from("transactions")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!tx) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-[var(--foreground-muted)]">Record not found.</p>
      </main>
    );
  }

  // Ownership check — admin email bypass
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes((user.email ?? "").toLowerCase());

  if (!isAdmin && tx.user_id && tx.user_id !== user.id) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-[var(--foreground-muted)]">Access denied.</p>
      </main>
    );
  }

  return (
    <main className="px-6 pb-16">
      <div className="max-w-[680px] mx-auto pt-10">
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-1">
          MexGuardian
        </p>
        <p className="text-xs text-[var(--foreground-muted)] mb-8">
          Transaction record — owner view
        </p>
        <RecordClient transactionId={id} />
      </div>
    </main>
  );
}
