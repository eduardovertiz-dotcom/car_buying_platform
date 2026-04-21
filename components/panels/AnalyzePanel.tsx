"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTransaction } from "@/context/TransactionContext";
import { computeRisk } from "@/lib/risk";
import { track } from "@/lib/track";
import { hasMinimumInput as computeHasMinimumInput } from "@/lib/guards";
import { stepEngineCopy } from "@/lib/i18n/stepEngine";

export default function AnalyzePanel({ plan }: { plan: "39" | "69" | null }) {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
  const { transaction, advanceStep, advanceToStep, goToStep, isDecisionMade } = useTransaction();
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [geoCurrency, setGeoCurrency] = useState("");
  const showUpgrade = plan === "39";

  useEffect(() => {
    fetch("/api/geo-currency")
      .then((r) => r.json())
      .then(({ currency }: { currency: string }) => setGeoCurrency(currency.toUpperCase()))
      .catch(() => {});
  }, []);

  const hasMinimumInput = computeHasMinimumInput(transaction);
  const risk = computeRisk(transaction, lang);

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
    track("upgrade_clicked");
    setUpsellLoading(true);
    try {
      if (process.env.NODE_ENV === "development") {
        const res = await fetch(`/api/transactions/${transaction.id}/upgrade`, { method: "POST" });
        await res.json();
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

  if (!hasMinimumInput) {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-2xl font-semibold text-[var(--foreground)] leading-snug">
          {t.warnings.moreInformation}
        </h2>
        <p className="text-[18px] text-[#444] leading-relaxed">
          {t.warnings.needMoreInfoAnalyze}
        </p>
        <button
          onClick={() => goToStep("upload")}
          className="w-full bg-[#B4531A] hover:opacity-90 text-white shadow-[0_4px_16px_rgba(180,83,26,.28)] text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
        >
          ← Back to Upload
        </button>
      </div>
    );
  }

  const { vehicle, documents } = transaction;
  const hasIssues   = risk.issues.length > 0;
  const hasUnknowns = risk.unknowns.length > 0;

  const pillText = hasIssues ? t.reports.issuesDetected : hasUnknowns ? t.status.caution : null;

  const recVariant = hasIssues ? "risk" : hasUnknowns ? "moderate" : "clear";
  const recText    = hasIssues
    ? t.decision.resolveIssues
    : hasUnknowns
    ? t.decision.verifyItems
    : t.decision.noBlockingIssues;

  return (
    <>
      {/* ── Report card ─────────────────────────────────────────── */}
      <div className="vr-wrap">
        {pillText && (
          <div className={`vr-pill${hasIssues ? "" : " warn"}`}>{pillText}</div>
        )}
        <div className="vr-card">
          <div className="vr-header">
            <span className="vr-title">{t.reports.verificationReport}</span>
          </div>
          <div className="vr-body">

            {/* Outstanding issues — first when present */}
            {hasIssues && (
              <div className="vr-section">
                <div className="vr-k">{t.reports.outstandingIssues}</div>
                {risk.issues.map((item) => (
                  <div key={item} className="vr-row">
                    <span className="vr-row-label">{item}</span>
                    <span className="vr-status s-risk">{t.status.issue}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Ownership */}
            <div className="vr-section">
              <div className="vr-k">{t.fields.ownership}</div>
              <div className="vr-row">
                <span className="vr-row-label">{t.fields.ownershipInvoice}</span>
                <span className={`vr-status ${documents.invoice.status === "uploaded" ? "s-ok" : "s-warn"}`}>
                  {documents.invoice.status === "uploaded" ? t.status.submitted : t.status.notProvided}
                </span>
              </div>
              <div className="vr-row">
                <span className="vr-row-label">{t.fields.vin}</span>
                <span className={`vr-status ${vehicle.vin?.trim() ? "s-ok" : "s-warn"}`}>
                  {vehicle.vin?.trim() ? t.status.provided : t.status.notProvided}
                </span>
              </div>
              <div className="vr-row">
                <span className="vr-row-label">{t.fields.licensePlate}</span>
                <span className={`vr-status ${vehicle.plate?.trim() ? "s-ok" : "s-warn"}`}>
                  {vehicle.plate?.trim() || t.status.notProvided}
                </span>
              </div>
            </div>

            {/* Document integrity */}
            <div className="vr-section">
              <div className="vr-k">{t.reports.documentIntegrity}</div>
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

            {/* Verified */}
            {risk.resolved.length > 0 && (
              <div className="vr-section">
                <div className="vr-k">{t.reports.verified}</div>
                {risk.resolved.map((item) => (
                  <div key={item} className="vr-row">
                    <span className="vr-row-label">{item}</span>
                    <span className="vr-status s-ok">{t.status.verified}</span>
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

      {/* Upgrade block — Basic plan only */}
      {showUpgrade && (
        <div className="border border-[var(--border)] rounded-lg px-5 py-5 mb-6">
          <p className="text-[15px] font-semibold text-[var(--foreground)] mb-2">
            {t.fields.expertAvailable}
          </p>
          <p className="text-[14px] text-[#444] leading-relaxed mb-4">
            {t.warnings.automatedLimited}
          </p>
          <button
            onClick={handleUpgrade}
            disabled={upsellLoading}
            className="w-full bg-[#B4531A] hover:opacity-85 text-white text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left shadow-[0_4px_16px_rgba(180,83,26,.28)] disabled:opacity-60 disabled:shadow-none"
          >
            {upsellLoading ? t.reports.redirecting : t.cta.proceedVerification}
          </button>
          {geoCurrency && (
            <p style={{ marginTop: 10, fontSize: 12, color: "#444", fontWeight: 400, lineHeight: 1.4 }}>
              {lang === "es" ? `El cargo se realizará en ${geoCurrency}` : `You will be charged in ${geoCurrency}`}
              {geoCurrency === "MXN" && <><br />{lang === "es" ? "Requerido para compatibilidad con bancos en México" : "Required for compatibility with Mexican banks"}</>}
            </p>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => {
          if (process.env.NODE_ENV === "development") {
            console.log("ACTION: CONTINUE", { step: "analyze", transactionId: transaction.id });
          }
          if (plan === "39") advanceToStep("complete"); else advanceStep();
        }}
        className={`w-full text-base font-semibold px-5 py-4 rounded-lg transition-opacity text-left ${
          showUpgrade
            ? "bg-transparent border border-[var(--border)] hover:border-black/20 text-[#444]"
            : "bg-[#B4531A] hover:opacity-85 text-white shadow-[0_4px_16px_rgba(180,83,26,.28)]"
        }`}
      >
        {showUpgrade
          ? t.cta.proceedWithoutFull
          : plan === "69"
          ? t.cta.proceedVerification
          : t.cta.proceedAgreement}
      </button>
    </>
  );
}
