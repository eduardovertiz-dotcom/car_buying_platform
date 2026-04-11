"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Transaction, STEPS } from "@/lib/types";
import FacturaForm from "@/components/FacturaForm";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [isFacturaOpen, setIsFacturaOpen] = useState(false);
  const facturaRef = useRef<HTMLDivElement>(null);

  function handleOpenFactura() {
    setIsFacturaOpen(true);
    setTimeout(() => {
      facturaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("new");
    setNewId(id);

    // Fetch email for factura prefill when ?new is present
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

    // Purge legacy mock transactions
    const LEGACY_IDS = new Set(["txn_001", "txn_002"]);
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith("transaction_")) return;
      try {
        const txn = JSON.parse(localStorage.getItem(key) || "{}");
        if (LEGACY_IDS.has(txn.id) || txn.source !== "real") {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });

    // Load valid paid transactions from localStorage (keyed by Supabase UUID)
    const txns: Transaction[] = Object.keys(localStorage)
      .filter((key) => key.startsWith("transaction_"))
      .map((key) => {
        try { return JSON.parse(localStorage.getItem(key)!); }
        catch { return null; }
      })
      .filter((txn) => txn && txn.id && txn.current_step && txn.source === "real")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setTransactions(txns);
    setLoaded(true);
  }, []);

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
                <Link
                  href={`/transaction/${newId}`}
                  className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-6 py-3.5 hover:opacity-90 transition-opacity"
                >
                  Start verification →
                </Link>
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
            <div className="mb-10">
              <h1 className="text-xl font-semibold text-white tracking-tight">
                MexGuardian
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                Your active transactions
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {loaded && transactions.length === 0 && (
                <div className="py-4">
                  <p className="text-sm text-[var(--foreground-muted)] mb-4">
                    You don&apos;t have any active transactions.
                  </p>
                  <Link
                    href="/#pricing"
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-5 py-3 hover:opacity-90 transition-opacity"
                  >
                    Start verification →
                  </Link>
                </div>
              )}

              {transactions.map((txn) => {
                const step = STEPS.find((s) => s.key === txn.current_step) ?? STEPS[0];
                const vehicleLabel = [txn.vehicle.year, txn.vehicle.make, txn.vehicle.model]
                  .filter(Boolean)
                  .join(" ") || "New transaction";

                return (
                  <Link
                    key={txn.id}
                    href={`/transaction/${txn.id}`}
                    className="block border border-[var(--border)] rounded-lg px-5 py-4 hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{vehicleLabel}</p>
                        {txn.vehicle.vin && (
                          <p className="text-xs text-[var(--foreground-muted)] mt-0.5 font-mono">
                            {txn.vehicle.vin}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest">
                          Step {step.index + 1} of {STEPS.length}
                        </p>
                        <p className="text-sm text-[var(--accent)] font-medium mt-0.5">
                          {step.label}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="w-full h-px bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full transition-all"
                          style={{ width: `${txn.checklist_progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--foreground-muted)] mt-1.5">
                        {txn.checklist_progress}% complete
                      </p>
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
