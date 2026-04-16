"use client";

import { useTransaction } from "@/context/TransactionContext";
import { ActivityEntry, STEPS, DOCUMENT_LABELS } from "@/lib/types";

function formatEntry(entry: ActivityEntry): string {
  const stepLabel = STEPS.find((s) => s.key === entry.step)?.label ?? entry.step;
  switch (entry.type) {
    case "transaction_created":
      return "Verification started";
    case "step_completed":
      return `Completed: ${stepLabel}`;
    case "basic_verification_requested":
      return "Basic verification requested";
    case "professional_verification_requested":
      return "Professional verification requested";
    case "document_uploaded": {
      const docType = entry.meta?.document_type;
      const label = docType ? DOCUMENT_LABELS[docType] : "Document";
      return `Document uploaded: ${label}`;
    }
    case "contract_generated":
      return "Purchase agreement generated";
    case "transaction_completed":
      return "Completed: Transaction";
    case "maintenance_added":
      return "Maintenance record added";
    default:
      return entry.type;
  }
}

export default function ActivityPanel() {
  const { transaction } = useTransaction();
  const { activity_log } = transaction;

  return (
    <section className="border-t border-[var(--border)] py-6">
      <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
        Activity
      </h3>

      {activity_log.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">
          No activity recorded yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...activity_log].reverse().map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-4"
            >
              <p className="text-sm text-[var(--foreground-muted)]">
                {formatEntry(entry)}
              </p>
              <p className="text-xs text-[var(--border)] shrink-0 font-mono">
                {new Date(entry.timestamp).toLocaleDateString("en-MX", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      {transaction.current_step === "complete" && (
        <div className="mt-6">
          <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
            Maintenance
          </h3>
          {transaction.maintenance.records.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">No records yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {[...transaction.maintenance.records].reverse().map((record) => (
                <li key={record.id} className="flex items-start justify-between gap-4">
                  <p className="text-sm text-[var(--foreground-muted)]">{record.title}</p>
                  <p className="text-xs text-[var(--border)] shrink-0 font-mono">
                    {new Date(record.date).toLocaleDateString("en-MX", {
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
