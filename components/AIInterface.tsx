"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import { useTransaction } from "@/context/TransactionContext";
import { STEPS, Step, MaintenanceRecordType } from "@/lib/types";
import type { VerificationResult } from "@/lib/types";
import AnalyzePanel from "@/components/panels/AnalyzePanel";
import { generateAgreementHTML } from "@/lib/agreement";

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
    requestBasicVerification,
    completeBasicVerification,
    requestProfessionalVerification,
    completeProfessionalVerification,
  } = useTransaction();

  const { verification_status, documents, vehicle } = transaction;
  const [showDocWarning, setShowDocWarning] = useState(false);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [verifyChecks, setVerifyChecks] = useState<VerifyChecks | null>(null);
  const [verifyError, setVerifyError] = useState(false);
  const [verifyMode, setVerifyMode] = useState<"manual" | "automated" | null>(null);

  const allDocumentsUploaded =
    documents.ine.status === "uploaded" &&
    documents.registration.status === "uploaded" &&
    documents.invoice.status === "uploaded";

  // Auto-trigger verification on mount based on plan.
  // Handles both first arrival and post-upgrade ($49 → $79).
  useEffect(() => {
    if (!plan) return;

    const shouldRunProfessional =
      plan === "79" &&
      (verification_status === "not_started" || verification_status === "basic_complete");
    const shouldRunBasic =
      plan === "49" && verification_status === "not_started";

    if (!shouldRunProfessional && !shouldRunBasic) return;

    // Require at least one vehicle identifier before calling API
    const plate = vehicle.plate || vehicle.vin;
    if (!plate) return;

    if (shouldRunProfessional) requestProfessionalVerification();
    else requestBasicVerification();

    // Call real verification API
    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { success: boolean; mode?: string; checks: VerifyChecks }) => {
        const mode = data.mode === "manual" ? "manual" : "automated";
        setVerifyMode(mode);

        if (mode === "manual") {
          // Manual mode: advance the step with a neutral result.
          // The UI will show the "in progress" message instead of check results.
          const manualResult: VerificationResult = {
            status: "safe",
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
        setVerifyError(true);
        // Proceed to complete state so UX isn't blocked
        const fallbackResult: VerificationResult = {
          status: "review",
          summary: "Verification could not be completed. Review manually.",
          findings: ["Automated verification unavailable"],
          confidence: 0,
        };
        if (shouldRunProfessional) completeProfessionalVerification(fallbackResult);
        else completeBasicVerification(fallbackResult);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpsell() {
    if (!allDocumentsUploaded) {
      setShowDocWarning(true);
      return;
    }
    setShowDocWarning(false);
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
        {/* Results section — manual message or real check results */}
        {verifyMode === "manual" ? (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
              Verification Results
            </p>
            <p className="text-sm font-medium leading-relaxed text-[var(--foreground-muted)]">
              Your verification is in progress.
            </p>
            <p className="text-sm leading-relaxed text-[var(--foreground-muted)] mt-1">
              Our team will review your vehicle and documents. You&apos;ll receive results within 24 hours.
            </p>
          </div>
        ) : (
          <>
            {verifyError && (
              <p className="text-sm text-amber-400 leading-relaxed mb-4">
                Some checks could not be completed. You can still proceed.
              </p>
            )}

            {(repuveResult || facturaResult) && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
                  Verification Results
                </p>

                {allUnavailable ? (
                  <div className="mb-2">
                    <p className="text-sm font-medium leading-relaxed text-[var(--foreground-muted)]">
                      Verification could not be completed at this time.
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

                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-3">
                  If any issues appear, we recommend verifying directly with the seller before proceeding.
                </p>
              </div>
            )}
          </>
        )}

        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Public records checked. Some risks won&apos;t appear here.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
          Basic verification queries official databases — it cannot detect
          document alterations, confirm the seller&apos;s true identity, or flag
          risks that exist outside the public record.
        </p>

        <button
          onClick={handleUpsell}
          disabled={upsellLoading}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left mb-4 disabled:opacity-60"
        >
          {upsellLoading ? "Redirecting…" : "Upgrade to full verification — $30"}
        </button>

        {showDocWarning && (
          <p className="text-xs text-amber-400 leading-relaxed mb-3">
            Upload the required documents to continue with full verification.
          </p>
        )}
        {allDocumentsUploaded && !showDocWarning && (
          <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-3">
            Documents ready. You can proceed with full verification.
          </p>
        )}

        <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-2">
          A human reviewer checks the physical documents, confirms seller
          identity, and flags patterns that don&apos;t appear in automated checks.
        </p>
        <button
          onClick={advanceStep}
          className="text-xs text-[var(--foreground-muted)] hover:text-white transition-colors underline underline-offset-2"
        >
          Continue with basic results
        </button>
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
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Full verification complete
        </h2>

        {/* Results section — manual message or real check results */}
        {verifyMode === "manual" ? (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
              Verification Results
            </p>
            <p className="text-sm font-medium leading-relaxed text-[var(--foreground-muted)]">
              Your verification is in progress.
            </p>
            <p className="text-sm leading-relaxed text-[var(--foreground-muted)] mt-1">
              Our team will review your vehicle and documents. You&apos;ll receive results within 24 hours.
            </p>
          </div>
        ) : (
          <>
            {verifyError && (
              <p className="text-sm text-amber-400 leading-relaxed mb-4">
                Some checks could not be completed. You can still proceed.
              </p>
            )}

            {(repuveResult || facturaResult) && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
                  Verification Results
                </p>

                {allUnavailable ? (
                  <div className="mb-2">
                    <p className="text-sm font-medium leading-relaxed text-[var(--foreground-muted)]">
                      Verification could not be completed at this time.
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

                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-3">
                  If any issues appear, we recommend verifying directly with the seller before proceeding.
                </p>
              </div>
            )}
          </>
        )}

        <button
          onClick={advanceStep}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
        >
          Proceed to complete
        </button>
      </>
    );
  }

  return null;
}

// ─── Complete ────────────────────────────────────────────────────────────────

function CompleteInterface({ plan }: { plan: "49" | "79" | null }) {
  const { transaction, generateContract, updateAgreementFields, addMaintenanceRecord, enableShare, revokeShare } = useTransaction();
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
  }

  const [showForm, setShowForm] = useState(false);
  const [showMaintenanceSaved, setShowMaintenanceSaved] = useState(false);
  const [showShared, setShowShared] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

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
        {isBasic ? "Your risk summary" : "Final verification results"}
      </h2>

      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
        {isBasic
          ? "Basic checks are complete. Some risks — document alterations, seller identity, off-record fraud — cannot be verified automatically."
          : "Full verification is complete. Documents, ownership, and risk signals have been reviewed."}
      </p>

      {isBasic && (
        <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-4 mb-6">
          <p className="text-xs text-amber-400 leading-relaxed">
            This report covers public records only. Proceed at your own risk, or upgrade for expert review.
          </p>
        </div>
      )}

      {contract.status === "generated" ? (
        <>
          <p className="text-sm text-[var(--foreground-muted)] mb-2">
            Purchase agreement generated
          </p>
          <button onClick={handleDownload} className="text-sm text-white underline mb-4">
            Download purchase agreement
          </button>
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
  const { transaction, advanceStep, goToStep, returnedToStep } = useTransaction();
  const { current_step } = transaction;
  const currentIndex = STEPS.findIndex((s) => s.key === current_step);

  const prevStep = currentIndex > 0 ? STEPS[currentIndex - 1] : null;

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

  if (current_step === "analyze") {
    return (
      <>
        {backLink}
        {changesBanner}
        <section className="py-8">
          <div className="mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
              {STEPS[currentIndex].label}
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

  const content = stepContent[current_step];

  return (
    <>
    {backLink}
    {changesBanner}
    <section className="py-8">
      <div className="mb-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
          {STEPS[currentIndex].label}
        </span>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
        {content.heading}
      </h2>

      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
        {content.body}
      </p>

      <button
        onClick={advanceStep}
        className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
      >
        {content.action}
      </button>

      {content.contextLine && (
        <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-3">
          {content.contextLine}
        </p>
      )}
    </section>
    </>
  );
}
