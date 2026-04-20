"use client";

import type { RiskOutput } from "@/lib/risk";

// Re-export helpers so existing imports from "@/components/RiskBlock" keep working
export type { RiskLevel } from "@/lib/risk";
export { confidenceLabel, statusToRiskLevel } from "@/lib/risk";

function confidenceText(confidence: number): string {
  if (confidence >= 70) return "Most critical information verified";
  if (confidence >= 40) return "Some important information could not be verified";
  if (confidence > 0)   return "Very limited information could be verified";
  return "No data available";
}

function riskStyles(level: string): string {
  if (level === "HIGH")     return "text-red-400 border-red-400/30 bg-red-400/[0.08]";
  if (level === "MODERATE") return "text-amber-400 border-amber-400/30 bg-amber-400/[0.08]";
  return "text-green-400 border-green-400/30 bg-green-400/[0.08]";
}

export default function RiskBlock({
  data,
  headerLabel,
  confidenceNote,
  riskLevelLabel,
}: {
  data: RiskOutput;
  headerLabel?: string;
  confidenceNote?: string;
  riskLevelLabel?: string;
}) {
  return (
    <div className="border border-[var(--border)] rounded-lg px-4 py-4 mb-6 transform transition-all duration-300 ease-out">
      {headerLabel && (
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
          {headerLabel}
        </p>
      )}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
            Risk Level
          </p>
          <span
            className={`inline-block text-xs font-semibold tracking-widest uppercase px-2.5 py-1 rounded border transition-colors duration-300 ${
              riskLevelLabel === "Unclear due to missing information"
                ? "text-[#444] border-white/20 bg-white/10"
                : riskStyles(data.riskLevel)
            }`}
          >
            {riskLevelLabel ?? data.riskLevel}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
            Confidence
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] leading-snug transition-opacity duration-300 text-right max-w-[140px]">
            {confidenceText(data.confidence)}
          </p>
          {confidenceNote && (
            <p className="text-[11px] text-[#666] mt-1 leading-snug">
              {confidenceNote}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-[var(--foreground-muted)] mt-3 pt-3 border-t border-[var(--border)] leading-relaxed transition-opacity duration-300">
        {data.confidenceLabel}
      </p>
    </div>
  );
}
