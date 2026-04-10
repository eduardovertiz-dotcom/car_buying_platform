import Link from "next/link";
import { mockTransactions } from "@/lib/mock";
import { STEPS } from "@/lib/types";

export default function TransactionsPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-[680px] mx-auto">
        <div className="mb-10">
          <h1 className="text-xl font-semibold text-white tracking-tight">
            MexGuardian
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            Your active transactions
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {mockTransactions.map((txn) => {
            const step = STEPS.find((s) => s.key === txn.current_step)!;
            return (
              <Link
                key={txn.id}
                href={`/transaction/${txn.id}`}
                className="block border border-[var(--border)] rounded-lg px-5 py-4 hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {txn.vehicle.year} {txn.vehicle.make} {txn.vehicle.model}
                    </p>
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
          <button className="w-full border border-[var(--border)] rounded-lg px-5 py-4 text-sm text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-white transition-colors text-left">
            + Start new transaction
          </button>
        </div>
      </div>
    </main>
  );
}
