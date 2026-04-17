"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import { useTransaction } from "@/context/TransactionContext";
import { STEPS, Step, MaintenanceRecordType, getSteps } from "@/lib/types";
import type { VerificationResult } from "@/lib/types";
import AnalyzePanel from "@/components/panels/AnalyzePanel";
import { generateAgreementHTML } from "@/lib/agreement";
import RiskBlock from "@/components/RiskBlock";
import { computeRisk, confidenceLabel, type RiskOutput } from "@/lib/risk";
import { track } from "@/lib/track";
import { hasMinimumInput as computeHasMinimumInput } from "@/lib/guards";

type StepContent = {
  heading: string;
  body: string;
  action: string;
  completedAction: string;
  contextLine?: string;
};

const stepContent: Record<Step, StepContent> = {
  upload: {
    heading: "Start your vehicle verification",
    body: "Upload the required documents so we can verify the vehicle, ownership, and risk before you proceed with payment.",
    action: "Upload documents to begin",
    completedAction: "Step completed",
    contextLine: "Most issues are discovered after payment. This step helps you avoid that.",
  },
  check: {
    heading: "Initial risk check",
    body: "We scan the documents and listing for common red flags before deeper analysis.",
    action: "Continue to risk analysis",
    completedAction: "Step completed",
  },
  // "analyze" is handled by AnalyzePanel — these values are never rendered
  analyze: { heading: "", body: "", action: "", completedAction: "" },
  // "verify" is handled by VerifyInterface — these values are never rendered
  verify:  { heading: "", body: "", action: "", completedAction: "" },
  // "complete" is handled by CompleteInterface — these values are never rendered
  complete: { heading: "", body: "", action: "", completedAction: "" },
};

// ─── Verify ──────────────────────────────────────────────────────────────────

// ── Verification result types (local, mirrors backend shape) ─────────────────

type RepuveCheck = {
  ok: boolean;
  data?: { theft: boolean; status: string };
  error?: string;
};

type FacturaCheck = {
  ok: boolean;
  data?: { valid: boolean; status: string };
  error?: string;
};

type VerifyChecks = {
  repuve: RepuveCheck;
  factura: FacturaCheck;
};

type MappedCheck = { status: "success" | "warning" | "unavailable"; text: string };

function mapRepuve(check: RepuveCheck): MappedCheck {
  if (!check.ok) return { status: "unavailable", text: "Registry check unavailable" };
  if (check.data?.theft) return { status: "warning", text: "Potential theft record detected" };
  return { status: "success", text: "No theft record found in official registry" };
}

function mapFactura(check: FacturaCheck): MappedCheck | null {
  if (check.error === "not_provided") return null;
  if (!check.ok) return { status: "unavailable", text: "Invoice validation unavailable" };
  if (!check.data?.valid) return { status: "warning", text: "Invoice is not valid or has been cancelled" };
  return { status: "success", text: "Invoice is valid (SAT verified)" };
}

function checksToVerificationResult(checks: VerifyChecks): VerificationResult {
  const theft = checks.repuve.ok && checks.repuve.data?.theft === true;
  const facturaInvalid = checks.factura.ok && checks.factura.data?.valid === false;
  const findings: string[] = [];

  if (!checks.repuve.ok) findings.push("REPUVE check could not be completed");
  else if (theft) findings.push("Theft record detected in REPUVE");
  else findings.push("No theft record found in REPUVE");

  if (checks.factura.error !== "not_provided") {
    if (!checks.factura.ok) findings.push("Factura validation could not be completed");
    else if (facturaInvalid) findings.push("Invoice validation failed");
    else findings.push("Invoice validated successfully");
  }

  return {
    status: theft ? "high_risk" : facturaInvalid ? "review" : "safe",
    summary: theft
      ? "Potential theft record detected. Proceed with caution."
      : facturaInvalid
      ? "Invoice concern detected. Verify with seller."
      : "No major issues detected.",
    findings,
    confidence: theft ? 90 : facturaInvalid ? 72 : 85,
  };
}

function VerifyInterface({ plan }: { plan: "49" | "79" | null }) {
  const {
    transaction,
    advanceStep,
    goToStep,
    acceptRisk,
    requestBasicVerification,
    completeBasicVerification,
    requestProfessionalVerification,
    completeProfessionalVerification,
    resetVerification,
  } = useTransaction();

  const { verification_status, documents, vehicle } = transaction;
  const identifier = vehicle.vin || vehicle.plate;
  const [showDocWarning, setShowDocWarning] = useState(false);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [verifyChecks, setVerifyChecks] = useState<VerifyChecks | null>(null);
  const [verifyError, setVerifyError] = useState(false);
  const [verifyMode, setVerifyMode] = useState<"manual" | "automated" | null>(null);
  // Upgrade delta: snapshot of risk at the moment the user clicks upgrade
  const [previousRisk, setPreviousRisk] = useState<RiskOutput | null>(null);
  // Brief confirmation flash after the user commits to a risk level
  const [decisionRecorded, setDecisionRecorded] = useState(false);

  // Global input gate — single source of truth from lib/guards
  const uploadedDocsCount = Object.values(documents).filter(d => d.status === "uploaded").length;
  const hasIdentifier = Boolean(identifier);
  const hasDocs = uploadedDocsCount > 0;
  const hasMinimumInput = computeHasMinimumInput(transaction);

  const allDocumentsUploaded =
    documents.ine.status === "uploaded" &&
    documents.registration.status === "uploaded" &&
    documents.invoice.status === "uploaded";

  // Single source of truth for risk — same output used in all result states
  const risk = computeRisk(transaction);

  // Auto-trigger verification on mount based on plan.
  // Handles both first arrival and post-upgrade ($49 → $79).
  useEffect(() => {
    if (!plan) return;
    // Guard: do not auto-retrigger while in error state — user must click Retry
    if (verifyError) return;

    const shouldRunProfessional =
      plan === "79" &&
      (verification_status === "not_started" || verification_status === "basic_complete");
    const shouldRunBasic =
      plan === "49" && verification_status === "not_started";

    if (!shouldRunProfessional && !shouldRunBasic) return;

    // Hard guard: no identifier → no API call, no state transition
    if (!identifier) return;

    if (shouldRunProfessional) requestProfessionalVerification();
    else requestBasicVerification();

    // Call real verification API
    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate: identifier }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { success: boolean; mode?: string; checks: VerifyChecks }) => {
        const mode = data.mode === "manual" ? "manual" : "automated";
        setVerifyMode(mode);

        if (mode === "manual") {
          // Manual mode: result is under review — status "review" maps to MODERATE,
          // preventing a false LOW/green badge while confidence is 0.
          const manualResult: VerificationResult = {
            status: "review",
            summary: "Manual verification in progress.",
            findings: [],
            confidence: 0,
          };
          if (shouldRunProfessional) completeProfessionalVerification(manualResult);
          else completeBasicVerification(manualResult);
          return;
        }

        const checks = data.checks;
        setVerifyChecks(checks);
        const result = checksToVerificationResult(checks);
        if (shouldRunProfessional) completeProfessionalVerification(result);
        else completeBasicVerification(result);
      })
      .catch(() => {
        resetVerification();
        setVerifyError(true);
      });
  }, [identifier, verification_status, verifyError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to top once when verification reaches a decision state.
  useEffect(() => {
    if (
      verification_status === "basic_complete" ||
      verification_status === "professional_complete"
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [verification_status]);

  async function handleUpsell() {
    if (!allDocumentsUploaded) {
      setShowDocWarning(true);
      return;
    }
    setShowDocWarning(false);
    track("upgrade_clicked");
    // Snapshot the current risk before upgrade so we can show what changed afterward
    setPreviousRisk(risk);
    setUpsellLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", transactionId: transaction.id }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? "No checkout URL");
      window.location.href = url;
    } catch (err) {
      console.error("[upsell] failed:", err);
      setUpsellLoading(false);
    }
  }

  // Docs-only verification — called manually via CTA when hasDocs && !hasIdentifier
  async function startDocVerification() {
    if (!plan) return;
    const shouldRunProfessional =
      plan === "79" &&
      (verification_status === "not_started" || verification_status === "basic_complete");
    const shouldRunBasic = plan === "49" && verification_status === "not_started";
    if (!shouldRunProfessional && !shouldRunBasic) return;

    if (shouldRunProfessional) requestProfessionalVerification();
    else requestBasicVerification();

    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasDocuments: true }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { success: boolean; mode?: string; checks: VerifyChecks }) => {
        const mode = data.mode === "manual" ? "manual" : "automated";
        setVerifyMode(mode);
        if (mode === "manual") {
          const manualResult: VerificationResult = {
            status: "review",
            summary: "Manual verification in progress.",
            findings: [],
            confidence: 0,
          };
          if (shouldRunProfessional) completeProfessionalVerification(manualResult);
          else completeBasicVerification(manualResult);
          return;
        }
        const checks = data.checks;
        setVerifyChecks(checks);
        const result = checksToVerificationResult(checks);
        if (shouldRunProfessional) completeProfessionalVerification(result);
        else completeBasicVerification(result);
      })
      .catch(() => {
        resetVerification();
        setVerifyError(true);
      });
  }

  // ── No plan — should not happen in normal flow ───────────────────────────
  if (!plan) {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Verification required
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
          A verification plan is required to run checks on this vehicle.
        </p>
        <a
          href="/start"
          className="inline-block w-full bg-[var(--accent)] text-white text-sm font-medium px-5 py-3 rounded-lg text-center hover:opacity-90 transition-opacity"
        >
          View plans →
        </a>
      </>
    );
  }

  // ── No input at all — hard stop, no escape hatch ───────────────────────
  if (!hasMinimumInput) {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Add vehicle information to continue.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Verification requires at least a VIN, plate number, or one uploaded
          document. Without this, no checks can be performed.
        </p>
        <button
          onClick={() => goToStep("upload")}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
        >
          ← Back to Upload
        </button>
      </>
    );
  }

  // ── Verification error — show retry, do NOT auto-advance ────────────────
  if (verifyError) {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Verification could not complete.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Something went wrong. Check your connection and try again.
        </p>
        <button
          onClick={() => setVerifyError(false)}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left mb-3"
        >
          Retry verification
        </button>
        <button
          onClick={() => goToStep("upload")}
          className="text-xs text-[var(--foreground-muted)] hover:text-white transition-colors underline underline-offset-2"
        >
          ← Back to Upload
        </button>
      </>
    );
  }

  // ── Docs only, not started — manual CTA (no identifier for registry lookup) ─
  if (!hasIdentifier && hasDocs && verification_status === "not_started") {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Ready to verify your documents.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          We&apos;ll verify using your uploaded documents. Adding a VIN or plate
          number improves accuracy and enables registry checks.
        </p>
        <button
          onClick={startDocVerification}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left mb-3"
        >
          Start verification
        </button>
        <button
          onClick={() => goToStep("upload")}
          className="text-xs text-[var(--foreground-muted)] hover:text-white transition-colors underline underline-offset-2"
        >
          ← Back to Upload to add VIN/plate
        </button>
      </>
    );
  }

  // ── not_started with identifier — useEffect auto-triggers ────────────────
  if (verification_status === "not_started") {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Running verification checks.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Checking registry sources and document data.
        </p>
        <div className="border border-[var(--border)] rounded-lg px-5 py-4">
          <p className="text-sm text-[var(--foreground-muted)]">
            Initializing — do not close this page.
          </p>
        </div>
      </>
    );
  }

  // ── Processing states ────────────────────────────────────────────────────
  if (verification_status === "basic_processing") {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Verifying this deal
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Checking REPUVE, outstanding liabilities, factura validity, and VIN
          registry. This will take a moment.
        </p>
        <div className="border border-[var(--border)] rounded-lg px-5 py-4">
          <p className="text-sm text-[var(--foreground-muted)]">
            Running official vehicle checks — do not close this page.
          </p>
        </div>
      </>
    );
  }

  if (verification_status === "professional_processing") {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Running full verification checks
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Verifying identity, documents, ownership, and running advanced fraud pattern checks.
        </p>
        <div className="border border-[var(--border)] rounded-lg px-5 py-4">
          <p className="text-sm text-[var(--foreground-muted)]">
            Running official vehicle checks — do not close this page.
          </p>
        </div>
      </>
    );
  }

  // ── Basic complete — show results + upsell ($49 users only) ─────────────
  if (verification_status === "basic_complete") {
    const repuveResult = verifyChecks ? mapRepuve(verifyChecks.repuve) : null;
    const facturaResult = verifyChecks ? mapFactura(verifyChecks.factura) : null;
    const allUnavailable =
      (!repuveResult || repuveResult.status === "unavailable") &&
      (!facturaResult || facturaResult.status === "unavailable");

    return (
      <>
        {/* Decision heading */}
        <h2 className="text-lg font-semibold text-white mb-2 leading-snug">
          Make your decision.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          These results reflect registry data and document checks.
          Review carefully before proceeding.
        </p>

        {/* Risk position — single source of truth */}
        <RiskBlock data={risk} headerLabel="You are about to proceed with" />

        {/* Results section — manual message or real check results */}
        {verifyMode === "manual" ? (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
              Verification results
            </p>
            <p className="text-sm font-medium leading-relaxed text-[var(--foreground-muted)]">
              Expert review in progress.
            </p>
            <p className="text-sm leading-relaxed text-[var(--foreground-muted)] mt-1">
              Our team will review your documents. You&apos;ll receive results within 24 hours.
            </p>
          </div>
        ) : (
          <>
            {(repuveResult || facturaResult) && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
                  Verification results
                </p>

                {allUnavailable ? (
                  <div className="mb-2">
                    <p className="text-sm font-medium leading-relaxed text-[var(--foreground-muted)]">
                      Checks could not be completed at this time.
                    </p>
                  </div>
                ) : (
                  <>
                    {repuveResult && (
                      <div className="mb-2">
                        <p className={`text-sm font-medium leading-relaxed ${
                          repuveResult.status === "success" ? "text-green-400"
                          : repuveResult.status === "warning" ? "text-amber-400"
                          : "text-[var(--foreground-muted)]"
                        }`}>
                          REPUVE — {repuveResult.text}
                        </p>
                      </div>
                    )}
                    {facturaResult && (
                      <div className="mb-2">
                        <p className={`text-sm font-medium leading-relaxed ${
                          facturaResult.status === "success" ? "text-green-400"
                          : facturaResult.status === "warning" ? "text-amber-400"
                          : "text-[var(--foreground-muted)]"
                        }`}>
                          Factura — {facturaResult.text}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Upsell */}
        <div className="border border-white/[0.12] rounded-lg px-4 py-5 mb-4">
          <p className="text-sm font-medium text-white mb-2">
            Expert review available
          </p>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-4">
            Automated checks cover public records only. They cannot detect document
            alterations, confirm seller identity, or flag risks outside registry data.
          </p>
          <button
            onClick={handleUpsell}
            disabled={upsellLoading}
            className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left disabled:opacity-60"
          >
            {upsellLoading ? "Redirecting…" : "Upgrade to full verification — $30"}
          </button>
          {showDocWarning && (
            <p className="text-xs text-amber-400 leading-relaxed mt-3">
              Upload all required documents before upgrading.
            </p>
          )}
        </div>

        {decisionRecorded ? (
          <p className="text-sm text-green-400 leading-relaxed">
            ✓ Decision recorded.
          </p>
        ) : (
          <>
            <button
              onClick={() => {
                track("risk_accepted", { risk_level: risk.riskLevel, confidence: risk.confidence });
                acceptRisk(risk);
                setDecisionRecorded(true);
                setTimeout(advanceStep, 800);
              }}
              className="text-xs text-[var(--foreground-muted)] hover:text-white transition-colors underline underline-offset-2"
            >
              Proceed with this risk level
            </button>
            <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-2">
              You are proceeding based on automated checks only.
            </p>
          </>
        )}
      </>
    );
  }

  // ── Professional complete ────────────────────────────────────────────────
  if (verification_status === "professional_complete") {
    const repuveResult = verifyChecks ? mapRepuve(verifyChecks.repuve) : null;
    const facturaResult = verifyChecks ? mapFactura(verifyChecks.factura) : null;
    const allUnavailable =
      (!repuveResult || repuveResult.status === "unavailable") &&
      (!facturaResult || facturaResult.status === "unavailable");

    return (
      <>
        {/* Decision heading */}
        <h2 className="text-lg font-semibold text-white mb-2 leading-snug">
          Make your decision.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          These results reflect registry data and document checks.
          Review carefully before proceeding.
        </p>

        {/* Risk position — single source of truth */}
        <RiskBlock data={risk} headerLabel="You are about to proceed with" />

        {/* Results section */}
        {verifyMode === "manual" ? (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
              Expert review in progress
            </p>
            <p className="text-sm font-medium leading-relaxed text-[var(--foreground-muted)]">
              Our team will review your documents. You&apos;ll receive results within 24 hours.
            </p>
          </div>
        ) : (
          <>
            {(repuveResult || facturaResult) && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
                  Verification results
                </p>

                {allUnavailable ? (
                  <p className="text-sm font-medium leading-relaxed text-[var(--foreground-muted)]">
                    Checks could not be completed at this time.
                  </p>
                ) : (
                  <>
                    {repuveResult && (
                      <div className="mb-2">
                        <p className={`text-sm font-medium leading-relaxed ${
                          repuveResult.status === "success" ? "text-green-400"
                          : repuveResult.status === "warning" ? "text-amber-400"
                          : "text-[var(--foreground-muted)]"
                        }`}>
                          REPUVE — {repuveResult.text}
                        </p>
                      </div>
                    )}
                    {facturaResult && (
                      <div className="mb-2">
                        <p className={`text-sm font-medium leading-relaxed ${
                          facturaResult.status === "success" ? "text-green-400"
                          : facturaResult.status === "warning" ? "text-amber-400"
                          : "text-[var(--foreground-muted)]"
                        }`}>
                          Factura — {facturaResult.text}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Upgrade delta — only when user came from basic and we have a before snapshot */}
        {previousRisk && (() => {
          const newResolved = risk.resolved.filter(
            (item) => !previousRisk.resolved.includes(item)
          );
          const issuesCleared = previousRisk.issues.length > 0 && risk.issues.length === 0;
          const hasDelta = newResolved.length > 0 || issuesCleared;
          if (!hasDelta) return null;
          return (
            <div className="border border-green-400/20 bg-green-400/[0.06] rounded-lg px-4 py-4 mb-6">
              <p className="text-[10px] uppercase tracking-widest text-green-400 mb-3">
                What changed after full verification
              </p>
              {issuesCleared && (
                <p className="text-sm text-green-400 leading-relaxed mb-2">
                  ✓ No remaining issues after full verification
                </p>
              )}
              {newResolved.map((item) => (
                <p key={item} className="text-sm text-green-400 leading-relaxed">
                  ✓ {item}
                </p>
              ))}
            </div>
          );
        })()}

        {decisionRecorded ? (
          <p className="text-sm text-green-400 leading-relaxed">
            ✓ Decision recorded.
          </p>
        ) : (
          <button
            onClick={() => {
              track("risk_accepted", { risk_level: risk.riskLevel, confidence: risk.confidence });
              acceptRisk(risk);
              setDecisionRecorded(true);
              setTimeout(advanceStep, 800);
            }}
            className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
          >
            Proceed with this risk level
          </button>
        )}
      </>
    );
  }

  // Safety net — should never reach here, but guarantees no blank screen.
  return (
    <>
      <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
        Something went wrong.
      </h2>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
        An unexpected state was reached. Reload the page or go back to continue.
      </p>
      <button
        onClick={() => goToStep("upload")}
        className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
      >
        ← Back to Upload
      </button>
    </>
  );
}

// ─── Complete ────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function CompleteInterface({ plan }: { plan: "49" | "79" | null }) {
  const { transaction, generateContract, updateAgreementFields, addMaintenanceRecord, enableShare, revokeShare, sendForSignature } = useTransaction();
  const { contract, share } = transaction;

  const isBasic = plan === "49";

  // Agreement form state — pre-filled from persisted transaction
  const [buyerName,     setBuyerName]     = useState(transaction.buyer_name  ?? "");
  const [buyerEmail,    setBuyerEmail]    = useState(transaction.buyer_email ?? "");
  const [sellerName,    setSellerName]    = useState(transaction.seller_name ?? "");
  const [sellerEmail,   setSellerEmail]   = useState(transaction.seller_email ?? "");
  const [salePrice,     setSalePrice]     = useState(transaction.price    ?? "");
  const [saleLocation,  setSaleLocation]  = useState(transaction.location ?? "");

  const canGenerate =
    buyerName.trim() && buyerEmail.trim() &&
    sellerName.trim() && sellerEmail.trim() &&
    salePrice.trim() && saleLocation.trim();

  function handleGenerate() {
    updateAgreementFields({
      buyer_name:   buyerName.trim(),
      buyer_email:  buyerEmail.trim(),
      seller_name:  sellerName.trim(),
      seller_email: sellerEmail.trim(),
      price:        salePrice.trim(),
      location:     saleLocation.trim(),
    });
    generateContract();
    track("agreement_generated");
  }

  const [showForm, setShowForm] = useState(false);
  const [showMaintenanceSaved, setShowMaintenanceSaved] = useState(false);
  const [showShared, setShowShared] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [signingLoading, setSigningLoading] = useState(false);
  const [signingFallback, setSigningFallback] = useState(false);

  async function handleSendForSignature() {
    setSigningLoading(true);
    setSigningFallback(false);
    const date = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const agreement_html = generateAgreementHTML({
      id:           transaction.id,
      date,
      vehicle:      transaction.vehicle,
      buyer_name:   transaction.buyer_name,
      buyer_email:  transaction.buyer_email,
      seller_name:  transaction.seller_name,
      seller_email: transaction.seller_email,
      price:        transaction.price,
      location:     transaction.location,
    });
    try {
      const res = await fetch("/api/documenso/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_name:    transaction.buyer_name  ?? "",
          buyer_email:   transaction.buyer_email ?? "",
          seller_name:   transaction.seller_name ?? "",
          seller_email:  transaction.seller_email ?? "",
          agreement_html,
        }),
      });
      const data = await res.json();
      if (data.success && data.document_id) {
        sendForSignature(data.document_id);
      } else {
        // fallback: true or any unexpected shape — go to manual path
        setSigningFallback(true);
      }
    } catch {
      // Network failure — always fall back, never block
      setSigningFallback(true);
    } finally {
      setSigningLoading(false);
    }
  }

  function handleShare() {
    const token =
      share.token ??
      `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!share.enabled) {
      enableShare(token);
    }
    const storageKey = `transaction_${transaction.id}`;
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : transaction;
    const snapshot = {
      ...parsed,
      share: {
        enabled: true,
        token,
      },
    };
    localStorage.setItem(`share_${token}`, JSON.stringify(snapshot));
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setShareUrl(url);
    setShowShared(true);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleRevokeShare() {
    revokeShare();
    setShowShared(false);
  }

  async function handleDownloadAll() {
    const zip = new JSZip();

    type DocEntry = { fileData?: string; name?: string };
    type MaintenanceEntry = { fileData?: string; fileName?: string };

    // Documents
    (Object.values(transaction.documents) as DocEntry[]).forEach((doc) => {
      if (doc?.fileData) {
        zip.file(
          `documents/${doc.name}`,
          doc.fileData.split(",")[1],
          { base64: true }
        );
      }
    });

    // Maintenance records
    (transaction.maintenance.records as MaintenanceEntry[]).forEach((r) => {
      if (r.fileData) {
        zip.file(
          `maintenance/${r.fileName}`,
          r.fileData.split(",")[1],
          { base64: true }
        );
      }
    });

    // Metadata
    zip.file("metadata.json", JSON.stringify(transaction, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vehicle_record_${transaction.id}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function handleDownload() {
    const date = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const html = generateAgreementHTML({
      id:           transaction.id,
      date,
      vehicle:      transaction.vehicle,
      buyer_name:   transaction.buyer_name,
      buyer_email:  transaction.buyer_email,
      seller_name:  transaction.seller_name,
      seller_email: transaction.seller_email,
      price:        transaction.price,
      location:     transaction.location,
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to generate the document.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  // Single source of truth for risk in complete step
  const risk = computeRisk(transaction);

  const [recordType, setRecordType] = useState<MaintenanceRecordType>("service");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  function handleSave() {
    if (!title.trim() || !date) return;
    addMaintenanceRecord(recordType, title.trim(), date);
    setShowMaintenanceSaved(false);
    setShowMaintenanceSaved(true);
    setShowForm(false);
    setTitle("");
    setDate("");
    setRecordType("service");
  }

  return (
    <section className="py-8">
      <div className="mb-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
          Complete
        </span>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
        {isBasic ? "Your risk summary" : "Verification complete."}
      </h2>

      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
        {isBasic
          ? "Automated checks are complete. Generate a purchase agreement to proceed with the transaction."
          : "Full verification is complete. Generate a purchase agreement to finalize the transaction."}
      </p>

      {/* Risk block — only rendered after a real verified decision has been recorded */}
      {transaction.accepted_risk_level != null && (() => {
        const { accepted_risk_level, accepted_confidence, accepted_at } = transaction;
        const displayRisk: RiskOutput = {
          ...risk,
          riskLevel: accepted_risk_level!,
          confidence: accepted_confidence ?? risk.confidence,
          confidenceLabel: confidenceLabel(accepted_confidence ?? risk.confidence),
        };
        return (
          <>
            <RiskBlock
              data={displayRisk}
              headerLabel="You chose to proceed with"
            />
            {accepted_at && (
              <p className="text-xs text-[var(--foreground-muted)] -mt-4 mb-6">
                Decision recorded {timeAgo(accepted_at)}
              </p>
            )}
          </>
        );
      })()}

      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
        You are proceeding based on the results above.
        Make sure both parties understand and accept the terms before signing.
      </p>

      {isBasic && (
        <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-4 mb-6">
          <p className="text-xs text-amber-400 leading-relaxed">
            This report covers public records only. Proceed at your own risk, or upgrade for expert review.
          </p>
        </div>
      )}

      <p className="text-sm text-white mb-6">
        You are ready to proceed with this transaction.
      </p>

      {contract.status === "generated" ? (
        <>
          <p className="text-sm text-[var(--foreground-muted)] mb-2">
            Purchase agreement generated
          </p>
          <button onClick={handleDownload} className="text-sm text-white underline mb-4">
            Download purchase agreement
          </button>

          {/* E-signature — Documenso */}
          <div className="mb-6">
            {/* Fallback: signature service unavailable — manual path */}
            {signingFallback ? (
              <div className="border border-[var(--border)] rounded-lg px-4 py-4">
                <p className="text-sm text-white mb-1">
                  Signature service unavailable right now.
                </p>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-3">
                  Download the agreement and sign it manually to proceed.
                  You can still complete this transaction without delay.
                </p>
                <button
                  onClick={handleDownload}
                  className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
                >
                  Download agreement to sign manually
                </button>
              </div>
            ) : (
              <>
                {(!transaction.signing_status || transaction.signing_status === "not_sent") && (
                  <button
                    onClick={handleSendForSignature}
                    disabled={signingLoading}
                    className={`w-full text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left ${
                      signingLoading
                        ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                        : "bg-[var(--background)] border border-[var(--border)] hover:border-white/30 text-white"
                    }`}
                  >
                    {signingLoading ? "Sending…" : "Send for signature"}
                  </button>
                )}
                {transaction.signing_status === "pending" && (
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Waiting for signatures
                  </p>
                )}
              </>
            )}
          </div>

          <div className="mb-8">
            <button
              onClick={handleShare}
              className="text-sm text-[var(--accent)] hover:text-blue-400 transition-colors"
            >
              Share verified transaction
            </button>
            <p className="text-sm text-gray-400 mt-1">
              Anyone with this link can view the verification and contract
            </p>
            {showShared && (
              <>
                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-3">
                  Link copied. You can now share this transaction.
                </p>
                <div className="flex gap-4 mt-2">
                  <button
                    onClick={() => window.open(shareUrl, "_blank")}
                    className="text-sm text-blue-400 underline"
                  >
                    Open link
                  </button>
                  <button
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, "_blank")}
                    className="text-sm text-green-400 underline"
                  >
                    Share via WhatsApp
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            Agreement details
          </p>
          <div className="flex flex-col gap-3 mb-4">
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Buyer full name</p>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Full legal name"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Buyer email</p>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="buyer@email.com"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Seller full name</p>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Full legal name"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Seller email</p>
              <input
                type="email"
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                placeholder="seller@email.com"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Sale price (MXN)</p>
              <input
                type="text"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="e.g. 120,000"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">City / State</p>
              <input
                type="text"
                value={saleLocation}
                onChange={(e) => setSaleLocation(e.target.value)}
                placeholder="e.g. Ciudad de México, CDMX"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
          </div>
          <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-3">
            Both parties should review and confirm all details before signing.
          </p>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`w-full text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left ${
              !canGenerate
                ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                : "bg-[var(--accent)] hover:bg-blue-600 text-white"
            }`}
          >
            Generate purchase agreement
          </button>
        </div>
      )}

      <div className="mb-8">
        <button
          onClick={handleDownloadAll}
          className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors"
        >
          Download full vehicle record (.zip)
        </button>
      </div>

      {showForm ? (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            Add Maintenance
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Type</p>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as MaintenanceRecordType)}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2"
              >
                <option value="service">Service</option>
                <option value="repair">Repair</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Title</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Oil change"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-1">Date</p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !date}
            className={`mt-4 w-full text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left ${
              !title.trim() || !date
                ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                : "bg-[var(--accent)] hover:bg-blue-600 text-white cursor-pointer"
            }`}
          >
            Save record
          </button>
        </div>
      ) : (
        <>
          {showMaintenanceSaved && (
            <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-3">
              Maintenance record saved.
            </p>
          )}
          <button
            onClick={() => { setShowForm(true); setShowMaintenanceSaved(false); }}
            className="text-sm text-[var(--accent)] hover:text-blue-400 transition-colors"
          >
            Add maintenance record
          </button>
        </>
      )}
    </section>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function AIInterface({ plan }: { plan: "49" | "79" | null }) {
  const { transaction, advanceStep, goToStep, returnedToStep, updateVehicle } = useTransaction();
  const { current_step } = transaction;
  // Use plan-aware step list so Basic users at "complete" go back to "analyze" not "verify"
  const planSteps = getSteps(plan);
  const currentIndex = planSteps.findIndex((s) => s.key === current_step);

  const prevStep = currentIndex > 0 ? planSteps[currentIndex - 1] : null;

  const backLink = prevStep ? (
    <div className="pt-6 pb-1">
      <button
        onClick={() => goToStep(prevStep.key)}
        className="text-xs text-[var(--foreground-muted)] hover:text-white transition-colors"
      >
        ← Back to {prevStep.label}
      </button>
    </div>
  ) : null;

  const changesBanner = returnedToStep === current_step ? (
    <div className="mt-3 mb-1 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
      <p className="text-xs text-amber-400 leading-relaxed">
        Changes detected. Verification will restart from this step.
      </p>
    </div>
  ) : null;

  // ── Upload — vehicle info form + document state CTA ─────────────────────
  if (current_step === "upload") {
    const uploadedDocs = Object.values(transaction.documents).filter(
      (d) => d.status === "uploaded"
    ).length;
    const allUploaded = uploadedDocs === 3;
    const noneUploaded = uploadedDocs === 0;

    const { vehicle } = transaction;
    const vehicleComplete =
      vehicle.make.trim() !== "" &&
      vehicle.model.trim() !== "" &&
      vehicle.year > 0;
    const hasIdentifier = !!(vehicle.vin || vehicle.plate);
    const hasDocs = !noneUploaded;
    const hasMinimumInput = computeHasMinimumInput(transaction);
    const canContinue = hasMinimumInput;

    return (
      <>
        {backLink}
        {changesBanner}
        <section className="py-8">
          <div className="mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
              Upload
            </span>
          </div>

          <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
            Tell us about the vehicle and upload the required documents.
          </h2>

          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
            We need basic vehicle details and the seller&apos;s documents to run
            verification. The more complete your upload, the more accurate your
            risk report.
          </p>

          {/* Vehicle info */}
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
            Vehicle details
          </p>
          <div className="flex flex-col gap-3 mb-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-xs text-[var(--foreground-muted)] mb-1">Make</p>
                <input
                  type="text"
                  defaultValue={vehicle.make}
                  onBlur={(e) => updateVehicle({ make: e.target.value.trim() })}
                  placeholder="e.g. Nissan"
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[var(--foreground-muted)] mb-1">Model</p>
                <input
                  type="text"
                  defaultValue={vehicle.model}
                  onBlur={(e) => updateVehicle({ model: e.target.value.trim() })}
                  placeholder="e.g. Sentra"
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="w-24">
                <p className="text-xs text-[var(--foreground-muted)] mb-1">Year</p>
                <input
                  type="number"
                  defaultValue={vehicle.year || ""}
                  onBlur={(e) => {
                    const y = parseInt(e.target.value, 10);
                    if (y > 1900 && y <= new Date().getFullYear() + 1) {
                      updateVehicle({ year: y });
                    }
                  }}
                  placeholder="2020"
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-xs text-[var(--foreground-muted)] mb-1">
                  VIN <span className="normal-case opacity-60">(recommended)</span>
                </p>
                <input
                  type="text"
                  defaultValue={vehicle.vin ?? ""}
                  onBlur={(e) => updateVehicle({ vin: e.target.value.trim() || undefined })}
                  placeholder="17-character VIN"
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)] font-mono focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[var(--foreground-muted)] mb-1">
                  Plate <span className="normal-case opacity-60">(recommended)</span>
                </p>
                <input
                  type="text"
                  defaultValue={vehicle.plate ?? ""}
                  onBlur={(e) => updateVehicle({ plate: e.target.value.trim() || undefined })}
                  placeholder="e.g. ABC-123-D"
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-white text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)] font-mono focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-8">
            Adding a VIN or plate allows theft and registry checks. Without it,
            your results will be limited.
          </p>

          {/* Document upload progress */}
          {uploadedDocs > 0 && !allUploaded && (
            <div className="border border-[var(--border)] rounded-lg px-4 py-3 mb-6">
              <p className="text-xs text-[var(--foreground-muted)]">
                {uploadedDocs} of 3 documents uploaded — missing documents will
                appear as unknowns in your report.
              </p>
            </div>
          )}

          {/* Warning: no identifier — non-blocking, shown once minimum input is met */}
          {hasDocs && !hasIdentifier && (
            <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-3 mb-4">
              <p className="text-xs text-amber-400 leading-relaxed">
                Proceeding without a VIN or plate will reduce verification
                accuracy. Registry and theft checks will not run.
              </p>
            </div>
          )}

          {/* Hard gate warning — shown only when nothing has been provided */}
          {!hasMinimumInput && (
            <div className="border border-[var(--border)] rounded-lg px-4 py-3 mb-4">
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                Add a VIN/plate or upload at least one document to continue.
              </p>
            </div>
          )}

          <button
            onClick={advanceStep}
            disabled={!canContinue}
            className={`w-full text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left mb-3 ${
              !canContinue
                ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                : "bg-[var(--accent)] hover:bg-blue-600 text-white"
            }`}
          >
            {!hasMinimumInput
              ? "Add a VIN/plate or document to continue"
              : !hasIdentifier
              ? "Continue — registry checks limited without VIN/plate"
              : allUploaded
              ? "Continue"
              : "Continue"}
          </button>

          {vehicleComplete && !allUploaded && uploadedDocs > 0 && (
            <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
              You can add more documents later to improve your results.
            </p>
          )}
        </section>
      </>
    );
  }

  if (current_step === "check") {
    const { vehicle: cv, documents: cd } = transaction;
    const checkUploadedDocs = Object.values(cd).filter(d => d.status === "uploaded").length;
    const checkHasIdentifier = !!(cv.vin || cv.plate);
    const checkHasDocs = checkUploadedDocs > 0;
    const checkHasMinimumInput = computeHasMinimumInput(transaction);
    const checkContent = stepContent["check"];

    return (
      <>
        {backLink}
        {changesBanner}
        <section className="py-8">
          <div className="mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
              {planSteps[currentIndex]?.label}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
            {checkContent.heading}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
            {checkContent.body}
          </p>
          {!checkHasMinimumInput && (
            <p className="text-sm text-amber-400 leading-relaxed mb-4">
              We need at least a VIN, plate, or one uploaded document to analyze
              this vehicle.
            </p>
          )}
          <button
            onClick={() => { if (checkHasMinimumInput) advanceStep(); }}
            disabled={!checkHasMinimumInput}
            className={`w-full text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left ${
              !checkHasMinimumInput
                ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                : "bg-[var(--accent)] hover:bg-blue-600 text-white"
            }`}
          >
            {checkContent.action}
          </button>
        </section>
      </>
    );
  }

  if (current_step === "analyze") {
    return (
      <>
        {backLink}
        {changesBanner}
        <section className="py-8">
          <div className="mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
              {planSteps[currentIndex]?.label}
            </span>
          </div>
          <AnalyzePanel plan={plan} />
        </section>
      </>
    );
  }

  if (current_step === "verify") {
    return (
      <>
        {backLink}
        {changesBanner}
        <section className="py-8">
          <div className="mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
              Verify
            </span>
          </div>
          <VerifyInterface plan={plan} />
        </section>
      </>
    );
  }

  if (current_step === "complete") {
    return (
      <>
        {backLink}
        {changesBanner}
        <CompleteInterface plan={plan} />
      </>
    );
  }

  // Safety net — all Step values are handled above; this is unreachable in practice.
  return (
    <>
      {backLink}
      <section className="py-8">
        <p className="text-sm text-[var(--foreground-muted)]">
          Something went wrong. Reload the page or go back.
        </p>
        <button
          onClick={() => goToStep("upload")}
          className="mt-4 w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
        >
          ← Back to Upload
        </button>
      </section>
    </>
  );
}
