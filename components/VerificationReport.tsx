/**
 * VerificationReport — user-facing verification result.
 *
 * Rendered server-side from DB data. No hooks, no client state.
 * Shown when admin_verification_status is safe | caution | high_risk.
 *
 * In automated mode (future): this component will be replaced by results
 * from the automated verification pipeline. The prop interface is stable.
 */

type ReportStatus = "safe" | "caution" | "high_risk";

type Props = {
  status: ReportStatus;
  notes: string | null;
};

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; color: string; recommendation: string }
> = {
  safe: {
    label: "Safe",
    color: "text-green-400",
    recommendation: "Proceed with normal precautions.",
  },
  caution: {
    label: "Caution",
    color: "text-amber-400",
    recommendation: "Review details carefully before proceeding.",
  },
  high_risk: {
    label: "High Risk",
    color: "text-red-400",
    recommendation: "We recommend not proceeding with this transaction.",
  },
};

export default function VerificationReport({ status, notes }: Props) {
  const config = STATUS_CONFIG[status];

  return (
    <section className="border-t border-[var(--border)] py-6">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
          Verification Complete
        </p>
      </div>

      {/* Overall status */}
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-[var(--foreground-muted)]">Overall result</p>
        <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
      </div>

      {/* Summary (from admin notes) */}
      {notes && (
        <div className="mb-4">
          <p className="text-xs text-[var(--foreground-muted)] mb-1">Summary</p>
          <p className="text-sm text-white leading-relaxed">{notes}</p>
        </div>
      )}

      {/* Recommendation */}
      <div className="border border-[var(--border)] rounded-lg px-4 py-3">
        <p className="text-xs text-[var(--foreground-muted)] mb-1">Recommendation</p>
        <p className="text-sm text-white leading-relaxed">{config.recommendation}</p>
      </div>
    </section>
  );
}
