"use client";

import { useTransaction } from "@/context/TransactionContext";

const statusLabel: Record<string, string> = {
  not_started: "Not started",
  basic_processing: "Running basic checks",
  basic_complete: "Basic complete",
  professional_processing: "Professional review in progress",
  professional_complete: "Professional complete",
};

export default function VerificationPanel() {
  const { transaction } = useTransaction();
  const { verification_status, verification_results } = transaction;

  return (
    <section className="border-t border-[var(--border)] py-6">
      <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
        Verification
      </h3>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white">Status</p>
        <p className="text-sm text-[var(--foreground-muted)]">
          {statusLabel[verification_status] ?? verification_status}
        </p>
      </div>

      {(verification_status === "basic_processing" ||
        verification_status === "professional_processing") && (
        <div className="border border-[var(--border)] rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-[var(--foreground-muted)]">
            {verification_status === "basic_processing"
              ? "Basic verification is running. Results will appear here shortly."
              : "Professional review is in progress. Results will appear here when the Nexcar team completes their review."}
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
              <ul className="flex flex-col gap-1.5">
                {verification_results.findings.map((finding, i) => (
                  <li key={i} className="text-xs text-[var(--foreground-muted)]">
                    — {finding}
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="text-xs text-[var(--foreground-muted)] mt-4 mb-1">
            CONFIDENCE
          </p>
          <p className="text-sm text-white">
            {verification_results.confidence}%
          </p>
        </div>
      )}

      {verification_status === "not_started" && (
        <p className="text-xs text-[var(--foreground-muted)]">
          Verification data may be incomplete. Results do not guarantee the
          absence of risk.
        </p>
      )}
    </section>
  );
}
