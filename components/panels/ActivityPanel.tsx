"use client";

import { usePathname } from "next/navigation";
import { useTransaction } from "@/context/TransactionContext";
import { ActivityEntry, STEPS, DOCUMENT_LABELS } from "@/lib/types";
import { stepEngineCopy } from "@/lib/i18n/stepEngine";

type TActivity = typeof stepEngineCopy["en"]["activity"];
type TSteps = typeof stepEngineCopy["en"]["steps"];
type TFields = typeof stepEngineCopy["en"]["fields"];

function formatEntry(
  entry: ActivityEntry,
  a: TActivity,
  steps: TSteps,
  fields: TFields,
): string {
  const stepLabelMap: Record<string, string> = {
    upload: steps.upload,
    check: steps.check,
    analyze: steps.verify,
    verify: steps.verify,
    complete: steps.complete,
  };
  const stepLabel = stepLabelMap[entry.step ?? ""] ?? (STEPS.find((s) => s.key === entry.step)?.label ?? entry.step ?? "");

  switch (entry.type) {
    case "transaction_created":
      return a.verificationStarted;
    case "step_completed":
      return `${a.stepCompleted}: ${stepLabel}`;
    case "basic_verification_requested":
      return a.basicRequested;
    case "professional_verification_requested":
      return a.professionalRequested;
    case "document_uploaded": {
      const docType = entry.meta?.document_type;
      const docLabelMap: Record<string, string> = {
        ine: fields.sellerId,
        registration: fields.registration,
        invoice: fields.ownershipInvoice,
      };
      const label = docType ? (docLabelMap[docType] ?? DOCUMENT_LABELS[docType]) : "Document";
      return `${a.documentUploaded}: ${label}`;
    }
    case "contract_generated":
      return a.contractGenerated;
    case "transaction_completed":
      return a.transactionCompleted;
    case "maintenance_added":
      return a.maintenanceAdded;
    default:
      return entry.type;
  }
}

export default function ActivityPanel() {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
  const { transaction } = useTransaction();
  const { activity_log } = transaction;

  // Verify is a self-contained decision engine — no auxiliary panels.
  if (transaction.current_step === "verify") return null;

  return (
    <section className="border-t border-[var(--border)] py-6">
      <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
        {t.panels.activity}
      </h3>

      {activity_log.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">
          {t.panels.noActivity}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...activity_log].reverse().map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-4"
            >
              <p className="text-sm text-[var(--foreground-muted)]">
                {formatEntry(entry, t.activity, t.steps, t.fields)}
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
            {t.panels.maintenance}
          </h3>
          {transaction.maintenance.records.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">{t.panels.noRecords}</p>
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
