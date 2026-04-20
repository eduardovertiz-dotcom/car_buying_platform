"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import { useTransaction } from "@/context/TransactionContext";
import { Step, MaintenanceRecordType, getSteps } from "@/lib/types";
import type { VerificationResult } from "@/lib/types";
import AnalyzePanel from "@/components/panels/AnalyzePanel";
import { generateAgreementHTML } from "@/lib/agreement";
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
    heading: "Start your vehicle check",
    body: "We need basic vehicle details and the seller's documents to run verification. The more complete your upload, the more accurate your risk report.",
    action: "Check this vehicle",
    completedAction: "Step completed",
    contextLine: "Most issues are discovered after payment. This step helps you avoid that.",
  },
  check: {
    heading: "Initial results",
    body: "We scan the vehicle details and documents for common red flags before deeper analysis.",
    action: "Review risk analysis",
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

type VerifyState = "idle" | "processing" | "error" | "complete";

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

function VerifyInterface({ plan }: { plan: "39" | "69" | null }) {
  const {
    transaction,
    advanceToStep,
    goToStep,
    acceptRisk,
    requestBasicVerification,
    completeBasicVerification,
    requestProfessionalVerification,
    completeProfessionalVerification,
    resetVerification,
    setStatus,
    isDecisionMade,
  } = useTransaction();

  const { verification_status, documents, vehicle } = transaction;
  const identifier = vehicle.vin || vehicle.plate;
  const [showDocWarning, setShowDocWarning] = useState(false);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [verifyChecks, setVerifyChecks] = useState<VerifyChecks | null>(null);
  const [verifyMode, setVerifyMode] = useState<"manual" | "automated" | "mock" | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>(() => {
    if (verification_status === "basic_complete" || verification_status === "professional_complete") return "complete";
    if (verification_status === "basic_processing" || verification_status === "professional_processing") return "processing";
    return "idle";
  });
  // Upgrade delta: snapshot of risk at the moment the user clicks upgrade
  const [previousRisk, setPreviousRisk] = useState<RiskOutput | null>(null);

  // isDecisionMade comes from context — driven by transaction.status === "decision_made"

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

  // Dev: log every state transition
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("VERIFY STATE:", verifyState, { verification_status });
    }
  }, [verifyState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger: fires only when idle + identifier present.
  // Docs-only path uses startDocVerification (manual CTA) instead.
  // Error state does NOT auto-retrigger — user must click Retry.
  // Decision lock: once accepted, never re-trigger.
  useEffect(() => {
    if (!plan) return;
    if (verifyState !== "idle") return;
    if (!identifier) return;
    if (isDecisionMade) return;

    const shouldRunProfessional =
      plan === "69" &&
      (verification_status === "not_started" || verification_status === "basic_complete");
    const shouldRunBasic = plan === "39" && verification_status === "not_started";

    if (!shouldRunProfessional && !shouldRunBasic) return;

    if (shouldRunProfessional) requestProfessionalVerification();
    else requestBasicVerification();
    setVerifyState("processing");

    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate: identifier }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { success?: boolean; status?: string; mode?: string; checks?: VerifyChecks }) => {
        if (data.status === "mock_complete") {
          setVerifyMode("mock");
          const mockResult: VerificationResult = {
            status: "review",
            summary: "Verification not yet available. Using preliminary analysis.",
            findings: [],
            confidence: 40,
          };
          if (shouldRunProfessional) completeProfessionalVerification(mockResult);
          else completeBasicVerification(mockResult);
          setVerifyState("complete");
          return;
        }
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
        } else {
          const checks = data.checks!;
          setVerifyChecks(checks);
          const result = checksToVerificationResult(checks);
          if (shouldRunProfessional) completeProfessionalVerification(result);
          else completeBasicVerification(result);
        }
        setVerifyState("complete");
      })
      .catch(() => {
        setVerifyState("error");
      });
  }, [verifyState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to top once when verification reaches a decision state.
  useEffect(() => {
    if (
      verification_status === "basic_complete" ||
      verification_status === "professional_complete"
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [verification_status]);

  async function handleDecision() {
    if (isDecisionMade) return;
    if (process.env.NODE_ENV === "development") {
      console.log("ACTION: DECISION_PROCEED", transaction.id);
    }

    if (process.env.NODE_ENV !== "development") {
      try {
        const res = await fetch(`/api/transactions/${transaction.id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "proceed" }),
        });
        if (!res.ok) {
          console.error("DECISION API FAILED", res.status);
          alert("Something went wrong. Please try again.");
          return;
        }
      } catch (err) {
        console.error("DECISION FETCH ERROR", err);
        alert("Something went wrong. Please try again.");
        return;
      }
    }

    track("risk_accepted", { risk_level: risk.riskLevel, confidence: risk.confidence });
    setStatus("decision_made");
    acceptRisk(risk);
    advanceToStep("complete");
  }

  async function handleUpsell() {
    if (isDecisionMade) return;
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
    if (isDecisionMade) return;
    const shouldRunProfessional =
      plan === "69" &&
      (verification_status === "not_started" || verification_status === "basic_complete");
    const shouldRunBasic = plan === "39" && verification_status === "not_started";
    if (!shouldRunProfessional && !shouldRunBasic) return;

    if (shouldRunProfessional) requestProfessionalVerification();
    else requestBasicVerification();
    setVerifyState("processing");

    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasDocuments: true }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { success?: boolean; status?: string; mode?: string; checks?: VerifyChecks }) => {
        if (data.status === "mock_complete") {
          setVerifyMode("mock");
          const mockResult: VerificationResult = {
            status: "review",
            summary: "Verification not yet available. Using preliminary analysis.",
            findings: [],
            confidence: 40,
          };
          if (shouldRunProfessional) completeProfessionalVerification(mockResult);
          else completeBasicVerification(mockResult);
          setVerifyState("complete");
          return;
        }
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
        } else {
          const checks = data.checks!;
          setVerifyChecks(checks);
          const result = checksToVerificationResult(checks);
          if (shouldRunProfessional) completeProfessionalVerification(result);
          else completeBasicVerification(result);
        }
        setVerifyState("complete");
      })
      .catch(() => {
        setVerifyState("error");
      });
  }

  // ── No plan — should not happen in normal flow ───────────────────────────
  if (!plan) {
    return (
      <>
        <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
          Verification required
        </h2>
        <p className="text-[18px] text-[#444] leading-relaxed mb-10">
          A verification plan is required to run checks on this vehicle.
        </p>
        <a
          href="/start"
          className="inline-block w-full bg-[#B4531A] text-white text-base font-semibold px-5 py-4 rounded-lg text-center hover:opacity-85 transition-opacity shadow-[0_4px_16px_rgba(180,83,26,.28)]"
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
        <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
          Add vehicle information to continue.
        </h2>
        <p className="text-[18px] text-[#444] leading-relaxed mb-8">
          Verification requires at least a VIN, plate number, or one uploaded
          document. Without this, no checks can be performed.
        </p>
        <button
          onClick={() => goToStep("upload")}
          className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)]"
        >
          ← Back to Upload
        </button>
      </>
    );
  }

  async function handleRetry() {
    if (process.env.NODE_ENV === "development") {
      console.log("ACTION: RETRY_VERIFICATION", transaction.id);
    }
    if (process.env.NODE_ENV === "development") {
      const mockResult = {
        status: "review" as const,
        summary: "Manual verification in progress. Expert review will be completed within 24 hours.",
        findings: [],
        confidence: 50,
      };
      setVerifyState("processing");
      if (plan === "69") requestProfessionalVerification();
      else requestBasicVerification();
      await new Promise((r) => setTimeout(r, 800));
      if (plan === "69") completeProfessionalVerification(mockResult);
      else completeBasicVerification(mockResult);
      setVerifyState("complete");
      return;
    }
    // Prod: reset context + go idle → auto-trigger effect re-runs
    resetVerification();
    setVerifyState("idle");
  }

  if (verifyState === "error") {
    return (
      <>
        <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
          Verification could not complete.
        </h2>
        <p className="text-[18px] text-[#444] leading-relaxed mb-8">
          Something went wrong. Check your connection and try again.
        </p>
        <button
          onClick={handleRetry}
          className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)] mb-3"
        >
          Retry verification
        </button>
        <button
          onClick={() => goToStep("upload")}
          className="text-[15px] text-[#666] hover:text-white transition-colors underline underline-offset-2"
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
        <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
          Ready to verify your documents.
        </h2>
        <p className="text-[18px] text-[#444] leading-relaxed mb-8">
          We&apos;ll verify using your uploaded documents. Adding a VIN or plate
          number improves accuracy and enables registry checks.
        </p>
        <button
          onClick={startDocVerification}
          className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)] mb-3"
        >
          Start verification
        </button>
        <button
          onClick={() => goToStep("upload")}
          className="text-[15px] text-[#666] hover:text-white transition-colors underline underline-offset-2"
        >
          ← Back to Upload to add VIN/plate
        </button>
      </>
    );
  }

  // ── Idle with identifier — auto-trigger effect fires immediately after mount ─
  if (verifyState === "idle" && hasIdentifier) {
    return (
      <>
        <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
          Running verification checks.
        </h2>
        <p className="text-[18px] text-[#444] leading-relaxed mb-8">
          Checking registry sources and document data.
        </p>
        <div className="border border-[var(--border)] rounded-lg px-5 py-4">
          <p className="text-[15px] text-[var(--foreground-muted)]">
            Initializing — do not close this page.
          </p>
        </div>
      </>
    );
  }

  // ── Processing ────────────────────────────────────────────────────────────
  if (verifyState === "processing") {
    const isPro = plan === "69";
    return (
      <>
        <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
          {isPro ? "Running full verification checks" : "Verifying this deal"}
        </h2>
        <p className="text-[18px] text-[#444] leading-relaxed mb-8">
          {isPro
            ? "Verifying identity, documents, ownership, and running advanced fraud pattern checks."
            : "Checking REPUVE, outstanding liabilities, factura validity, and VIN registry. This will take a moment."}
        </p>
        <div className="border border-[var(--border)] rounded-lg px-5 py-4">
          <p className="text-[15px] text-[var(--foreground-muted)]">
            Running official vehicle checks — do not close this page.
          </p>
        </div>
      </>
    );
  }

  const verdictIsClean = risk.issues.length === 0 && risk.unknowns.length === 0;

  // ── Basic complete — show results + upsell ($49 users only) ─────────────
  if (verification_status === "basic_complete") {
    const repuveResult = verifyChecks ? mapRepuve(verifyChecks.repuve) : null;
    const facturaResult = verifyChecks ? mapFactura(verifyChecks.factura) : null;
    const allUnavailable =
      (!repuveResult || repuveResult.status === "unavailable") &&
      (!facturaResult || facturaResult.status === "unavailable");
    const hasVerifyIssues =
      repuveResult?.status === "warning" || facturaResult?.status === "warning";
    const verifyPillText = hasVerifyIssues
      ? "⚠ Issues detected"
      : allUnavailable || verifyMode === "manual"
      ? "Caution"
      : null;
    const verifyRecVariant = hasVerifyIssues ? "risk"
      : allUnavailable || verifyMode === "manual" ? "moderate"
      : "clear";
    const verifyRecText = verifyMode === "manual"
      ? "Expert review is in progress. Do not proceed until results are available."
      : hasVerifyIssues
      ? "Do not proceed until these issues are resolved with the seller."
      : allUnavailable
      ? "Registry checks were unavailable. Review documents carefully before proceeding."
      : "Registry checks passed. No issues found in official records.";

    return (
      <>
        {/* ── Report card ─────────────────────────────────────────── */}
        <div className="vr-wrap">
          {verifyPillText && (
            <div className={`vr-pill${hasVerifyIssues ? "" : " warn"}`}>{verifyPillText}</div>
          )}
          <div className="vr-card">
            <div className="vr-header">
              <span className="vr-title">Verification Report</span>
            </div>
            <div className="vr-body">

              {/* Outstanding issues — first */}
              {hasVerifyIssues && (
                <div className="vr-section">
                  <div className="vr-k">Outstanding issues</div>
                  {repuveResult?.status === "warning" && (
                    <div className="vr-row">
                      <span className="vr-row-label">Theft record detected in REPUVE</span>
                      <span className="vr-status s-risk">Theft</span>
                    </div>
                  )}
                  {facturaResult?.status === "warning" && (
                    <div className="vr-row">
                      <span className="vr-row-label">Ownership invoice failed SAT validation</span>
                      <span className="vr-status s-risk">Invalid</span>
                    </div>
                  )}
                </div>
              )}

              {/* Registry checks */}
              <div className="vr-section">
                <div className="vr-k">Registry checks</div>
                {verifyMode === "manual" ? (
                  <div className="vr-row">
                    <span className="vr-row-label">Expert review</span>
                    <span className="vr-status s-warn">In progress</span>
                  </div>
                ) : (
                  <>
                    {repuveResult && (
                      <div className="vr-row">
                        <span className="vr-row-label">Theft registry (REPUVE)</span>
                        <span className={`vr-status ${
                          repuveResult.status === "success" ? "s-ok"
                          : repuveResult.status === "warning" ? "s-risk" : "s-warn"
                        }`}>
                          {repuveResult.status === "success" ? "Clear"
                          : repuveResult.status === "warning" ? "Theft record" : "Unavailable"}
                        </span>
                      </div>
                    )}
                    {facturaResult && (
                      <div className="vr-row">
                        <span className="vr-row-label">Ownership invoice (SAT)</span>
                        <span className={`vr-status ${
                          facturaResult.status === "success" ? "s-ok"
                          : facturaResult.status === "warning" ? "s-risk" : "s-warn"
                        }`}>
                          {facturaResult.status === "success" ? "Valid"
                          : facturaResult.status === "warning" ? "Invalid" : "Unavailable"}
                        </span>
                      </div>
                    )}
                    {!repuveResult && !facturaResult && (
                      <div className="vr-row">
                        <span className="vr-row-label">Registry checks</span>
                        <span className="vr-status s-warn">Not available</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Document integrity */}
              <div className="vr-section">
                <div className="vr-k">Document integrity</div>
                <div className="vr-row">
                  <span className="vr-row-label">Ownership invoice (factura)</span>
                  <span className={`vr-status ${documents.invoice.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.invoice.status === "uploaded" ? "Submitted" : "Not provided"}
                  </span>
                </div>
                <div className="vr-row">
                  <span className="vr-row-label">Seller ID (INE)</span>
                  <span className={`vr-status ${documents.ine.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.ine.status === "uploaded" ? "Submitted" : "Not provided"}
                  </span>
                </div>
                <div className="vr-row">
                  <span className="vr-row-label">Registration card</span>
                  <span className={`vr-status ${documents.registration.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.registration.status === "uploaded" ? "Submitted" : "Not provided"}
                  </span>
                </div>
              </div>

              {/* Recommendation */}
              <div className={`vr-rec ${verifyRecVariant === "clear" ? "clear" : verifyRecVariant === "moderate" ? "moderate" : ""}`}>
                <div className="vr-rec-label">Recommendation</div>
                <p className="vr-rec-text">{verifyRecText}</p>
              </div>

            </div>
          </div>
        </div>

        {/* Upsell */}
        <div className="border border-[var(--border)] rounded-lg px-5 py-5 mb-6">
          <p className="text-[15px] font-semibold text-[var(--foreground)] mb-2">
            Expert review available
          </p>
          <p className="text-[14px] text-[#444] leading-relaxed mb-4">
            Automated checks cover public records only. They cannot detect document
            alterations, confirm seller identity, or flag risks outside registry data.
          </p>
          <button
            onClick={handleUpsell}
            disabled={upsellLoading}
            className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)] disabled:opacity-60 disabled:shadow-none"
          >
            {upsellLoading ? "Redirecting…" : "Upgrade to full verification — $30"}
          </button>
          {showDocWarning && (
            <p className="text-[13px] text-amber-400 leading-relaxed mt-3">
              Upload all required documents before upgrading.
            </p>
          )}
        </div>

        {isDecisionMade ? (
          <p className="text-sm text-green-400 leading-relaxed">
            ✓ Decision recorded.
          </p>
        ) : verdictIsClean ? (
          <button
            onClick={handleDecision}
            className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)]"
          >
            Proceed to agreement
          </button>
        ) : (
          <button
            onClick={handleDecision}
            className="text-[14px] text-[#666] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
          >
            Continue with automated results only
          </button>
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

    const hasVerifyIssues = repuveResult?.status === "warning" || facturaResult?.status === "warning";
    const verifyPillText = hasVerifyIssues ? "⚠ Issues detected"
      : allUnavailable || verifyMode === "manual" ? "Caution" : null;
    const verifyRecVariant = hasVerifyIssues ? "risk"
      : allUnavailable || verifyMode === "manual" ? "moderate" : "clear";
    const verifyRecText = verifyMode === "manual"
      ? "Expert review is in progress. Do not proceed until results are available."
      : hasVerifyIssues
      ? "Do not proceed until these issues are resolved with the seller."
      : allUnavailable
      ? "Registry checks were unavailable. Review documents carefully before proceeding."
      : "Registry checks passed. No issues found in official records.";

    return (
      <>
        {/* Report card */}
        <div className="vr-wrap">
          {verifyPillText && (
            <div className={`vr-pill${hasVerifyIssues ? "" : " warn"}`}>{verifyPillText}</div>
          )}
          <div className="vr-card">
            <div className="vr-header">
              <span className="vr-title">Verification Report</span>
            </div>
            <div className="vr-body">

              {/* Outstanding issues — first when present */}
              {hasVerifyIssues && (
                <div className="vr-section">
                  <div className="vr-k">Outstanding issues</div>
                  {repuveResult?.status === "warning" && (
                    <div className="vr-row">
                      <span className="vr-row-label">Theft record detected in REPUVE</span>
                      <span className="vr-status s-risk">Theft</span>
                    </div>
                  )}
                  {facturaResult?.status === "warning" && (
                    <div className="vr-row">
                      <span className="vr-row-label">Ownership invoice failed SAT validation</span>
                      <span className="vr-status s-risk">Invalid</span>
                    </div>
                  )}
                </div>
              )}

              {/* Registry checks */}
              <div className="vr-section">
                <div className="vr-k">Registry checks</div>
                {verifyMode === "manual" ? (
                  <div className="vr-row">
                    <span className="vr-row-label">Expert review</span>
                    <span className="vr-status s-warn">In progress</span>
                  </div>
                ) : (
                  <>
                    {repuveResult && (
                      <div className="vr-row">
                        <span className="vr-row-label">Theft registry (REPUVE)</span>
                        <span className={`vr-status ${
                          repuveResult.status === "success" ? "s-ok"
                          : repuveResult.status === "warning" ? "s-risk" : "s-warn"
                        }`}>
                          {repuveResult.status === "success" ? "Clear"
                          : repuveResult.status === "warning" ? "Theft record" : "Unavailable"}
                        </span>
                      </div>
                    )}
                    {facturaResult && (
                      <div className="vr-row">
                        <span className="vr-row-label">Ownership invoice (SAT)</span>
                        <span className={`vr-status ${
                          facturaResult.status === "success" ? "s-ok"
                          : facturaResult.status === "warning" ? "s-risk" : "s-warn"
                        }`}>
                          {facturaResult.status === "success" ? "Valid"
                          : facturaResult.status === "warning" ? "Invalid" : "Unavailable"}
                        </span>
                      </div>
                    )}
                    {!repuveResult && !facturaResult && (
                      <div className="vr-row">
                        <span className="vr-row-label">Registry checks</span>
                        <span className="vr-status s-warn">Not available</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Document integrity */}
              <div className="vr-section">
                <div className="vr-k">Document integrity</div>
                <div className="vr-row">
                  <span className="vr-row-label">Ownership invoice (factura)</span>
                  <span className={`vr-status ${documents.invoice.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.invoice.status === "uploaded" ? "Submitted" : "Not provided"}
                  </span>
                </div>
                <div className="vr-row">
                  <span className="vr-row-label">Seller ID (INE)</span>
                  <span className={`vr-status ${documents.ine.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.ine.status === "uploaded" ? "Submitted" : "Not provided"}
                  </span>
                </div>
                <div className="vr-row">
                  <span className="vr-row-label">Registration card</span>
                  <span className={`vr-status ${documents.registration.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.registration.status === "uploaded" ? "Submitted" : "Not provided"}
                  </span>
                </div>
              </div>

              {/* Recommendation */}
              <div className={`vr-rec ${verifyRecVariant === "clear" ? "clear" : verifyRecVariant === "moderate" ? "moderate" : ""}`}>
                <div className="vr-rec-label">Recommendation</div>
                <p className="vr-rec-text">{verifyRecText}</p>
              </div>

            </div>
          </div>
        </div>

        {/* Upgrade delta — only when user came from basic and we have a before snapshot */}
        {previousRisk && (() => {
          const newResolved = risk.resolved.filter(
            (item) => !previousRisk.resolved.includes(item)
          );
          const issuesCleared = previousRisk.issues.length > 0 && risk.issues.length === 0;
          const hasDelta = newResolved.length > 0 || issuesCleared;
          if (!hasDelta) return null;
          return (
            <div className="border border-green-400/20 bg-green-400/[0.06] rounded-lg px-4 py-5 mb-6">
              <p className="text-[11px] uppercase tracking-widest text-green-400 mb-3">
                What changed after full verification
              </p>
              {issuesCleared && (
                <p className="text-[15px] text-green-400 leading-relaxed mb-2">
                  ✓ No remaining issues after full verification
                </p>
              )}
              {newResolved.map((item) => (
                <p key={item} className="text-[15px] text-green-400 leading-relaxed">
                  ✓ {item}
                </p>
              ))}
            </div>
          );
        })()}

        {isDecisionMade ? (
          <p className="text-sm text-green-400 leading-relaxed">
            ✓ Decision recorded.
          </p>
        ) : verdictIsClean ? (
          <button
            onClick={handleDecision}
            className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)]"
          >
            Proceed to agreement
          </button>
        ) : (
          <>
            <button
              onClick={() => goToStep("upload")}
              className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)] mb-3"
            >
              Resolve issues before proceeding
            </button>
            <button
              onClick={handleDecision}
              className="text-[14px] text-[#666] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
            >
              Continue anyway
            </button>
          </>
        )}
      </>
    );
  }

  // Safety net — should never reach here, but guarantees no blank screen.
  return (
    <>
      <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
        Something went wrong.
      </h2>
      <p className="text-[18px] text-[#444] leading-relaxed mb-8">
        An unexpected state was reached. Reload the page or go back to continue.
      </p>
      <button
        onClick={() => goToStep("upload")}
        className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)]"
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

function CompleteInterface({ plan }: { plan: "39" | "69" | null }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { transaction, generateContract, updateAgreementFields, addMaintenanceRecord, enableShare, revokeShare, sendForSignature, goToStep } = useTransaction();
  const { contract, share } = transaction;

  const isBasic = plan === "39";

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
    // Write agreement_generated_at to DB (best-effort, non-blocking)
    fetch(`/api/transactions/${transaction.id}/agreement`, { method: "POST" }).catch(() => {});
  }

  const [showForm, setShowForm] = useState(false);
  const [showMaintenanceSaved, setShowMaintenanceSaved] = useState(false);
  const [showShared, setShowShared] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [signingLoading, setSigningLoading] = useState(false);
  const documensoEnabled = process.env.NEXT_PUBLIC_DOCUMENSO_ENABLED === "true";

  async function handleSendForSignature() {
    setSigningLoading(true);
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
        body: JSON.stringify({ transaction_id: transaction.id, agreement_html }),
      });
      const data = await res.json();
      if (data.success && data.signing_url) {
        window.open(data.signing_url, "_blank");
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
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
    const exportedAt = new Date().toISOString();
    const isoDate    = exportedAt.slice(0, 10);

    // Track every path added — used to build INDEX.json at the end
    const fileIndex: string[] = [];
    function addFile(path: string, content: string | ArrayBuffer) {
      zip.file(path, content);
      fileIndex.push(path);
    }

    // ── 00_overview/README.txt ────────────────────────────────────────────────
    const readme = [
      "MexGuardian Transaction Dossier",
      "================================",
      "",
      "This package contains the complete verified record of a vehicle transaction",
      "processed through MexGuardian. It is intended for the buyer, seller, and any",
      "advisors or legal counsel involved in this transaction.",
      "",
      `Transaction ID : ${transaction.id}`,
      `Generated      : ${exportedAt}`,
      "",
      "--------------------------------------------------------------------------",
      "",
      "CONTENTS",
      "--------",
      "Files are ordered by prefix (00, 01, 02…). Start from the lowest number.",
      "",
      "00_overview/",
      "  README.txt                 This file.",
      "  transaction_summary.json   Vehicle, parties, plan, and current status.",
      "",
      "01_verification/",
      "  verification.json          Risk assessment: level, confidence, issues,",
      "                             positive signals, and recommendation.",
      "",
      "02_agreement/",
      "  Vehicle_Purchase_Agreement.html",
      "                             Purchase agreement. Open in any browser to",
      "                             read or print.",
      "",
      "03_documents/",
      "  ine.{ext}                  Seller identification (INE or official ID).",
      "  registration.{ext}         Vehicle registration (tarjeta de circulación).",
      "  invoice.{ext}              Ownership invoice (factura).",
      "",
      "99_raw/",
      "  metadata.json              Full machine-readable transaction snapshot.",
      "                             For audit, integration, or record-keeping.",
      "",
      "--------------------------------------------------------------------------",
      "",
      "How to use this file:",
      "1. Start with \"01_verification\" to understand risk",
      "2. Review \"03_documents\" for supporting evidence",
      "3. Review \"02_agreement\" before completing the transaction",
      "This file can be shared with buyers, sellers, or advisors.",
      "",
      "--------------------------------------------------------------------------",
      "",
      "Generated by MexGuardian (mexguardian.com).",
    ].join("\n");
    addFile("00_overview/README.txt", readme);

    // ── 00_overview/transaction_summary.json ─────────────────────────────────
    addFile(
      "00_overview/transaction_summary.json",
      JSON.stringify(
        {
          transaction_id: transaction.id,
          generated_at:   exportedAt,
          created_at:     transaction.created_at ?? null,
          vehicle: {
            make:  transaction.vehicle.make,
            model: transaction.vehicle.model,
            year:  transaction.vehicle.year,
            vin:   transaction.vehicle.vin   ?? null,
            plate: transaction.vehicle.plate ?? null,
          },
          parties: {
            buyer_name:   transaction.buyer_name   ?? null,
            buyer_email:  transaction.buyer_email  ?? null,
            seller_name:  transaction.seller_name  ?? null,
            seller_email: transaction.seller_email ?? null,
          },
          sale: {
            price:    transaction.price    ?? null,
            location: transaction.location ?? null,
          },
          plan:   plan ?? null,
          status: {
            current_step:        transaction.current_step,
            transaction_status:  transaction.status              ?? null,
            verification_status: transaction.verification_status,
            decision:            transaction.accepted_risk_level ?? null,
          },
          agreement: {
            status:         contract.status,
            signing_status: transaction.signing_status ?? null,
          },
        },
        null,
        2
      )
    );

    // ── 01_verification/verification.json ────────────────────────────────────
    const riskLevelLabel =
      risk.riskLevel === "HIGH"     ? "high"     :
      risk.riskLevel === "MODERATE" ? "moderate" : "low";
    const decisionGuidance =
      risk.riskLevel === "HIGH"     ? "Do not proceed" :
      risk.riskLevel === "MODERATE" ? "Proceed with caution" : "Proceed";
    const recommendation =
      risk.riskLevel === "HIGH"
        ? "Do not proceed without resolving all flagged issues. Consult with a legal or automotive professional."
        : risk.riskLevel === "MODERATE"
        ? "Proceed with caution. Address flagged items with the seller before finalizing the transaction."
        : "No significant issues detected. You may proceed with confidence.";
    addFile(
      "01_verification/verification.json",
      JSON.stringify(
        {
          risk_level:       riskLevelLabel,
          confidence_score: risk.confidence,
          confidence_label: risk.confidenceLabel,
          decision_guidance: decisionGuidance,
          recommendation,
          summary:          transaction.verification_results?.summary ?? null,
          key_issues:       risk.issues,
          positive_signals: risk.resolved,
          generated_at:     exportedAt,
          source:           "MexGuardian AI Verification System",
        },
        null,
        2
      )
    );

    // ── 02_agreement/Vehicle_Purchase_Agreement.html ─────────────────────────
    // Included only when generated. Auto-print script stripped for clean open.
    if (contract.status === "generated") {
      const agreementDate = new Date(exportedAt).toLocaleDateString("es-MX", {
        year: "numeric", month: "long", day: "numeric",
      });
      const agreementHtml = generateAgreementHTML({
        id:           transaction.id,
        date:         agreementDate,
        vehicle:      transaction.vehicle,
        buyer_name:   transaction.buyer_name,
        buyer_email:  transaction.buyer_email,
        seller_name:  transaction.seller_name,
        seller_email: transaction.seller_email,
        price:        transaction.price,
        location:     transaction.location,
      }).replace(/<script>[\s\S]*?<\/script>/g, "");
      addFile("02_agreement/Vehicle_Purchase_Agreement.html", agreementHtml);
    }

    // ── 03_documents/ — parallel fetch from Supabase storage ─────────────────
    await Promise.all(
      (Object.entries(transaction.documents) as [string, typeof transaction.documents.ine][]).map(
        async ([docType, doc]) => {
          if (doc.status !== "uploaded" || !doc.file_url || !doc.file_name) return;
          try {
            const res = await fetch(doc.file_url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ext  = doc.file_name.split(".").pop() ?? "bin";
            const path = `03_documents/${docType}.${ext}`;
            zip.file(path, await res.arrayBuffer());
            fileIndex.push(path);
          } catch {
            console.warn("[dossier] document fetch failed", { docType, file_url: doc.file_url });
          }
        }
      )
    );

    // ── 99_raw/metadata.json — full unfiltered snapshot, undefined → null ─────
    addFile(
      "99_raw/metadata.json",
      JSON.stringify(transaction, (_k, v) => (v === undefined ? null : v), 2)
    );

    // ── INDEX.json — machine-readable entry point, written last ───────────────
    zip.file(
      "INDEX.json",
      JSON.stringify(
        {
          transaction_id: transaction.id,
          generated_at:   exportedAt,
          source:         "MexGuardian",
          files:          fileIndex,
        },
        null,
        2
      )
    );

    // ── Trigger download ──────────────────────────────────────────────────────
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `MexGuardian_Vehicle_Record_${isoDate}_${transaction.id}.zip`;
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

  const verdictIsClean = risk.issues.length === 0 && risk.unknowns.length === 0;

  const hasIssues   = risk.issues.length > 0;
  const hasUnknowns = risk.unknowns.length > 0;
  const badgeClass  = verdictIsClean ? "clear" : "caution";
  const badgeText   = verdictIsClean ? "Clear" : "Caution";
  const recVariant  = hasIssues ? "risk" : hasUnknowns ? "moderate" : "clear";
  const recText     = hasIssues
    ? "Do not proceed until these issues are resolved with the seller."
    : hasUnknowns
    ? "Proceed only if you can verify the outstanding items with the seller."
    : "No blocking issues found. You may proceed with confidence.";
  const hasFindings = risk.issues.length > 0 || risk.resolved.length > 0;

  const { vehicle, documents } = transaction;

  return (
    <section className="py-10">
      <div className="mb-6">
        <span className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)]">
          Complete
        </span>
      </div>

      {/* ── Report card ──────────────────────────────────────────── */}
      <div className="vr-card">
        <div className="vr-header">
          <span className="vr-title">Verification Report</span>
          <span className={`vr-badge ${badgeClass}`}>{badgeText}</span>
        </div>

        <div className="vr-body">

          {/* Vehicle */}
          <div className="vr-section">
            <div className="vr-k">Vehicle</div>
            <div className="vr-row">
              <span className="vr-row-label">VIN</span>
              <span className={`vr-status ${vehicle.vin?.trim() ? "s-ok" : "s-warn"}`}>
                {vehicle.vin?.trim() ? "Provided" : "Not provided"}
              </span>
            </div>
            <div className="vr-row">
              <span className="vr-row-label">License plate</span>
              <span className={`vr-status ${vehicle.plate?.trim() ? "s-ok" : "s-warn"}`}>
                {vehicle.plate?.trim() ? "Provided" : "Not provided"}
              </span>
            </div>
          </div>

          {/* Documents */}
          <div className="vr-section">
            <div className="vr-k">Documents</div>
            <div className="vr-row">
              <span className="vr-row-label">Seller ID (INE)</span>
              <span className={`vr-status ${documents.ine.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                {documents.ine.status === "uploaded" ? "Submitted" : "Not provided"}
              </span>
            </div>
            <div className="vr-row">
              <span className="vr-row-label">Registration</span>
              <span className={`vr-status ${documents.registration.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                {documents.registration.status === "uploaded" ? "Submitted" : "Not provided"}
              </span>
            </div>
            <div className="vr-row">
              <span className="vr-row-label">Ownership invoice</span>
              <span className={`vr-status ${documents.invoice.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                {documents.invoice.status === "uploaded" ? "Submitted" : "Not provided"}
              </span>
            </div>
          </div>

          {/* Findings — resolved + issues */}
          {hasFindings && (
            <div className="vr-section">
              <div className="vr-k">Findings</div>
              {risk.resolved.map((item) => (
                <div key={item} className="vr-row">
                  <span className="vr-row-label">{item}</span>
                  <span className="vr-status s-ok">Verified</span>
                </div>
              ))}
              {risk.issues.map((item) => (
                <div key={item} className="vr-row">
                  <span className="vr-row-label">{item}</span>
                  <span className="vr-status s-risk">Issue</span>
                </div>
              ))}
            </div>
          )}

          {/* Unverified */}
          {hasUnknowns && (
            <div className="vr-section">
              <div className="vr-k">Unverified</div>
              {risk.unknowns.map((item) => (
                <div key={item} className="vr-row">
                  <span className="vr-row-label">{item}</span>
                  <span className="vr-status s-warn">Unverified</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          <div className={`vr-rec ${recVariant === "clear" ? "clear" : recVariant === "moderate" ? "moderate" : ""}`}>
            <div className="vr-rec-label">Recommendation</div>
            <p className="vr-rec-text">{recText}</p>
          </div>

        </div>
      </div>

      {isBasic && (
        <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-4 mb-6">
          <p className="text-[13px] text-amber-400/80 leading-relaxed">
            This report covers public records only. Expert review was not included.
          </p>
        </div>
      )}

      {contract.status === "generated" ? (
        <>
          <p className="text-[15px] text-[#444] mb-5">
            Purchase agreement generated
          </p>

          {/* E-signature — primary action */}
          {documensoEnabled && (
            <button
              onClick={handleSendForSignature}
              disabled={signingLoading}
              className={`w-full text-base font-semibold px-5 py-4 rounded-lg transition-opacity mb-3 ${
                signingLoading
                  ? "bg-[#B4531A]/60 text-white/60 cursor-default"
                  : "bg-[#B4531A] hover:opacity-85 text-white shadow-[0_4px_16px_rgba(180,83,26,.28)]"
              }`}
            >
              {signingLoading ? "Opening…" : "Sign agreement now"}
            </button>
          )}

          {/* Download — secondary action */}
          <button onClick={handleDownload} className="text-[15px] text-[#666] hover:text-white transition-colors mb-6">
            Download purchase agreement
          </button>

          <div className="mb-6" />

          <div className="mb-8">
            <button
              onClick={handleShare}
              className="text-[15px] text-[var(--accent)] hover:text-blue-400 transition-colors"
            >
              Share verified transaction
            </button>
            <p className="text-[15px] text-[#666] mt-1">
              Anyone with this link can view the verification and contract
            </p>
            {showShared && (
              <>
                <p className="text-[15px] text-[var(--foreground-muted)] leading-relaxed mt-3">
                  Link copied. You can now share this transaction.
                </p>
                <div className="flex gap-4 mt-2">
                  <button
                    onClick={() => window.open(shareUrl, "_blank")}
                    className="text-[15px] text-blue-400 underline"
                  >
                    Open link
                  </button>
                  <button
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, "_blank")}
                    className="text-[15px] text-green-400 underline"
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
          <p className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            Agreement details
          </p>
          <div className="flex flex-col gap-6 mb-6">
            <div>
              <p className="text-base text-[#444] mb-2">Buyer full name</p>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Full legal name"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">Buyer email</p>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="buyer@email.com"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">Seller full name</p>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Full legal name"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">Seller email</p>
              <input
                type="email"
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                placeholder="seller@email.com"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">Sale price (MXN)</p>
              <input
                type="text"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="e.g. 120,000"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">City / State</p>
              <input
                type="text"
                value={saleLocation}
                onChange={(e) => setSaleLocation(e.target.value)}
                placeholder="e.g. Ciudad de México, CDMX"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
          </div>
          <p className="text-[15px] text-[#666] leading-relaxed mb-4">
            Both parties should review and confirm all details before signing.
          </p>
          {(risk.confidence < 40 || transaction.documents.invoice.status !== "uploaded") && (
            <p className="text-[15px] text-amber-400/80 leading-relaxed mb-4">
              You are generating an agreement based on incomplete verification data. Review carefully before signing.
            </p>
          )}
          {verdictIsClean ? (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`w-full text-base font-semibold px-5 py-4 rounded-lg transition-colors text-left ${
                !canGenerate
                  ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                  : "bg-[#B4531A] hover:opacity-85 text-white shadow-[0_4px_16px_rgba(180,83,26,.28)]"
              }`}
            >
              Generate purchase agreement
            </button>
          ) : (
            <>
              <button
                onClick={() => goToStep("check")}
                className="w-full bg-[#B4531A] hover:opacity-85 text-white shadow-[0_4px_16px_rgba(180,83,26,.28)] text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left"
              >
                Resolve these risks before you proceed
              </button>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`w-full mt-3 text-base font-semibold px-5 py-4 rounded-lg border transition-colors text-left ${
                  !canGenerate
                    ? "border-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                    : "border-[var(--border)] hover:border-white/30 text-[var(--foreground-muted)] hover:text-white"
                }`}
              >
                Continue anyway
              </button>
            </>
          )}
        </div>
      )}

      <div className="mb-8">
        <button
          onClick={handleDownloadAll}
          className="text-[15px] text-[#666] hover:text-white transition-colors"
        >
          Download full vehicle record (.zip)
        </button>
      </div>

      {showForm ? (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            Add Maintenance
          </p>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-base text-[#444] mb-2">Type</p>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as MaintenanceRecordType)}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2"
              >
                <option value="service">Service</option>
                <option value="repair">Repair</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">Title</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Oil change"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">Date</p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !date}
            className={`mt-5 w-full text-base font-semibold px-5 py-4 rounded-lg transition-colors text-left ${
              !title.trim() || !date
                ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                : "bg-[#B4531A] hover:opacity-85 text-white cursor-pointer shadow-[0_4px_16px_rgba(180,83,26,.28)]"
            }`}
          >
            Save record
          </button>
        </div>
      ) : (
        <>
          {showMaintenanceSaved && (
            <p className="text-[15px] text-[#666] leading-relaxed mb-3">
              Maintenance record saved.
            </p>
          )}
          <button
            onClick={() => { setShowForm(true); setShowMaintenanceSaved(false); }}
            className="text-[15px] text-[var(--accent)] hover:text-blue-400 transition-colors"
          >
            Add maintenance record
          </button>
        </>
      )}
    </section>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function AIInterface({ plan, dbStatus }: { plan: "39" | "69" | null; dbStatus?: string }) {
  const { transaction, advanceStep, advanceToStep, goToStep, returnedToStep, updateVehicle, setStatus, isDecisionMade } = useTransaction();
  const { current_step } = transaction;

  // Sync DB status into context on mount — makes status the authoritative source of truth
  // also restores step when localStorage was cleared but DB has the decision
  useEffect(() => {
    if (dbStatus) setStatus(dbStatus);
    if (dbStatus === "decision_made" && current_step !== "complete") {
      advanceToStep("complete");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Use plan-aware step list so Basic users at "complete" go back to "analyze" not "verify"
  const planSteps = getSteps(plan);
  const currentIndex = planSteps.findIndex((s) => s.key === current_step);

  const prevStep = currentIndex > 0 ? planSteps[currentIndex - 1] : null;

  const backLink = prevStep && !isDecisionMade ? (
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
        <section className="py-10">
          <div className="mb-4">
            <span className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)]">
              Upload
            </span>
          </div>

          <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
            Start your vehicle check
          </h2>

          <p className="text-[18px] text-[#444] leading-relaxed mb-10">
            We need basic vehicle details and the seller&apos;s documents to run
            verification. The more complete your upload, the more accurate your
            risk report.
          </p>

          {/* Vehicle info */}
          <p className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            Vehicle details
          </p>
          <div className="flex flex-col gap-6 mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-base text-[#444] mb-2">Make</p>
                <input
                  type="text"
                  defaultValue={vehicle.make}
                  onBlur={(e) => updateVehicle({ make: e.target.value.trim() })}
                  placeholder="e.g. Nissan"
                  className="w-full bg-white border border-[rgba(0,0,0,0.12)] text-[#111111] text-base rounded-lg px-3 py-2.5 placeholder:text-[#999999] focus:outline-none focus:border-[rgba(0,0,0,0.3)]"
                />
              </div>
              <div className="flex-1">
                <p className="text-base text-[#444] mb-2">Model</p>
                <input
                  type="text"
                  defaultValue={vehicle.model}
                  onBlur={(e) => updateVehicle({ model: e.target.value.trim() })}
                  placeholder="e.g. Sentra"
                  className="w-full bg-white border border-[rgba(0,0,0,0.12)] text-[#111111] text-base rounded-lg px-3 py-2.5 placeholder:text-[#999999] focus:outline-none focus:border-[rgba(0,0,0,0.3)]"
                />
              </div>
              <div className="w-24">
                <p className="text-base text-[#444] mb-2">Year</p>
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
                  className="w-full bg-white border border-[rgba(0,0,0,0.12)] text-[#111111] text-base rounded-lg px-3 py-2.5 placeholder:text-[#999999] focus:outline-none focus:border-[rgba(0,0,0,0.3)]"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-base text-[#444] mb-2">
                  VIN <span className="normal-case text-[#666]">(recommended)</span>
                </p>
                <input
                  type="text"
                  defaultValue={vehicle.vin ?? ""}
                  onBlur={(e) => updateVehicle({ vin: e.target.value.trim() || undefined })}
                  placeholder="17-character VIN"
                  className="w-full bg-white border border-[rgba(0,0,0,0.12)] text-[#111111] text-base rounded-lg px-3 py-2.5 placeholder:text-[#999999] font-mono focus:outline-none focus:border-[rgba(0,0,0,0.3)]"
                />
              </div>
              <div className="flex-1">
                <p className="text-base text-[#444] mb-2">
                  Plate <span className="normal-case text-[#666]">(recommended)</span>
                </p>
                <input
                  type="text"
                  defaultValue={vehicle.plate ?? ""}
                  onBlur={(e) => updateVehicle({ plate: e.target.value.trim() || undefined })}
                  placeholder="e.g. ABC-123-D"
                  className="w-full bg-white border border-[rgba(0,0,0,0.12)] text-[#111111] text-base rounded-lg px-3 py-2.5 placeholder:text-[#999999] font-mono focus:outline-none focus:border-[rgba(0,0,0,0.3)]"
                />
              </div>
            </div>
          </div>
          <p className="text-[15px] text-[#666] leading-relaxed mb-10">
            Adding a VIN or plate allows theft and registry checks. Without it,
            your results will be limited.
          </p>

          {/* Document upload progress */}
          {uploadedDocs > 0 && !allUploaded && (
            <div className="border border-[var(--border)] rounded-lg px-4 py-4 mb-6">
              <p className="text-[15px] text-[#444] leading-relaxed">
                {uploadedDocs} of 3 documents uploaded — missing documents will
                appear as unknowns in your report.
              </p>
            </div>
          )}

          {/* Warning: no identifier — non-blocking, shown once minimum input is met */}
          {hasDocs && !hasIdentifier && (
            <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-4 mb-4">
              <p className="text-[15px] text-amber-400 leading-relaxed">
                Proceeding without a VIN or plate will reduce verification
                accuracy. Registry and theft checks will not run.
              </p>
            </div>
          )}

          {/* Hard gate warning — shown only when nothing has been provided */}
          {!hasMinimumInput && (
            <div className="border border-[var(--border)] rounded-lg px-4 py-4 mb-4">
              <p className="text-[15px] text-[#444] leading-relaxed">
                Add a VIN/plate or upload at least one document to continue.
              </p>
            </div>
          )}

          <button
            onClick={() => {
              if (process.env.NODE_ENV === "development") {
                console.log("ACTION: CONTINUE", { step: current_step, transactionId: transaction.id });
              }
              advanceStep();
            }}
            disabled={!canContinue}
            className={`w-full text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left mb-3 ${
              !canContinue
                ? "bg-[rgba(0,0,0,0.06)] text-[#999999] cursor-default"
                : "bg-[#B4531A] hover:opacity-85 text-white shadow-[0_4px_16px_rgba(180,83,26,.28)]"
            }`}
          >
            {!hasMinimumInput
              ? "Add a VIN/plate or document to continue"
              : !hasIdentifier
              ? "Check this vehicle — registry checks limited without VIN/plate"
              : "Check this vehicle"}
          </button>

          {vehicleComplete && !allUploaded && uploadedDocs > 0 && (
            <p className="text-[15px] text-[#666] leading-relaxed">
              You can add more documents later to improve your results.
            </p>
          )}
        </section>
      </>
    );
  }

  if (current_step === "check") {
    const checkHasMinimumInput = computeHasMinimumInput(transaction);
    const checkContent = stepContent["check"];

    return (
      <>
        {backLink}
        {changesBanner}
        <section className="py-10">
          <div className="mb-4">
            <span className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)]">
              {planSteps[currentIndex]?.label}
            </span>
          </div>
          <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
            {checkContent.heading}
          </h2>
          <p className="text-[18px] text-[#444] leading-relaxed mb-10">
            {checkContent.body}
          </p>
          {!checkHasMinimumInput && (
            <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-4 mb-6">
              <p className="text-[15px] text-amber-400 leading-relaxed">
                We need at least a VIN, plate, or one uploaded document to analyze
                this vehicle.
              </p>
            </div>
          )}
          <button
            onClick={() => {
              if (checkHasMinimumInput) {
                if (process.env.NODE_ENV === "development") {
                  console.log("ACTION: CONTINUE", { step: current_step, transactionId: transaction.id });
                }
                advanceStep();
              }
            }}
            disabled={!checkHasMinimumInput}
            className={`w-full text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left ${
              !checkHasMinimumInput
                ? "bg-[var(--border)] text-[var(--foreground-muted)] cursor-default"
                : "bg-[#B4531A] hover:opacity-85 text-white shadow-[0_4px_16px_rgba(180,83,26,.28)]"
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
          <div className="mb-4">
            <span className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)]">
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
          <div className="mb-4">
            <span className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)]">
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
        <p className="text-[18px] text-[#444] leading-relaxed mb-8">
          Something went wrong. Reload the page or go back.
        </p>
        <button
          onClick={() => goToStep("upload")}
          className="mt-4 w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)]"
        >
          ← Back to Upload
        </button>
      </section>
    </>
  );
}
