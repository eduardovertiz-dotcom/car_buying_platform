"use client";

/**
 * AdminVerifyPanel — Verification Console
 *
 * Production operator tool. Designed for 5–15 second processing per case.
 *
 * Shown only when all three are true (enforced server-side):
 *   - VERIFICATION_MODE === "manual"
 *   - user is authenticated
 *   - admin_verification_status === "pending"
 *
 * Features:
 *   - One-click templates (Safe / Caution / High Risk)
 *   - Auto-submit toggle — template click immediately submits
 *   - Auto-open next toggle — after submit, navigates to next pending
 *   - Keyboard shortcuts: 1/2/3 = templates, Enter = submit, N = next
 *   - Three signal dropdowns: Theft / Factura / Consistency
 *   - Auto-derived status with manual override
 *   - Auto-generated notes with free-text editing + reset
 *   - Double-submit guard
 *   - Network error + retry
 */

import { useState, useCallback, useEffect, useRef } from "react";
import NextPendingButton from "@/components/NextPendingButton";

// ─── Types ───────────────────────────────────────────────────────────────────

type FinalStatus = "safe" | "caution" | "high_risk";
type TheftSignal = "safe" | "caution" | "high_risk";
type FacturaSignal = "valid" | "unclear" | "invalid";
type ConsistencySignal = "consistent" | "minor" | "major";
type SubmitState = "idle" | "loading" | "success" | "error";

type Props = {
  transactionId: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<FinalStatus, string> = {
  safe: "Safe",
  caution: "Caution",
  high_risk: "High Risk",
};

const STATUS_COLORS: Record<FinalStatus, string> = {
  safe: "text-green-400",
  caution: "text-amber-400",
  high_risk: "text-red-400",
};

const THEFT_OPTIONS: { value: TheftSignal; label: string }[] = [
  { value: "safe", label: "Safe — No record found" },
  { value: "caution", label: "Caution — Inconclusive" },
  { value: "high_risk", label: "High Risk — Record found" },
];

const FACTURA_OPTIONS: { value: FacturaSignal; label: string }[] = [
  { value: "valid", label: "Valid" },
  { value: "unclear", label: "Unclear" },
  { value: "invalid", label: "Invalid" },
];

const CONSISTENCY_OPTIONS: { value: ConsistencySignal; label: string }[] = [
  { value: "consistent", label: "Consistent" },
  { value: "minor", label: "Minor discrepancies" },
  { value: "major", label: "Major discrepancies" },
];

const FINAL_STATUS_OPTIONS: { value: FinalStatus; label: string }[] = [
  { value: "safe", label: "Safe" },
  { value: "caution", label: "Caution" },
  { value: "high_risk", label: "High Risk" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveStatus(
  theft: TheftSignal,
  factura: FacturaSignal,
  consistency: ConsistencySignal
): FinalStatus {
  if (theft === "high_risk" || factura === "invalid" || consistency === "major") return "high_risk";
  if (theft === "caution" || factura === "unclear" || consistency === "minor") return "caution";
  return "safe";
}

function generateNotes(
  theft: TheftSignal,
  factura: FacturaSignal,
  consistency: ConsistencySignal,
  derived: FinalStatus
): string {
  const lines: string[] = [];
  if (theft === "safe") lines.push("No theft record found in REPUVE.");
  else if (theft === "caution") lines.push("REPUVE result was inconclusive. Manual follow-up recommended.");
  else lines.push("Theft record detected in REPUVE. Do not proceed.");

  if (factura === "valid") lines.push("Invoice validated successfully.");
  else if (factura === "unclear") lines.push("Invoice could not be fully validated. Verify with seller.");
  else lines.push("Invoice validation failed or document is invalid.");

  if (consistency === "consistent") lines.push("Documents are consistent with vehicle details.");
  else if (consistency === "minor") lines.push("Minor discrepancies found in documents. Review before proceeding.");
  else lines.push("Major discrepancies detected. Documents do not match vehicle details.");

  if (derived === "safe") lines.push("Proceed with normal precautions.");
  else if (derived === "caution") lines.push("Review all details carefully before proceeding.");
  else lines.push("We recommend not proceeding with this transaction.");

  return lines.join(" ");
}

type TemplatePreset = { theft: TheftSignal; factura: FacturaSignal; consistency: ConsistencySignal };

const TEMPLATES: Record<FinalStatus, TemplatePreset> = {
  safe: { theft: "safe", factura: "valid", consistency: "consistent" },
  caution: { theft: "caution", factura: "unclear", consistency: "minor" },
  high_risk: { theft: "high_risk", factura: "invalid", consistency: "major" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminVerifyPanel({ transactionId }: Props) {
  // Signal dropdowns
  const [theft, setTheft] = useState<TheftSignal>("safe");
  const [factura, setFactura] = useState<FacturaSignal>("valid");
  const [consistency, setConsistency] = useState<ConsistencySignal>("consistent");

  // Derived status + manual override
  const autoStatus = deriveStatus(theft, factura, consistency);
  const [statusOverride, setStatusOverride] = useState<FinalStatus | "auto">("auto");
  const finalStatus: FinalStatus = statusOverride === "auto" ? autoStatus : statusOverride;

  // Notes — auto-generated, freely editable
  const [notes, setNotes] = useState<string>(() =>
    generateNotes("safe", "valid", "consistent", "safe")
  );
  const [notesEdited, setNotesEdited] = useState(false);

  // Toggles
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [autoNext, setAutoNext] = useState(false);

  // Submit state
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  // Ref to textarea — used to check focus in keyboard handler
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Stable refs for keyboard handler to read latest state without re-subscribing
  const finalStatusRef = useRef<FinalStatus>(finalStatus);
  const submitStateRef = useRef<SubmitState>(submitState);
  finalStatusRef.current = finalStatus;
  submitStateRef.current = submitState;

  // ── Notes sync ────────────────────────────────────────────────────────────

  const syncNotes = useCallback(
    (t: TheftSignal, f: FacturaSignal, c: ConsistencySignal, s: FinalStatus) => {
      if (!notesEdited) setNotes(generateNotes(t, f, c, s));
    },
    [notesEdited]
  );

  function handleTheft(v: TheftSignal) {
    setTheft(v);
    const derived = deriveStatus(v, factura, consistency);
    if (statusOverride === "auto") syncNotes(v, factura, consistency, derived);
  }

  function handleFactura(v: FacturaSignal) {
    setFactura(v);
    const derived = deriveStatus(theft, v, consistency);
    if (statusOverride === "auto") syncNotes(theft, v, consistency, derived);
  }

  function handleConsistency(v: ConsistencySignal) {
    setConsistency(v);
    const derived = deriveStatus(theft, factura, v);
    if (statusOverride === "auto") syncNotes(theft, factura, v, derived);
  }

  function handleNotesChange(v: string) {
    setNotes(v);
    setNotesEdited(true);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  // Returns the notes string synchronously (needed before state settles)
  function applyTemplate(preset: FinalStatus): string {
    const { theft: t, factura: f, consistency: c } = TEMPLATES[preset];
    setTheft(t);
    setFactura(f);
    setConsistency(c);
    setStatusOverride("auto");
    setNotesEdited(false);
    const generated = generateNotes(t, f, c, preset);
    setNotes(generated);
    return generated;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  // Accept optional overrides so we can call with template values before state settles
  async function submit(overrideStatus?: FinalStatus, overrideNotes?: string): Promise<void> {
    if (submitStateRef.current === "loading" || submitStateRef.current === "success") return;
    const status = overrideStatus ?? finalStatusRef.current;
    const body = overrideNotes ?? notes;
    setSubmitState("loading");

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, status, notes: body }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    }
  }

  function handleTemplate(preset: FinalStatus) {
    const generatedNotes = applyTemplate(preset);
    if (autoSubmit) {
      // Use preset + generated notes directly — state hasn't settled yet
      setTimeout(() => submit(preset, generatedNotes), 0);
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Scoped to console: disabled while textarea is focused.
  // Keys: 1 = Safe, 2 = Caution, 3 = High Risk, Enter = Submit, N = Next (post-submit)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Never intercept while typing in an input or textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;

      if (submitStateRef.current === "success") {
        // Post-submit: N = fetch next
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          document.getElementById("next-pending-btn")?.click();
        }
        return;
      }

      switch (e.key) {
        case "1":
          e.preventDefault();
          handleTemplate("safe");
          break;
        case "2":
          e.preventDefault();
          handleTemplate("caution");
          break;
        case "3":
          e.preventDefault();
          handleTemplate("high_risk");
          break;
        case "Enter":
          e.preventDefault();
          submit();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factura, theft, consistency, statusOverride, notesEdited, notes]);

  // ── Render guards ─────────────────────────────────────────────────────────

  const isSubmitted = submitState === "success";
  const isLoading = submitState === "loading";
  const canSubmit = !isSubmitted && !isLoading;

  // ── Post-submit state ─────────────────────────────────────────────────────

  if (isSubmitted) {
    return (
      <section className="border-t border-[var(--border)] py-6">
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
            Verification Console
          </p>
        </div>
        <p className="text-sm text-green-400 leading-relaxed mb-1">
          Submitted. User has been notified.
        </p>
        <p className="text-xs text-[var(--foreground-muted)] mb-2">
          Press <kbd className="font-mono bg-white/10 px-1 rounded">N</kbd> to open next
        </p>
        <NextPendingButton
          currentId={transactionId}
          autoRedirect={autoNext}
        />
      </section>
    );
  }

  // ── Active console ────────────────────────────────────────────────────────

  return (
    <section className="border-t border-[var(--border)] py-6">
      {/* Header row */}
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
          Verification Console
        </p>
        {/* Toggles */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSubmit}
              onChange={(e) => setAutoSubmit(e.target.checked)}
              className="w-3 h-3 accent-[var(--accent)]"
            />
            <span className="text-[10px] text-[var(--foreground-muted)]">Auto-submit</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoNext}
              onChange={(e) => setAutoNext(e.target.checked)}
              className="w-3 h-3 accent-[var(--accent)]"
            />
            <span className="text-[10px] text-[var(--foreground-muted)]">Auto-next</span>
          </label>
        </div>
      </div>

      <p className="text-xs text-[var(--foreground-muted)] mb-5">
        Use templates for fastest processing —{" "}
        <span className="font-mono">1</span> Safe ·{" "}
        <span className="font-mono">2</span> Caution ·{" "}
        <span className="font-mono">3</span> High Risk ·{" "}
        <span className="font-mono">↵</span> Submit
      </p>

      {/* One-click templates */}
      <div className="flex gap-2 mb-6">
        {(["safe", "caution", "high_risk"] as FinalStatus[]).map((preset, i) => (
          <button
            key={preset}
            onClick={() => handleTemplate(preset)}
            disabled={!canSubmit}
            title={`Shortcut: ${i + 1}`}
            className={`flex-1 text-xs font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-default ${
              preset === "safe"
                ? "border-green-700 text-green-400 hover:bg-green-950"
                : preset === "caution"
                ? "border-amber-700 text-amber-400 hover:bg-amber-950"
                : "border-red-800 text-red-400 hover:bg-red-950"
            }`}
          >
            {STATUS_LABELS[preset]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {/* Theft */}
        <div>
          <p className="text-xs text-[var(--foreground-muted)] mb-1">Theft (REPUVE)</p>
          <select
            value={theft}
            onChange={(e) => handleTheft(e.target.value as TheftSignal)}
            disabled={!canSubmit}
            className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 disabled:opacity-60"
          >
            {THEFT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Factura */}
        <div>
          <p className="text-xs text-[var(--foreground-muted)] mb-1">Factura</p>
          <select
            value={factura}
            onChange={(e) => handleFactura(e.target.value as FacturaSignal)}
            disabled={!canSubmit}
            className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 disabled:opacity-60"
          >
            {FACTURA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Consistency */}
        <div>
          <p className="text-xs text-[var(--foreground-muted)] mb-1">Document consistency</p>
          <select
            value={consistency}
            onChange={(e) => handleConsistency(e.target.value as ConsistencySignal)}
            disabled={!canSubmit}
            className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 disabled:opacity-60"
          >
            {CONSISTENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Final status */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-[var(--foreground-muted)]">Final status</p>
            <span className={`text-xs font-semibold ${STATUS_COLORS[finalStatus]}`}>
              {STATUS_LABELS[finalStatus]}
            </span>
          </div>
          <select
            value={statusOverride}
            onChange={(e) => setStatusOverride(e.target.value as FinalStatus | "auto")}
            disabled={!canSubmit}
            className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 disabled:opacity-60"
          >
            <option value="auto">Auto — {STATUS_LABELS[autoStatus]}</option>
            {FINAL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>Override — {o.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-[var(--foreground-muted)]">Notes</p>
            {notesEdited && (
              <button
                onClick={() => {
                  setNotesEdited(false);
                  setNotes(generateNotes(theft, factura, consistency, finalStatus));
                }}
                className="text-[10px] text-[var(--foreground-muted)] hover:text-white transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            disabled={!canSubmit}
            rows={4}
            className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 resize-none disabled:opacity-60 leading-relaxed"
          />
        </div>
      </div>

      {/* Error */}
      {submitState === "error" && (
        <p className="text-xs text-red-400 mt-3">
          Submission failed. Check your connection and try again.
        </p>
      )}

      {/* Submit */}
      <button
        onClick={() => submit()}
        disabled={!canSubmit}
        className={`mt-4 w-full text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left ${
          !canSubmit
            ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
            : "bg-[var(--accent)] hover:bg-blue-600 text-white cursor-pointer"
        }`}
      >
        {isLoading ? "Submitting…" : "Submit verification"}
      </button>
    </section>
  );
}
