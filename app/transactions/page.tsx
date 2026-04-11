"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_DOCUMENTS, Transaction, STEPS } from "@/lib/types";
import FacturaForm from "@/components/FacturaForm";

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [isFacturaOpen, setIsFacturaOpen] = useState(false);
  const facturaRef = useRef<HTMLDivElement>(null);

  function handleOpenFactura() {
    setIsFacturaOpen(true);
    setTimeout(() => {
      facturaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  useEffect(() => {
    setNewId(new URLSearchParams(window.location.search).get("new"));
    const LEGACY_IDS = new Set(["txn_001", "txn_002"]);

    // Purge legacy mock transactions from previous sessions
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

    // Load only valid real transactions
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

  function handleNewTransaction() {
    const txnId = "txn_" + crypto.randomUUID();
    const newTransaction: Transaction & { source: string } = {
      id: txnId,
      source: "real",
      vehicle: { make: "", model: "", year: new Date().getFullYear() },
      current_step: "understand",
      checklist_progress: 0,
      verification_status: "not_started",
      documents: { ...DEFAULT_DOCUMENTS },
      verification_results: null,
      activity_log: [
        {
          id: `act_${Date.now()}`,
          type: "transaction_created",
          step: "understand",
          timestamp: new Date().toISOString(),
        },
      ],
      contract: { status: "not_started" },
      maintenance: { records: [] },
      share: { enabled: false },
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(`transaction_${txnId}`, JSON.stringify(newTransaction));
    router.push(`/transaction/${txnId}`);
  }

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
                  Your transaction has been created. Begin the verification process when you're ready.
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
                    <FacturaForm transactionId={newId} prefillEmail={null} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mb-10">
          <h1 className="text-xl font-semibold text-white tracking-tight">
            MexGuardian
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            Your active transactions
          </p>
        </div>

        {!newId && (
          <>
            <div className="flex flex-col gap-3">
              {loaded && transactions.length === 0 && (
                <p className="text-sm text-[var(--foreground-muted)] py-4">
                  Start your first verification
                </p>
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

            <div className="mt-8">
              <button
                onClick={handleNewTransaction}
                className="w-full border border-[var(--border)] rounded-lg px-5 py-4 text-sm text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-white transition-colors text-left"
              >
                + Start new transaction
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
