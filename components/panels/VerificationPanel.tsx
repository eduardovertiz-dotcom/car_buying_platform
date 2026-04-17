"use client";

import { useTransaction } from "@/context/TransactionContext";
import { Step } from "@/lib/types";

function statusLabel(status: string, step: Step): string {
  if (status !== "not_started") {
    const map: Record<string, string> = {
      basic_processing:       "Running basic checks",
      basic_complete:         "Basic complete",
      professional_processing: "Professional review in progress",
      professional_complete:  "Professional complete",
    };
    return map[status] ?? status;
  }
  // "not_started" — step-aware label
  if (step === "upload" || step === "check") return "Not yet started";
  if (step === "analyze")                    return "Ready to run";
  if (step === "verify")                     return "Initializing";
  return "Completed";
}

export default function VerificationPanel() {
  const { transaction } = useTransaction();
  const { verification_status, verification_results, current_step } = transaction;

  // Verify step owns verification display entirely. Complete uses RiskBlock.
  // Neither should show this panel alongside their dedicated UI.
  if (current_step === "verify" || current_step === "complete") return null;

  return (
    <section className="border-t border-[var(--border)] py-6">
      <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
        Verification
      </h3>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white">Status</p>
        <p className="text-sm text-[var(--foreground-muted)]">
          {statusLabel(verification_status, current_step)}
        </p>
      </div>

      {(verification_status === "basic_processing" ||
        verification_status === "professional_processing") && (
        <div className="border border-[var(--border)] rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-[var(--foreground-muted)]">
            {verification_status === "basic_processing"
              ? "Basic verification is running. Results will appear here shortly."
              : "Professional review is in progress. Results will appear here when complete."}
          </p>
        </div>
      )}

      {verification_results && (
        <div className="flex flex-col">
          {verification_results.findings.length > 0 && (
            <>
              <p className="text-xs text-[var(--foreground-muted)] mb-2">
                FINDINGS
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
            CONFIDENCE
          </p>
          <p className="text-sm text-white">
            {verification_results.confidence}%
          </p>
        </div>
      )}

      {verification_status === "not_started" && (
        <p className="text-xs text-[var(--foreground-muted)]">
          Verification runs when you reach the Verify step.
        </p>
      )}
    </section>
  );
}
