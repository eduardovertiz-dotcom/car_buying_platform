"use client";

import { usePathname } from "next/navigation";
import { useTransaction } from "@/context/TransactionContext";
import { Step } from "@/lib/types";
import { stepEngineCopy } from "@/lib/i18n/stepEngine";

function statusLabel(status: string, step: Step, p: typeof stepEngineCopy["en"]["panels"]): string {
  if (status !== "not_started") {
    const map: Record<string, string> = {
      basic_processing:        p.runningBasicChecks,
      basic_complete:          p.basicComplete,
      professional_processing: p.professionalInProgress,
      professional_complete:   p.professionalComplete,
    };
    return map[status] ?? status;
  }
  if (step === "upload" || step === "check") return p.notYetStarted;
  if (step === "analyze")                    return p.readyToRun;
  if (step === "verify")                     return p.initializingStatus;
  return p.completed;
}

export default function VerificationPanel() {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
  const { transaction } = useTransaction();
  const { verification_status, verification_results, current_step } = transaction;

  // Verify step owns verification display entirely. Complete uses RiskBlock.
  // Neither should show this panel alongside their dedicated UI.
  if (current_step === "verify" || current_step === "complete") return null;

  return (
    <section className="border-t border-[var(--border)] py-6">
      <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
        {t.panels.verification}
      </h3>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white">{t.panels.statusLabel}</p>
        <p className="text-sm text-[var(--foreground-muted)]">
          {statusLabel(verification_status, current_step, t.panels)}
        </p>
      </div>

      {(verification_status === "basic_processing" ||
        verification_status === "professional_processing") && (
        <div className="border border-[var(--border)] rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-[var(--foreground-muted)]">
            {verification_status === "basic_processing"
              ? t.panels.basicRunning
              : t.panels.professionalRunning}
          </p>
        </div>
      )}

      {verification_results && (
        <div className="flex flex-col">
          {verification_results.findings.length > 0 && (
            <>
              <p className="text-xs text-[var(--foreground-muted)] mb-2">
                {t.reports.findings.toUpperCase()}
              </p>
              <ul className="flex flex-col gap-1.5 mb-4">
                {verification_results.findings.map((finding, i) => (
                  <li key={i} className="text-xs text-[var(--foreground-muted)]">
                    — {finding}
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="text-xs text-[var(--foreground-muted)] mb-1">
            {t.panels.confidence.toUpperCase()}
          </p>
          <p className="text-sm text-white">
            {verification_results.confidence}%
          </p>
        </div>
      )}

      {verification_status === "not_started" && (
        <p className="text-xs text-[var(--foreground-muted)]">
          {t.panels.verificationRuns}
        </p>
      )}
    </section>
  );
}
