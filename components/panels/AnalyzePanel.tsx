"use client";

import { useEffect, useState } from "react";
import { useTransaction } from "@/context/TransactionContext";
import RiskBlock from "@/components/RiskBlock";
import { computeRisk } from "@/lib/risk";
import { track } from "@/lib/track";
import { hasMinimumInput as computeHasMinimumInput } from "@/lib/guards";

function IconWarning() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-amber-400"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-[var(--foreground-muted)]"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export default function AnalyzePanel({ plan }: { plan: "39" | "69" | null }) {
  const { transaction, advanceStep, advanceToStep, goToStep, isDecisionMade } = useTransaction();
  const [upsellLoading, setUpsellLoading] = useState(false);
  const showUpgrade = plan === "39";

  const uploadedCount = Object.values(transaction.documents).filter(
    (d) => d.status === "uploaded"
  ).length;

  // Global input gate — single source of truth from lib/guards
  const hasMinimumInput = computeHasMinimumInput(transaction);

  // Single source of truth — only meaningful when real input exists
  const risk = computeRisk(transaction);

  // Fire once on mount — only tracks when there is real data to report
  useEffect(() => {
    if (!hasMinimumInput) return;
    track("risk_computed", {
      risk_level:     risk.riskLevel,
      confidence:     risk.confidence,
      issues_count:   risk.issues.length,
      unknowns_count: risk.unknowns.length,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpgrade() {
    if (isDecisionMade) return;
    if (process.env.NODE_ENV === "development") {
      console.log("ACTION: UPGRADE_CLICK", transaction.id);
    }
    track("upgrade_clicked");
    setUpsellLoading(true);
    try {
      if (process.env.NODE_ENV === "development") {
        console.log("UPGRADE START");
        const res = await fetch(`/api/transactions/${transaction.id}/upgrade`, {
          method: "POST",
        });
        const data = await res.json();
        console.log("UPGRADE RESPONSE:", data);
        window.location.reload();
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "69", transaction_id: transaction.id }),
      });
      if (!res.ok) throw new Error("UPGRADE CHECKOUT FAILED");
      const { url } = await res.json();
      if (!url) throw new Error("UPGRADE CHECKOUT FAILED");
      window.location.href = url;
    } catch (err) {
      console.error("CHECKOUT FAILURE", err);
      setUpsellLoading(false);
      alert("Something went wrong. Please try again.");
    }
  }

  // No real input — do not render any risk output
  if (!hasMinimumInput) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white mb-2 leading-snug">
          We need more information.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Add a VIN or plate number, or upload at least one document to analyze
          this vehicle.
        </p>
        <button
          onClick={() => goToStep("upload")}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
        >
          ← Back to Upload
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Risk block — single source of truth */}
      <RiskBlock data={risk} />

      {/* Section header */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
          Risk analysis
        </p>
        <p className="text-sm text-white/75 leading-relaxed">
          We analyzed the vehicle, ownership, and records for potential issues.
        </p>
      </div>

      {/* No-documents notice */}
      {uploadedCount === 0 && (
        <div className="border border-[var(--border)] rounded-lg px-4 py-3 mb-6">
          <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
            No documents were provided. Results are based on vehicle data only.
          </p>
        </div>
      )}

      {/* Issues — dynamic, only when present */}
      {risk.issues.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
            Issues detected
          </p>
          <div className="flex flex-col gap-2.5 mb-6">
            {risk.issues.map((issue) => (
              <div
                key={issue}
                className="flex items-start gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3"
              >
                <span className="shrink-0 mt-0.5">
                  <IconWarning />
                </span>
                <p className="text-sm text-white">{issue}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Unknowns — dynamic, only when present */}
      {risk.unknowns.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
            Unknowns
          </p>
          <div className="flex flex-col gap-2.5 mb-6">
            {risk.unknowns.map((unknown) => (
              <div
                key={unknown}
                className="flex items-start gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3"
              >
                <span className="shrink-0 mt-0.5">
                  <IconInfo />
                </span>
                <p className="text-sm text-[var(--foreground-muted)]">{unknown}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Resolved — dynamic, only when present */}
      {risk.resolved.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
            Resolved
          </p>
          <div className="flex flex-col gap-1.5 mb-6">
            {risk.resolved.map((item) => (
              <p key={item} className="text-xs text-green-400 leading-relaxed">
                ✓ {item}
              </p>
            ))}
          </div>
        </>
      )}

      {/* Summary block */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-4 mb-6">
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
          What this means
        </p>
        <p className="text-sm text-white/75 leading-relaxed">
          {risk.issues.length > 0
            ? "These issues should be resolved before proceeding. Some risks may not be fully verifiable with automated checks alone."
            : risk.unknowns.length > 0
            ? "No critical issues found at this stage. Unknowns will be resolved once verification runs with your submitted data."
            : "No issues detected and all sources are accounted for. You can proceed with confidence."}
        </p>
      </div>

      {/* Upgrade trigger — Basic plan only */}
      {showUpgrade && (
        <div className="border border-white/[0.12] rounded-lg px-4 py-5 mb-6">
          <p className="text-sm font-medium text-white mb-2">
            Get full verification before you proceed
          </p>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-4">
            Upgrade to include expert review, deeper document validation, and
            cross-checks across additional sources.
          </p>
          <button
            onClick={handleUpgrade}
            disabled={upsellLoading}
            className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left disabled:opacity-60"
          >
            {upsellLoading ? "Redirecting…" : "Upgrade to full verification"}
          </button>
          <p className="text-xs text-[var(--foreground-muted)] mt-3">
            Recommended before completing the purchase.
          </p>
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={() => {
          if (process.env.NODE_ENV === "development") {
            console.log("ACTION: CONTINUE", { step: "analyze", transactionId: transaction.id });
          }
          if (plan === "39") advanceToStep("complete"); else advanceStep();
        }}
        className="w-full bg-[var(--background)] border border-[var(--border)] hover:border-white/30 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
      >
        {plan === "39" ? "Proceed to agreement" : "Review verification options"}
      </button>
    </>
  );
}
