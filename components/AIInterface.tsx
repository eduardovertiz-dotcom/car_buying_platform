"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import JSZip from "jszip";
import { useTransaction } from "@/context/TransactionContext";
import { createClient } from "@/lib/supabase/client";
import { Step, MaintenanceRecordType, getSteps } from "@/lib/types";
import type { VerificationResult } from "@/lib/types";
import AnalyzePanel from "@/components/panels/AnalyzePanel";
import { generateAgreementHTML } from "@/lib/agreement";
import { computeRisk, type RiskOutput } from "@/lib/risk";
import { track } from "@/lib/track";
import { hasMinimumInput as computeHasMinimumInput } from "@/lib/guards";
import { stepEngineCopy } from "@/lib/i18n/stepEngine";

type StepContent = {
  heading: string;
  body: string;
  action: string;
  completedAction: string;
  contextLine?: string;
};

function getStepContent(lang: 'en' | 'es'): Record<Step, StepContent> {
  const t = stepEngineCopy[lang];
  return {
    upload: {
      heading: t.steps.uploadHeading,
      body: t.steps.uploadBody,
      action: t.steps.uploadAction,
      completedAction: t.steps.stepCompleted,
      contextLine: t.steps.uploadContext,
    },
    check: {
      heading: t.steps.checkHeading,
      body: t.steps.checkBody,
      action: t.steps.checkAction,
      completedAction: t.steps.stepCompleted,
    },
    analyze: { heading: "", body: "", action: "", completedAction: "" },
    verify:  { heading: "", body: "", action: "", completedAction: "" },
    complete: { heading: "", body: "", action: "", completedAction: "" },
  };
}

// ─── Verify ──────────────────────────────────────────────────────────────────

type VerifyState = "idle" | "processing" | "error" | "complete";

function VerifyInterface({ plan }: { plan: "39" | "69" | null }) {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
  const levelToUI = { safe: "Clear", review: "Caution", high_risk: "Do not proceed" } as const;

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
  const [geoCurrency, setGeoCurrency] = useState("");
  useEffect(() => {
    fetch("/api/geo-currency")
      .then((r) => r.json())
      .then(({ currency }: { currency: string }) => setGeoCurrency(currency.toUpperCase()))
      .catch(() => {});
  }, []);
  // Server-computed risk output — single source of truth for score/level/checks
  const [riskOutput, setRiskOutput] = useState<{
    score: number;
    level: "safe" | "review" | "high_risk";
    flags: string[];
    explanations: string[];
    checks: Array<{ label: string; status: "ok" | "warning" | "error"; message: string }>;
    recommendation: string;
    confidence: "high" | "medium" | "low";
  } | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>(() => {
    if (verification_status === "basic_complete" || verification_status === "professional_complete") return "complete";
    if (verification_status === "basic_processing" || verification_status === "professional_processing") return "processing";
    return "idle";
  });
  // Upgrade delta: snapshot of risk at the moment the user clicks upgrade
  const [previousRisk, setPreviousRisk] = useState<RiskOutput | null>(null);

  // REPUVE unavailable: track single retry
  const [repuveRetried, setRepuveRetried] = useState(false);

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
  const risk = computeRisk(transaction, lang);

  // Dev: log every state transition
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("VERIFY STATE:", verifyState, { verification_status });
    }
  }, [verifyState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger: fires only when idle + identifier present.
  // Polls DB for verifications JSONB — single source of truth.
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

    // Poll DB until verification_status is "complete" — single source of truth
    const supabase = createClient();
    let polls = 0;
    const MAX_POLLS = 20; // 30s at 1.5s intervals
    let active = true;

    const timer = setInterval(async () => {
      if (!active) return;
      if (++polls > MAX_POLLS) {
        clearInterval(timer);
        active = false;
        setVerifyState("error");
        return;
      }
      const { data: row } = await supabase
        .from("transactions")
        .select("verifications, verification_status, risk_output")
        .eq("id", transaction.id)
        .single();
      const vStatus = row?.verification_status as string | null;
      if (vStatus !== "complete") return;

      clearInterval(timer);
      active = false;
      const risk_out = row?.risk_output as typeof riskOutput ?? null;
      setRiskOutput(risk_out);
      const result: VerificationResult = {
        status: (risk_out?.level ?? "review") as "safe" | "review" | "high_risk",
        summary: risk_out?.recommendation ?? "",
        findings: risk_out?.explanations ?? [],
        confidence: risk_out?.score ?? 50,
      };
      if (shouldRunProfessional) completeProfessionalVerification(result);
      else completeBasicVerification(result);
      setVerifyState("complete");
    }, 1500);

    // Trigger orchestrator — 5xx means failure, stop polling immediately
    fetch(`/api/transactions/${transaction.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plate: transaction.vehicle.plate ?? undefined,
        vin: transaction.vehicle.vin ?? undefined,
      }),
    })
      .then((res) => {
        if (!res.ok && active) {
          clearInterval(timer);
          active = false;
          setVerifyState("error");
        }
      })
      .catch(() => {
        if (active) {
          clearInterval(timer);
          active = false;
          setVerifyState("error");
        }
      });

    return () => {
      active = false;
      clearInterval(timer);
    };
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
        body: JSON.stringify({ plan: "69", transaction_id: transaction.id }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? "No checkout URL");
      window.location.href = url;
    } catch (err) {
      console.error("[upsell] failed:", err);
      setUpsellLoading(false);
    }
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

  // ── Docs only, not started — plate required for registry checks ─────────
  if (!hasIdentifier && hasDocs && verification_status === "not_started") {
    return (
      <>
        <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
          Add a plate number to continue.
        </h2>
        <p className="text-[18px] text-[#444] leading-relaxed mb-8">
          A plate number or VIN is required to run official registry checks.
        </p>
        <button
          onClick={() => goToStep("upload")}
          className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)]"
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
    const repuveUnavailable = riskOutput?.checks.some(
      (c) => c.label === "REPUVE" && c.status === "warning"
    ) ?? false;

    if (!riskOutput) return (
      <div className="border border-[var(--border)] rounded-lg px-5 py-4">
        <p className="text-[15px] text-[var(--foreground-muted)]">
          Loading verification results…
        </p>
      </div>
    );
    const badge = levelToUI[riskOutput.level];
    const pillIsRisk = riskOutput.level === "high_risk";
    const verifyRecVariant = riskOutput.level === "safe" ? "clear" : riskOutput.level === "review" ? "moderate" : "";
    const verifyRecText = riskOutput.recommendation;

    return (
      <>
        {/* ── Report card ─────────────────────────────────────────── */}
        <div className="vr-wrap">
          <div className={`vr-pill${pillIsRisk ? "" : " warn"}`}>{badge}</div>
          <div className="vr-card">
            <div className="vr-header">
              <span className="vr-title">{t.reports.verificationReport}</span>
            </div>
            <div className="vr-body">

              {/* Score bar — server-computed, deterministic */}
              {riskOutput && (
                <div className="vr-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span className="vr-k" style={{ marginBottom: 0 }}>Puntuación de riesgo</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: riskOutput.level === "safe" ? "#22c55e" : riskOutput.level === "high_risk" ? "#ef4444" : "#eab308" }}>
                      {riskOutput.score}/100
                    </span>
                  </div>
                  <div style={{ background: "var(--border)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${riskOutput.score}%`, height: "100%", background: riskOutput.level === "safe" ? "#22c55e" : riskOutput.level === "high_risk" ? "#ef4444" : "#eab308" }} />
                  </div>
                </div>
              )}

              {/* Explanations */}
              {riskOutput && riskOutput.explanations.length > 0 && (
                <div className="vr-section">
                  <div className="vr-k">{t.reports.outstandingIssues}</div>
                  {riskOutput.explanations.map((exp, i) => (
                    <div key={i} className="vr-row">
                      <span className="vr-row-label">{exp}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Registry checks */}
              <div className="vr-section">
                <div className="vr-k">{t.reports.registryChecks}</div>
                {riskOutput ? (
                  riskOutput.checks.map((check, i) => (
                    <div key={i} className="vr-row">
                      <span className="vr-row-label">{check.label}</span>
                      <span className={`vr-status ${check.status === "ok" ? "s-ok" : check.status === "error" ? "s-risk" : "s-warn"}`}>
                        {check.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="vr-row">
                    <span className="vr-row-label">Registry checks</span>
                    <span className="vr-status s-warn">Loading…</span>
                  </div>
                )}
                {repuveUnavailable && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,0.15)" }}>
                    <p className="text-[13px] font-semibold text-slate-400 mb-1" style={{ whiteSpace: "pre-line" }}>
                      {t.repuveUnavailable.title}
                    </p>
                    <p className="text-[13px] text-slate-500 leading-relaxed mb-2">
                      {t.repuveUnavailable.message}
                    </p>
                    <p className="text-[12px] text-slate-500 leading-relaxed mb-2">
                      {t.repuveUnavailable.note}
                    </p>
                    <p className="text-[13px] font-medium text-slate-400 mb-2">
                      {t.repuveUnavailable.confidence(riskOutput.confidence)}
                    </p>
                    {!repuveRetried && (
                      <button
                        onClick={() => { setRepuveRetried(true); handleRetry(); }}
                        className="text-[13px] text-slate-400 hover:text-white transition-colors underline underline-offset-2"
                      >
                        {t.repuveUnavailable.button}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Document integrity */}
              <div className="vr-section">
                <div className="vr-k">{t.reports.documentIntegrity}</div>
                <div className="vr-row">
                  <span className="vr-row-label">{t.fields.ownershipInvoice}</span>
                  <span className={`vr-status ${documents.invoice.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.invoice.status === "uploaded" ? t.status.submitted : t.status.notProvided}
                  </span>
                </div>
                <div className="vr-row">
                  <span className="vr-row-label">{t.fields.sellerId}</span>
                  <span className={`vr-status ${documents.ine.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.ine.status === "uploaded" ? t.status.submitted : t.status.notProvided}
                  </span>
                </div>
                <div className="vr-row">
                  <span className="vr-row-label">{t.fields.registration}</span>
                  <span className={`vr-status ${documents.registration.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.registration.status === "uploaded" ? t.status.submitted : t.status.notProvided}
                  </span>
                </div>
              </div>

              {/* Recommendation */}
              <div className={`vr-rec ${verifyRecVariant === "clear" ? "clear" : verifyRecVariant === "moderate" ? "moderate" : ""}`}>
                <div className="vr-rec-label">{t.reports.recommendation}</div>
                <p className="vr-rec-text">{verifyRecText}</p>
              </div>

            </div>
          </div>
        </div>

        {/* Upsell */}
        <div className="border border-[var(--border)] rounded-lg px-5 py-5 mb-6">
          <p className="text-[15px] font-semibold text-[var(--foreground)] mb-2">
            {t.fields.expertAvailable}
          </p>
          <p className="text-[14px] text-[#444] leading-relaxed mb-4">
            {t.warnings.automatedLimited}
          </p>
          <button
            onClick={handleUpsell}
            disabled={upsellLoading}
            className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)] disabled:opacity-60 disabled:shadow-none"
          >
            {upsellLoading ? t.reports.redirecting : t.cta.upgradeVerification}
          </button>
          {geoCurrency && (
            <p style={{ marginTop: 10, fontSize: 12, color: "#444", fontWeight: 400, lineHeight: 1.4 }}>
              {lang === "es" ? `El cargo se realizará en ${geoCurrency}` : `You will be charged in ${geoCurrency}`}
              {geoCurrency === "MXN" && <><br />{lang === "es" ? "Requerido para compatibilidad con bancos en México" : "Required for compatibility with Mexican banks"}</>}
            </p>
          )}
          {showDocWarning && (
            <p className="text-[13px] text-amber-400 leading-relaxed mt-3">
              {t.warnings.uploadDocs}
            </p>
          )}
        </div>

        {isDecisionMade ? (
          <p className="text-sm text-green-400 leading-relaxed">
            ✓ {t.reports.decisionRecorded}
          </p>
        ) : verdictIsClean ? (
          <button
            onClick={handleDecision}
            className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)]"
          >
            {t.cta.proceedAgreement}
          </button>
        ) : (
          <button
            onClick={handleDecision}
            className="text-[14px] text-[#666] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
          >
            {t.cta.continueResults}
          </button>
        )}
      </>
    );
  }

  // ── Professional complete ────────────────────────────────────────────────
  if (verification_status === "professional_complete") {
    const repuveUnavailable = riskOutput?.checks.some(
      (c) => c.label === "REPUVE" && c.status === "warning"
    ) ?? false;

    if (!riskOutput) return (
      <div className="border border-[var(--border)] rounded-lg px-5 py-4">
        <p className="text-[15px] text-[var(--foreground-muted)]">
          Loading verification results…
        </p>
      </div>
    );
    const badge = levelToUI[riskOutput.level];
    const pillIsRisk = riskOutput.level === "high_risk";
    const verifyRecVariant = riskOutput.level === "safe" ? "clear" : riskOutput.level === "review" ? "moderate" : "";
    const verifyRecText = riskOutput.recommendation;

    return (
      <>
        {/* Report card */}
        <div className="vr-wrap">
          {badge && (
            <div className={`vr-pill${pillIsRisk ? "" : " warn"}`}>{badge}</div>
          )}
          <div className="vr-card">
            <div className="vr-header">
              <span className="vr-title">{t.reports.verificationReport}</span>
            </div>
            <div className="vr-body">

              {/* Score bar — server-computed, deterministic */}
              {riskOutput && (
                <div className="vr-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span className="vr-k" style={{ marginBottom: 0 }}>Puntuación de riesgo</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: riskOutput.level === "safe" ? "#22c55e" : riskOutput.level === "high_risk" ? "#ef4444" : "#eab308" }}>
                      {riskOutput.score}/100
                    </span>
                  </div>
                  <div style={{ background: "var(--border)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${riskOutput.score}%`, height: "100%", background: riskOutput.level === "safe" ? "#22c55e" : riskOutput.level === "high_risk" ? "#ef4444" : "#eab308" }} />
                  </div>
                </div>
              )}

              {/* Explanations */}
              {riskOutput && riskOutput.explanations.length > 0 && (
                <div className="vr-section">
                  <div className="vr-k">{t.reports.outstandingIssues}</div>
                  {riskOutput.explanations.map((exp, i) => (
                    <div key={i} className="vr-row">
                      <span className="vr-row-label">{exp}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Registry checks */}
              <div className="vr-section">
                <div className="vr-k">{t.reports.registryChecks}</div>
                {riskOutput ? (
                  riskOutput.checks.map((check, i) => (
                    <div key={i} className="vr-row">
                      <span className="vr-row-label">{check.label}</span>
                      <span className={`vr-status ${check.status === "ok" ? "s-ok" : check.status === "error" ? "s-risk" : "s-warn"}`}>
                        {check.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="vr-row">
                    <span className="vr-row-label">Registry checks</span>
                    <span className="vr-status s-warn">Loading…</span>
                  </div>
                )}
                {repuveUnavailable && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,0.15)" }}>
                    <p className="text-[13px] font-semibold text-slate-400 mb-1" style={{ whiteSpace: "pre-line" }}>
                      {t.repuveUnavailable.title}
                    </p>
                    <p className="text-[13px] text-slate-500 leading-relaxed mb-2">
                      {t.repuveUnavailable.message}
                    </p>
                    <p className="text-[12px] text-slate-500 leading-relaxed mb-2">
                      {t.repuveUnavailable.note}
                    </p>
                    <p className="text-[13px] font-medium text-slate-400 mb-2">
                      {t.repuveUnavailable.confidence(riskOutput.confidence)}
                    </p>
                    {!repuveRetried && (
                      <button
                        onClick={() => { setRepuveRetried(true); handleRetry(); }}
                        className="text-[13px] text-slate-400 hover:text-white transition-colors underline underline-offset-2"
                      >
                        {t.repuveUnavailable.button}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Document integrity */}
              <div className="vr-section">
                <div className="vr-k">{t.reports.documentIntegrity}</div>
                <div className="vr-row">
                  <span className="vr-row-label">{t.fields.ownershipInvoice}</span>
                  <span className={`vr-status ${documents.invoice.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.invoice.status === "uploaded" ? t.status.submitted : t.status.notProvided}
                  </span>
                </div>
                <div className="vr-row">
                  <span className="vr-row-label">{t.fields.sellerId}</span>
                  <span className={`vr-status ${documents.ine.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.ine.status === "uploaded" ? t.status.submitted : t.status.notProvided}
                  </span>
                </div>
                <div className="vr-row">
                  <span className="vr-row-label">{t.fields.registration}</span>
                  <span className={`vr-status ${documents.registration.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                    {documents.registration.status === "uploaded" ? t.status.submitted : t.status.notProvided}
                  </span>
                </div>
              </div>

              {/* Recommendation */}
              <div className={`vr-rec ${verifyRecVariant === "clear" ? "clear" : verifyRecVariant === "moderate" ? "moderate" : ""}`}>
                <div className="vr-rec-label">{t.reports.recommendation}</div>
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
                {t.warnings.whatChanged}
              </p>
              {issuesCleared && (
                <p className="text-[15px] text-green-400 leading-relaxed mb-2">
                  ✓ {t.reports.noRemaining}
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
            ✓ {t.reports.decisionRecorded}
          </p>
        ) : verdictIsClean ? (
          <button
            onClick={handleDecision}
            className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)]"
          >
            {t.cta.proceedAgreement}
          </button>
        ) : (
          <>
            <button
              onClick={handleUpsell}
              disabled={upsellLoading}
              className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)] mb-3 disabled:opacity-60"
            >
              {upsellLoading ? t.reports.redirecting : t.cta.resolveIssues}
            </button>
            {geoCurrency && (
              <p style={{ marginTop: -4, marginBottom: 12, fontSize: 12, color: "#444", fontWeight: 400, lineHeight: 1.4 }}>
                {lang === "es" ? `El cargo se realizará en ${geoCurrency}` : `You will be charged in ${geoCurrency}`}
                {geoCurrency === "MXN" && <><br />{lang === "es" ? "Requerido para compatibilidad con bancos en México" : "Required for compatibility with Mexican banks"}</>}
              </p>
            )}
            <button
              onClick={handleDecision}
              className="text-[14px] text-[#666] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
            >
              {t.cta.continueAnyway}
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



function CompleteInterface({ plan }: { plan: "39" | "69" | null }) {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
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
    const isEs = lang === "es";

    // Language-aware folder/file names
    const p = {
      overview:      isEs ? "00_descripcion"              : "00_overview",
      readme:        isEs ? "LEEME.txt"                   : "README.txt",
      summary:       isEs ? "resumen_transaccion.json"    : "transaction_summary.json",
      verification:  isEs ? "01_verificacion"             : "01_verification",
      verJson:       isEs ? "verificacion.json"           : "verification.json",
      agreement:     isEs ? "02_contrato"                 : "02_agreement",
      agreementHtml: isEs ? "Contrato_Compraventa_Vehiculo.html" : "Vehicle_Purchase_Agreement.html",
      documents:     isEs ? "03_documentos"               : "03_documents",
      raw:           isEs ? "99_datos_crudos"             : "99_raw",
      metadata:      isEs ? "metadatos.json"              : "metadata.json",
    };
    const docNames: Record<string, string> = isEs
      ? { ine: "ine", registration: "tarjeta_circulacion", invoice: "factura" }
      : { ine: "ine", registration: "registration",        invoice: "invoice" };

    // Track every path added — used to build INDEX.json at the end
    const fileIndex: string[] = [];
    function addFile(path: string, content: string | ArrayBuffer) {
      zip.file(path, content);
      fileIndex.push(path);
    }

    // ── README ────────────────────────────────────────────────────────────────
    const readme = isEs ? [
      "Expediente de Transacción MexGuardian",
      "======================================",
      "",
      "Este paquete contiene el registro verificado completo de una transacción de",
      "vehículo procesada a través de MexGuardian. Está destinado al comprador,",
      "vendedor y cualquier asesor o abogado involucrado en esta transacción.",
      "",
      `ID de Transacción : ${transaction.id}`,
      `Generado          : ${exportedAt}`,
      "",
      "--------------------------------------------------------------------------",
      "",
      "CONTENIDO",
      "---------",
      "Los archivos están ordenados por prefijo (00, 01, 02…). Comienza por el más bajo.",
      "",
      `${p.overview}/`,
      `  ${p.readme.padEnd(30)} Este archivo.`,
      `  ${p.summary.padEnd(30)} Vehículo, partes, plan y estado actual.`,
      "",
      `${p.verification}/`,
      `  ${p.verJson.padEnd(30)} Evaluación de riesgo: nivel, confianza, problemas,`,
      "                                 señales positivas y recomendación.",
      "",
      `${p.agreement}/`,
      `  ${p.agreementHtml}`,
      "                                 Contrato de compraventa. Ábrelo en cualquier",
      "                                 navegador para leer o imprimir.",
      "",
      `${p.documents}/`,
      "  ine.{ext}                      Identificación del vendedor (INE o ID oficial).",
      "  tarjeta_circulacion.{ext}      Tarjeta de circulación.",
      "  factura.{ext}                  Factura del vehículo.",
      "",
      `${p.raw}/`,
      `  ${p.metadata.padEnd(30)} Instantánea completa de la transacción.`,
      "                                 Para auditoría, integración o registro.",
      "",
      "--------------------------------------------------------------------------",
      "",
      "Cómo usar este archivo:",
      `1. Comienza con "${p.verification}" para entender el riesgo`,
      `2. Revisa "${p.documents}" como evidencia de respaldo`,
      `3. Revisa "${p.agreement}" antes de completar la transacción`,
      "Este archivo puede compartirse con compradores, vendedores o asesores.",
      "",
      "--------------------------------------------------------------------------",
      "",
      "Generado por MexGuardian (mexguardian.com).",
    ].join("\n") : [
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
    addFile(`${p.overview}/${p.readme}`, readme);

    // ── summary ───────────────────────────────────────────────────────────────
    addFile(
      `${p.overview}/${p.summary}`,
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

    // ── verification ─────────────────────────────────────────────────────────
    const riskLevelLabel = isEs
      ? (risk.riskLevel === "HIGH" ? "alto" : risk.riskLevel === "MODERATE" ? "moderado" : "bajo")
      : (risk.riskLevel === "HIGH" ? "high" : risk.riskLevel === "MODERATE" ? "moderate" : "low");
    const decisionGuidance = isEs
      ? (risk.riskLevel === "HIGH" ? "No proceder" : risk.riskLevel === "MODERATE" ? "Proceder con precaución" : "Proceder")
      : (risk.riskLevel === "HIGH" ? "Do not proceed" : risk.riskLevel === "MODERATE" ? "Proceed with caution" : "Proceed");
    const recommendation = isEs
      ? (risk.riskLevel === "HIGH" ? t.decision.doNotProceed : risk.riskLevel === "MODERATE" ? t.decision.proceedCaution : t.decision.noSignificantIssues)
      : (risk.riskLevel === "HIGH"
          ? "Do not proceed without resolving all flagged issues. Consult with a legal or automotive professional."
          : risk.riskLevel === "MODERATE"
          ? "Proceed with caution. Address flagged items with the seller before finalizing the transaction."
          : "No significant issues detected. You may proceed with confidence.");
    addFile(
      `${p.verification}/${p.verJson}`,
      JSON.stringify(
        {
          risk_level:        riskLevelLabel,
          confidence_score:  risk.confidence,
          confidence_label:  risk.confidenceLabel,
          decision_guidance: decisionGuidance,
          recommendation,
          summary:           transaction.verification_results?.summary ?? null,
          key_issues:        risk.issues,
          positive_signals:  risk.resolved,
          generated_at:      exportedAt,
          source:            "MexGuardian AI Verification System",
        },
        null,
        2
      )
    );

    // ── agreement ────────────────────────────────────────────────────────────
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
      addFile(`${p.agreement}/${p.agreementHtml}`, agreementHtml);
    }

    // ── documents — parallel fetch from Supabase storage ─────────────────────
    await Promise.all(
      (Object.entries(transaction.documents) as [string, typeof transaction.documents.ine][]).map(
        async ([docType, doc]) => {
          if (doc.status !== "uploaded" || !doc.file_url || !doc.file_name) return;
          try {
            const res = await fetch(doc.file_url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ext  = doc.file_name.split(".").pop() ?? "bin";
            const name = docNames[docType] ?? docType;
            const path = `${p.documents}/${name}.${ext}`;
            zip.file(path, await res.arrayBuffer());
            fileIndex.push(path);
          } catch {
            console.warn("[dossier] document fetch failed", { docType, file_url: doc.file_url });
          }
        }
      )
    );

    // ── raw — full unfiltered snapshot, undefined → null ─────────────────────
    addFile(
      `${p.raw}/${p.metadata}`,
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
    a.download = isEs
      ? `MexGuardian_Expediente_Vehicular_${isoDate}_${transaction.id}.zip`
      : `MexGuardian_Vehicle_Record_${isoDate}_${transaction.id}.zip`;
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
      alert(t.warnings.allowPopups);
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  // Single source of truth for risk in complete step
  const risk = computeRisk(transaction, lang);

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
  const badgeText   = verdictIsClean ? t.status.clear : t.status.caution;
  const recVariant  = hasIssues ? "risk" : hasUnknowns ? "moderate" : "clear";
  const recText     = hasIssues
    ? t.decision.resolveIssues
    : hasUnknowns
    ? t.decision.verifyItems
    : t.decision.noBlockingIssues;
  const hasFindings = risk.issues.length > 0 || risk.resolved.length > 0;

  const { vehicle, documents } = transaction;

  return (
    <section className="py-10">
      <div className="mb-6">
        <span className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)]">
          {t.steps.complete}
        </span>
      </div>

      {/* ── Report card ──────────────────────────────────────────── */}
      <div className="vr-wrap">
        <div className={`vr-pill${badgeClass === "clear" ? "" : " warn"}`}>{badgeText}</div>
        <div className="vr-card">
        <div className="vr-header">
          <span className="vr-title">{t.reports.verificationReport}</span>
        </div>

        <div className="vr-body">

          {/* Vehicle */}
          <div className="vr-section">
            <div className="vr-k">{t.reports.vehicle}</div>
            <div className="vr-row">
              <span className="vr-row-label">{t.fields.vin}</span>
              <span className={`vr-status ${vehicle.vin?.trim() ? "s-ok" : "s-warn"}`}>
                {vehicle.vin?.trim() ? t.status.provided : t.status.notProvided}
              </span>
            </div>
            <div className="vr-row">
              <span className="vr-row-label">{t.fields.licensePlate}</span>
              <span className={`vr-status ${vehicle.plate?.trim() ? "s-ok" : "s-warn"}`}>
                {vehicle.plate?.trim() ? t.status.provided : t.status.notProvided}
              </span>
            </div>
          </div>

          {/* Documents */}
          <div className="vr-section">
            <div className="vr-k">{t.reports.documents}</div>
            <div className="vr-row">
              <span className="vr-row-label">{t.fields.sellerId}</span>
              <span className={`vr-status ${documents.ine.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                {documents.ine.status === "uploaded" ? t.status.submitted : t.status.notProvided}
              </span>
            </div>
            <div className="vr-row">
              <span className="vr-row-label">{t.fields.registration}</span>
              <span className={`vr-status ${documents.registration.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                {documents.registration.status === "uploaded" ? t.status.submitted : t.status.notProvided}
              </span>
            </div>
            <div className="vr-row">
              <span className="vr-row-label">{t.fields.ownershipInvoice}</span>
              <span className={`vr-status ${documents.invoice.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                {documents.invoice.status === "uploaded" ? t.status.submitted : t.status.notProvided}
              </span>
            </div>
          </div>

          {/* Findings — resolved + issues */}
          {hasFindings && (
            <div className="vr-section">
              <div className="vr-k">{t.reports.findings}</div>
              {risk.resolved.map((item) => (
                <div key={item} className="vr-row">
                  <span className="vr-row-label">{item}</span>
                  <span className="vr-status s-ok">{t.status.verified}</span>
                </div>
              ))}
              {risk.issues.map((item) => (
                <div key={item} className="vr-row">
                  <span className="vr-row-label">{item}</span>
                  <span className="vr-status s-risk">{t.status.issue}</span>
                </div>
              ))}
            </div>
          )}

          {/* Unverified */}
          {hasUnknowns && (
            <div className="vr-section">
              <div className="vr-k">{t.reports.unverified}</div>
              {risk.unknowns.map((item) => (
                <div key={item} className="vr-row">
                  <span className="vr-row-label">{item}</span>
                  <span className="vr-status s-warn">{t.status.unverified}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          <div className={`vr-rec ${recVariant === "clear" ? "clear" : recVariant === "moderate" ? "moderate" : ""}`}>
            <div className="vr-rec-label">{t.reports.recommendation}</div>
            <p className="vr-rec-text">{recText}</p>
          </div>

        </div>
      </div>
      </div>

      {isBasic && (
        <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-4 mb-6">
          <p className="text-[13px] text-amber-400/80 leading-relaxed">
            {t.warnings.publicRecordsOnly}
          </p>
        </div>
      )}

      {contract.status === "generated" ? (
        <>
          <p className="text-[15px] text-[#444] mb-5">
            {t.reports.agreementGenerated}
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
              {signingLoading ? t.reports.opening : t.cta.signAgreement}
            </button>
          )}

          {/* Download — secondary action */}
          <button onClick={handleDownload} className="text-[15px] text-[#666] hover:text-white transition-colors mb-6">
            {t.cta.downloadAgreement}
          </button>

          <div className="mb-6" />

          <div className="mb-8">
            <button
              onClick={handleShare}
              className="text-[15px] text-[var(--accent)] hover:text-blue-400 transition-colors"
            >
              {t.cta.shareTransaction}
            </button>
            <p className="text-[15px] text-[#666] mt-1">
              {t.fields.shareDescription}
            </p>
            {showShared && (
              <>
                <p className="text-[15px] text-[var(--foreground-muted)] leading-relaxed mt-3">
                  {t.fields.linkCopied}
                </p>
                <div className="flex gap-4 mt-2">
                  <button
                    onClick={() => window.open(shareUrl, "_blank")}
                    className="text-[15px] text-blue-400 underline"
                  >
                    {t.cta.openLink}
                  </button>
                  <button
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, "_blank")}
                    className="text-[15px] text-green-400 underline"
                  >
                    {t.cta.shareWhatsApp}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            {t.fields.agreementDetails}
          </p>
          <div className="flex flex-col gap-6 mb-6">
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.buyerFullName}</p>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder={t.fields.legalName}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.buyerEmail}</p>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="buyer@email.com"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.sellerFullName}</p>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Full legal name"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.sellerEmail}</p>
              <input
                type="email"
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                placeholder="seller@email.com"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.salePrice}</p>
              <input
                type="text"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="e.g. 120,000"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.cityState}</p>
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
            {t.fields.reviewConfirm}
          </p>
          {(risk.confidence < 40 || transaction.documents.invoice.status !== "uploaded") && (
            <p className="text-[15px] text-amber-400/80 leading-relaxed mb-4">
              {t.warnings.incompleteData}
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
              {t.cta.generateAgreement}
            </button>
          ) : (
            <>
              <button
                onClick={() => goToStep("check")}
                className="w-full bg-[#B4531A] hover:opacity-85 text-white shadow-[0_4px_16px_rgba(180,83,26,.28)] text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left"
              >
                {t.cta.resolveIssues}
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
                {t.cta.continueAnyway}
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
          {t.cta.downloadRecord}
        </button>
      </div>

      {showForm ? (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            {t.fields.addMaintenance}
          </p>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.type}</p>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as MaintenanceRecordType)}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2"
              >
                <option value="service">{t.fields.service}</option>
                <option value="repair">{t.fields.repair}</option>
                <option value="inspection">{t.fields.inspection}</option>
              </select>
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.title}</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Oil change"
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 placeholder:text-[var(--foreground-muted)]"
              />
            </div>
            <div>
              <p className="text-base text-[#444] mb-2">{t.fields.date}</p>
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
              {t.reports.recordSaved}
            </p>
          )}
          <button
            onClick={() => { setShowForm(true); setShowMaintenanceSaved(false); }}
            className="text-[15px] text-[var(--accent)] hover:text-blue-400 transition-colors"
          >
            {t.cta.addMaintenance}
          </button>
        </>
      )}
    </section>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function AIInterface({ plan, dbStatus }: { plan: "39" | "69" | null; dbStatus?: string }) {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
  const stepContent = getStepContent(lang);
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
        ← {t.steps[prevStep.key as keyof typeof t.steps] ?? prevStep.label}
      </button>
    </div>
  ) : null;

  const changesBanner = returnedToStep === current_step ? (
    <div className="mt-3 mb-1 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
      <p className="text-xs text-amber-400 leading-relaxed">
        {t.warnings.changesDetected}
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
              {t.steps.upload}
            </span>
          </div>

          <h2 className="text-[28px] font-semibold text-[var(--foreground)] mb-6 leading-snug">
            {t.steps.uploadHeading}
          </h2>

          <p className="text-[18px] text-[#444] leading-relaxed mb-10">
            {t.steps.uploadBody}
          </p>

          {/* Vehicle info */}
          <p className="text-[11px] uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            {t.fields.vehicleDetails}
          </p>
          <div className="flex flex-col gap-6 mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-base text-[#444] mb-2">{t.fields.make}</p>
                <input
                  type="text"
                  defaultValue={vehicle.make}
                  onBlur={(e) => updateVehicle({ make: e.target.value.trim() })}
                  placeholder="e.g. Nissan"
                  className="w-full bg-white border border-[rgba(0,0,0,0.12)] text-[#111111] text-base rounded-lg px-3 py-2.5 placeholder:text-[#999999] focus:outline-none focus:border-[rgba(0,0,0,0.3)]"
                />
              </div>
              <div className="flex-1">
                <p className="text-base text-[#444] mb-2">{t.fields.model}</p>
                <input
                  type="text"
                  defaultValue={vehicle.model}
                  onBlur={(e) => updateVehicle({ model: e.target.value.trim() })}
                  placeholder="e.g. Sentra"
                  className="w-full bg-white border border-[rgba(0,0,0,0.12)] text-[#111111] text-base rounded-lg px-3 py-2.5 placeholder:text-[#999999] focus:outline-none focus:border-[rgba(0,0,0,0.3)]"
                />
              </div>
              <div className="w-24">
                <p className="text-base text-[#444] mb-2">{t.fields.year}</p>
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
                <p className="text-base text-[#444] mb-2">{t.fields.vinRecommended}</p>
                <input
                  type="text"
                  defaultValue={vehicle.vin ?? ""}
                  onBlur={(e) => updateVehicle({ vin: e.target.value.trim() || undefined })}
                  placeholder="17-character VIN"
                  className="w-full bg-white border border-[rgba(0,0,0,0.12)] text-[#111111] text-base rounded-lg px-3 py-2.5 placeholder:text-[#999999] font-mono focus:outline-none focus:border-[rgba(0,0,0,0.3)]"
                />
              </div>
              <div className="flex-1">
                <p className="text-base text-[#444] mb-2">{t.fields.plateRecommended}</p>
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
            {t.fields.vinBenefit}
          </p>

          {/* Document upload progress */}
          {uploadedDocs > 0 && !allUploaded && (
            <div className="border border-[var(--border)] rounded-lg px-4 py-4 mb-6">
              <p className="text-[15px] text-[#444] leading-relaxed">
                {uploadedDocs} {t.panels.of} 3 {t.warnings.documentsPartialCount}
              </p>
            </div>
          )}

          {/* Warning: no identifier — non-blocking, shown once minimum input is met */}
          {hasDocs && !hasIdentifier && (
            <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-4 mb-4">
              <p className="text-[15px] text-amber-400 leading-relaxed">
                {t.warnings.reduceAccuracy}
              </p>
            </div>
          )}

          {/* Hard gate warning — shown only when nothing has been provided */}
          {!hasMinimumInput && (
            <div className="border border-[var(--border)] rounded-lg px-4 py-4 mb-4">
              <p className="text-[15px] text-[#444] leading-relaxed">
                {t.warnings.addVinOrDoc}
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
              ? t.warnings.addVinOrDoc
              : !hasIdentifier
              ? t.steps.uploadAction
              : t.steps.uploadAction}
          </button>

          {vehicleComplete && !allUploaded && uploadedDocs > 0 && (
            <p className="text-[15px] text-[#666] leading-relaxed">
              {t.warnings.addMoreDocuments}
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
              {t.steps.check}
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
                {t.warnings.needMoreInfo}
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
              {t.steps.analyze}
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
              {t.steps.verify}
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
