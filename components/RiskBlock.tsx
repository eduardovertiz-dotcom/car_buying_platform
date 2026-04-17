"use client";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH";

export function confidenceLabel(n: number): string {
  if (n >= 90) return "High confidence — all key sources verified";
  if (n >= 70) return "Moderate confidence — most sources verified";
  if (n >= 50) return "Partial confidence — limited data available";
  if (n > 0)   return "Low confidence — significant data gaps";
  return "No data — analysis could not run";
}

export function statusToRiskLevel(status: "safe" | "review" | "high_risk"): RiskLevel {
  if (status === "high_risk") return "HIGH";
  if (status === "review")    return "MODERATE";
  return "LOW";
}

function riskStyles(level: RiskLevel): string {
  if (level === "HIGH")     return "text-red-400 border-red-400/30 bg-red-400/[0.08]";
  if (level === "MODERATE") return "text-amber-400 border-amber-400/30 bg-amber-400/[0.08]";
  return "text-green-400 border-green-400/30 bg-green-400/[0.08]";
}

export default function RiskBlock({
  level,
  confidence,
  contextLine,
  headerLabel,
}: {
  level: RiskLevel;
  confidence: number;
  contextLine?: string;
  headerLabel?: string;
}) {
  return (
    <div className="border border-[var(--border)] rounded-lg px-4 py-4 mb-6">
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
          <span className={`inline-block text-xs font-semibold tracking-widest uppercase px-2.5 py-1 rounded border ${riskStyles(level)}`}>
            {level}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-2">
            Confidence
          </p>
          <p className="text-lg font-semibold text-white leading-none">{confidence}%</p>
        </div>
      </div>
      <p className="text-xs text-[var(--foreground-muted)] mt-3 pt-3 border-t border-[var(--border)] leading-relaxed">
        {contextLine ?? confidenceLabel(confidence)}
      </p>
    </div>
  );
}
