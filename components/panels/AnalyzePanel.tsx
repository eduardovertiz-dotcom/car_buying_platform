"use client";

import { useState } from "react";
import { useTransaction } from "@/context/TransactionContext";
import RiskBlock from "@/components/RiskBlock";

type RiskItem = {
  title: string;
  explanation: string;
  level: "warning" | "neutral";
};

const RISK_ITEMS: RiskItem[] = [
  {
    title: "Ownership inconsistency",
    explanation: "Seller information does not fully match official records.",
    level: "warning",
  },
  {
    title: "Pending fines",
    explanation: "Outstanding fines may transfer with the vehicle.",
    level: "warning",
  },
  {
    title: "Record gaps",
    explanation: "Some registry data is incomplete or delayed.",
    level: "neutral",
  },
];

const RESOLVED_ITEMS: string[] = [
  "No theft record found in public registry",
  "Registration is current",
];

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

export default function AnalyzePanel({ plan }: { plan: "49" | "79" | null }) {
  const { transaction, advanceStep, advanceToStep } = useTransaction();
  const [upsellLoading, setUpsellLoading] = useState(false);
  const showUpgrade = plan === "49";

  const uploadedCount = Object.values(transaction.documents).filter(
    (d) => d.status === "uploaded"
  ).length;

  // Confidence derived from document completeness + mock analysis
  // 2 warnings → MODERATE; confidence scales with doc completeness
  const confidence = uploadedCount === 3 ? 62 : uploadedCount === 2 ? 45 : uploadedCount === 1 ? 28 : 15;

  async function handleUpgrade() {
    setUpsellLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? "No checkout URL");
      window.location.href = url;
    } catch (err) {
      console.error("[analyze-upgrade]", err);
      setUpsellLoading(false);
    }
  }

  return (
    <>
      {/* Risk block */}
      <RiskBlock
        level="MODERATE"
        confidence={confidence}
        contextLine={`Based on ${uploadedCount} of 3 documents.`}
      />

      {/* Section header */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
          Risk analysis
        </p>
        <p className="text-sm text-white/75 leading-relaxed">
          We analyzed the vehicle, ownership, and records for potential issues.
        </p>
      </div>

      {/* Issues detected */}
      <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
        Issues detected
      </p>
      <div className="flex flex-col gap-2.5 mb-6">
        {RISK_ITEMS.map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3"
          >
            <span className="shrink-0 mt-0.5">
              {item.level === "warning" ? <IconWarning /> : <IconInfo />}
            </span>
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-0.5">
                {item.explanation}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Resolved */}
      <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
        Resolved
      </p>
      <div className="flex flex-col gap-1.5 mb-6">
        {RESOLVED_ITEMS.map((item) => (
          <p key={item} className="text-xs text-green-400 leading-relaxed">
            ✓ {item}
          </p>
        ))}
      </div>

      {/* Summary block */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-4 mb-6">
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
          What this means
        </p>
        <p className="text-sm text-white/75 leading-relaxed">
          These issues should be resolved before proceeding.
          Some risks may not be fully verifiable with automated checks alone.
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
        onClick={() => plan === "49" ? advanceToStep("complete") : advanceStep()}
        className="w-full bg-[var(--background)] border border-[var(--border)] hover:border-white/30 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
      >
        {plan === "49" ? "Proceed to agreement" : "Review verification options"}
      </button>
    </>
  );
}
