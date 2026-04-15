export const dynamic = "force-dynamic";

/**
 * /admin — Verification Queue
 *
 * Lists all paid transactions with admin_verification_status = "pending"
 * ordered oldest-first. Entire row links to /transaction/{id}.
 *
 * Auth: any authenticated user (same as admin verification API).
 * Redirect to /login if unauthenticated.
 *
 * Mode-aware: shows a notice when VERIFICATION_MODE !== "manual".
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isManualMode } from "@/lib/verification/mode";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function docDot(uploaded: boolean) {
  return uploaded
    ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
    : <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--border)]" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminQueuePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Admin allowlist guard — non-admins see 403 page rather than the queue
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin =
    ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes((user.email ?? "").toLowerCase());
  if (!isAdmin) redirect("/transactions");

  const manualMode = isManualMode();
  const adminDb = createAdminClient();

  // Fetch pending queue regardless of mode — page still loads, just shows notice
  const { data: rows, error } = await adminDb
    .from("transactions")
    .select("id, created_at, email, documents")
    .eq("status", "paid")
    .eq("admin_verification_status", "pending")
    .order("created_at", { ascending: true });

  const transactions = error ? [] : (rows ?? []);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-[760px] mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-1">
              Admin
            </p>
            <h1 className="text-lg font-semibold text-white">
              Verification Queue
            </h1>
          </div>
          <Link
            href="/admin/facturas"
            className="text-xs text-[var(--foreground-muted)] hover:text-white transition-colors"
          >
            Facturas →
          </Link>
        </div>

        {/* Mode notice */}
        {!manualMode && (
          <div className="border border-[var(--border)] rounded-lg px-4 py-3 mb-6">
            <p className="text-xs text-[var(--foreground-muted)]">
              Automated mode is active. Manual verification queue is inactive.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 mb-6">
            Could not load queue. Try refreshing.
          </p>
        )}

        {/* Queue */}
        {transactions.length === 0 ? (
          <div className="border-t border-[var(--border)] pt-8 text-center">
            <p className="text-sm text-[var(--foreground-muted)]">
              No pending verifications
            </p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[80px_1fr_130px_80px_56px] gap-x-4 px-3 mb-2">
              <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">ID</p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">Email</p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">Age</p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">Docs</p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]"></p>
            </div>

            <ul className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
              {transactions.map((tx) => {
                // Parse document status from JSONB — defensive
                const docs = (tx.documents ?? {}) as Record<string, { status?: string }>;
                const hasINE = docs.ine?.status === "uploaded";
                const hasFactura = docs.invoice?.status === "uploaded";
                const hasCirc = docs.registration?.status === "uploaded";
                const shortId = tx.id.slice(0, 8).toUpperCase();
                const email = tx.email ?? "—";

                return (
                  <li key={tx.id}>
                    <Link
                      href={`/transaction/${tx.id}`}
                      className="grid grid-cols-[80px_1fr_130px_80px_56px] gap-x-4 items-center px-3 py-3 hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded"
                    >
                      {/* Short ID */}
                      <span className="text-xs font-mono text-white">{shortId}</span>

                      {/* Email */}
                      <span className="text-xs text-[var(--foreground-muted)] truncate">{email}</span>

                      {/* Age */}
                      <span className="text-xs text-[var(--foreground-muted)]">
                        {tx.created_at ? relativeTime(tx.created_at) : "—"}
                      </span>

                      {/* Docs dots: INE · Factura · Circ */}
                      <span className="flex items-center gap-1">
                        {docDot(hasINE)}
                        {docDot(hasFactura)}
                        {docDot(hasCirc)}
                      </span>

                      {/* Arrow */}
                      <span className="text-xs text-[var(--foreground-muted)] text-right">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-[var(--foreground-muted)] mt-4">
              {transactions.length} pending
            </p>
          </>
        )}
      </div>
    </main>
  );
}
