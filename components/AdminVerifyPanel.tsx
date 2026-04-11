"use client";

/**
 * AdminVerifyPanel — internal tool for manual verification submission.
 *
 * Shown only when:
 *   - VERIFICATION_MODE === "manual"   (checked server-side, passed as prop)
 *   - User is authenticated            (checked server-side, passed as prop)
 *   - Admin result not yet submitted   (adminStatus === "pending")
 *
 * MVP: any authenticated user can submit. No role system yet.
 * Future: gate to admin role via middleware or policy.
 */

import { useState } from "react";

type AdminStatus = "safe" | "caution" | "high_risk";

type Props = {
  transactionId: string;
};

const STATUS_OPTIONS: { value: AdminStatus; label: string }[] = [
  { value: "safe", label: "Safe" },
  { value: "caution", label: "Caution" },
  { value: "high_risk", label: "High Risk" },
];

type SubmitState = "idle" | "loading" | "success" | "error";

export default function AdminVerifyPanel({ transactionId }: Props) {
  const [status, setStatus] = useState<AdminStatus>("safe");
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  async function handleSubmit() {
    if (!notes.trim()) return;
    setSubmitState("loading");

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, status, notes }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <section className="border-t border-[var(--border)] py-6">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
          Admin — Submit Verification
        </p>
      </div>

      {submitState === "success" ? (
        <p className="text-sm text-green-400 leading-relaxed">
          Verification submitted. User has been notified.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {/* Status select */}
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Result</p>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AdminStatus)}
                disabled={submitState === "loading"}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 disabled:opacity-60"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes textarea */}
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Notes</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitState === "loading"}
                rows={3}
                placeholder="Summary of findings..."
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)] resize-none disabled:opacity-60"
              />
            </div>
          </div>

          {submitState === "error" && (
            <p className="text-xs text-red-400 mt-3">
              Submission failed. Please try again.
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!notes.trim() || submitState === "loading"}
            className={`mt-4 w-full text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left ${
              !notes.trim() || submitState === "loading"
                ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                : "bg-[var(--accent)] hover:bg-blue-600 text-white cursor-pointer"
            }`}
          >
            {submitState === "loading" ? "Submitting…" : "Submit verification"}
          </button>
        </>
      )}
    </section>
  );
}
