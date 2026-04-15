"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FacturaForm from "@/components/FacturaForm";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TxnRow = {
  id: string;
  created_at: string;
  status: string;
  plan: string | null;
};

function planLabel(plan: string | null): string {
  if (plan === "79") return "Professional";
  if (plan === "49") return "Basic";
  return "Verification";
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [isFacturaOpen, setIsFacturaOpen] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);
  const facturaRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleOpenFactura() {
    setIsFacturaOpen(true);
    setTimeout(() => {
      facturaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  // Read ?new param and prefetch email for factura
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("new");
    setNewId(id);

    if (id && SUPABASE_URL && SUPABASE_KEY) {
      fetch(
        `${SUPABASE_URL}/rest/v1/transactions?id=eq.${encodeURIComponent(id)}&select=email&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
        .then((r) => r.json())
        .then((rows: { email: string | null }[]) => {
          setNewEmail(rows[0]?.email ?? null);
        })
        .catch(() => {});
    }
  }, []);

  // Auth guard + fetch transactions from Supabase
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        // Preserve ?new param for bind and for returning to this screen after login
        const currentUrl = window.location.pathname + window.location.search;
        const newParam = new URLSearchParams(window.location.search).get("new");
        if (newParam) {
          try { localStorage.setItem("bind_pending", newParam); } catch {}
        }
        router.replace("/login?redirect=" + encodeURIComponent(currentUrl));
        return;
      }

      // Execute any pending bind immediately after returning from login
      const pendingBind = localStorage.getItem("bind_pending");
      if (pendingBind) {
        const res = await fetch("/api/bind-transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: pendingBind }),
        });
        localStorage.removeItem("bind_pending");
        if (!res.ok) {
          const status = res.status;
          if (status === 403) {
            setBindError(
              "This transaction is linked to a different email. Sign in with the email address used at checkout."
            );
          }
          // Non-403 errors: silently continue — transaction still accessible by email match
        }
      }

      const query = supabase
        .from("transactions")
        .select("id, created_at, status, plan")
        .eq("status", "paid");

      const filteredQuery = user.email
        ? query.or(`user_id.eq.${user.id},and(user_id.is.null,email.eq.${user.email})`)
        : query.eq("user_id", user.id);

      const { data, error } = await filteredQuery
        .order("created_at", { ascending: false });

      if (error) {
        console.error("TRANSACTIONS FETCH FAILED", error);
        setLoaded(true);
        return;
      }

      const valid = (data ?? []).filter(
        (t) => t.id && UUID_RE.test(t.id)
      ) as TxnRow[];

      // Auto-redirect to /start when user has no transactions (and not on ?new confirmation)
      if (valid.length === 0 && !new URLSearchParams(window.location.search).get("new")) {
        router.replace("/start");
        return;
      }

      setTransactions(valid);
      setLoaded(true);
    });
  }, [router]);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-[680px] mx-auto">

        {/* ── Payment confirmed — only when ?new is present ────────────────── */}
        {newId && (
          <div className="min-h-[65vh] flex flex-col justify-center">
            <div className="max-w-[560px] mx-auto px-6">
              <p className="text-xs tracking-[0.2em] uppercase text-white/70">
                Payment confirmed
              </p>

              <div className="mt-3 space-y-3">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Your verification is ready
                </h2>
                <p className="text-sm text-[var(--foreground-muted)]">
                  Payment received successfully.
                </p>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed opacity-70">
                  Your transaction has been created. Begin the verification process when you&apos;re ready.
                </p>
              </div>

              <div className="mt-8">
                {bindError ? (
                  <div className="space-y-3">
                    <p className="text-sm text-red-400">{bindError}</p>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-white/60 underline hover:text-white transition-colors"
                    >
                      Sign out and try a different account
                    </button>
                  </div>
                ) : (
                  <Link
                    href={`/transaction/${newId}`}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-6 py-3.5 hover:opacity-90 transition-opacity"
                  >
                    Start verification →
                  </Link>
                )}
              </div>

              <div className="mt-6">
                {!isFacturaOpen && (
                  <button
                    onClick={handleOpenFactura}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Request invoice (Factura)
                  </button>
                )}

                {isFacturaOpen && (
                  <div ref={facturaRef}>
                    <FacturaForm transactionId={newId} prefillEmail={newEmail} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Transaction list — only when ?new is absent ───────────────────── */}
        {!newId && (
          <>
            <div className="mb-10 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-white tracking-tight">
                  MexGuardian
                </h1>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  Your active transactions
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLogout}
                  className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors"
                >
                  Sign out
                </button>
                <Link
                  href="/start"
                  className="shrink-0 bg-[var(--accent)] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  + Start new
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {loaded && transactions.length === 0 && (
                <div className="text-center mt-20">
                  <h2 className="text-lg font-semibold text-white mb-2">
                    No transactions yet
                  </h2>
                  <p className="text-sm text-[var(--foreground-muted)] mb-6">
                    Start your first vehicle verification
                  </p>
                  <Link
                    href="/start"
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-5 py-3 hover:opacity-90 transition-opacity"
                  >
                    Start new transaction →
                  </Link>
                </div>
              )}

              {transactions.map((txn) => {
                const label = planLabel(txn.plan);
                const date = new Date(txn.created_at).toLocaleDateString("en-MX", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <Link
                    key={txn.id}
                    href={`/transaction/${txn.id}`}
                    className="block border border-[var(--border)] rounded-lg px-5 py-4 hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{label}</p>
                        <p className="text-xs text-[var(--foreground-muted)] mt-0.5 font-mono">
                          {txn.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest">
                          {date}
                        </p>
                        <p className="text-sm text-[var(--accent)] font-medium mt-0.5">
                          Active
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
