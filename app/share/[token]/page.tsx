"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Transaction } from "@/lib/types";
import { DOCUMENT_LABELS, STEPS } from "@/lib/types";
import { generateAgreementHTML } from "@/lib/agreement";

function findTransactionByToken(token: string): Transaction | null {
  const raw = localStorage.getItem(`share_${token}`);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    if (!t || t.share?.token !== token) return null;
    return t;
  } catch {
    return null;
  }
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [transaction, setTransaction] = useState<Transaction | null | undefined>(undefined);

  useEffect(() => {
    const found = findTransactionByToken(token);
    setTransaction(found);
  }, [token]);

  if (transaction === undefined) return null; // still loading

  if (!transaction || !transaction.share.enabled || transaction.share.token !== token) {
    return (
      <main className="px-6 pb-16">
        <div className="max-w-[680px] mx-auto py-16">
          <p className="text-xs text-[var(--foreground-muted)] mt-10">
            This shared record is no longer available.
          </p>
        </div>
      </main>
    );
  }

  const { vehicle, current_step, checklist_progress, documents, verification_results, verification_status, activity_log, contract, maintenance } = transaction;
  const currentStepLabel = STEPS.find((s) => s.key === current_step)?.label ?? current_step;

  // Last updated: most recent timestamp across activity log (last = newest), contract, maintenance
  const lastUpdatedRaw =
    activity_log[activity_log.length - 1]?.timestamp ||
    contract.created_at ||
    maintenance.records[maintenance.records.length - 1]?.date ||
    null;
  const lastUpdated = lastUpdatedRaw
    ? new Date(lastUpdatedRaw).toLocaleDateString("en-MX", { month: "short", day: "numeric", year: "numeric" })
    : null;

  function handleDownload() {
    if (!transaction) return;
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

  const verificationLabel: Record<string, string> = {
    not_started: "Not started",
    basic_processing: "In progress",
    basic_complete: "Basic complete",
    professional_processing: "In progress",
    professional_complete: "Professional complete",
  };

  return (
    <main className="px-6 pb-16">
      <div className="max-w-[680px] mx-auto">

        <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-4">
          Shared record — read-only
        </p>
        <div className="border border-amber-400/20 bg-amber-400/[0.06] rounded-lg px-4 py-3 mb-6">
          <p className="text-[13px] text-amber-400/80 leading-relaxed">
            This is a user-generated verification summary based on available data. It does not guarantee the safety or validity of the transaction.
          </p>
        </div>

        {/* Header */}
        <div className="py-6 border-b border-[var(--border)] mb-8">
          <h1 className="text-lg font-semibold text-white">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          {vehicle.vin && (
            <p className="text-xs text-[var(--foreground-muted)] font-mono mt-0.5">{vehicle.vin}</p>
          )}
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Record ID: {token.replace("share_", "").slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Version: 1.0
          </p>
          <p className="text-xs text-[var(--foreground-muted)] mt-2">
            {currentStepLabel} · {checklist_progress}% complete
          </p>
          {lastUpdated && (
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Last updated: {lastUpdated}
            </p>
          )}
          <p className="text-xs text-[var(--foreground-muted)] mt-3 mb-1">
            Record context
          </p>
          <p className="text-xs text-[var(--foreground-muted)]">
            Created by buyer during transaction process
          </p>
          <p className="text-xs text-[var(--foreground-muted)]">
            Includes document submission, verification checks, and activity tracking
          </p>
        </div>

        {/* Verification snapshot */}
        <div className="mb-6">
          <p className="text-xs text-[var(--foreground-muted)] mb-2">
            Verification snapshot
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--foreground-muted)]">Status</span>
            <span className="text-white">{verificationLabel[verification_status] ?? verification_status}</span>
          </div>
          {verification_results && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-[var(--foreground-muted)]">Confidence</span>
              <span className="text-white">{verification_results.confidence}%</span>
            </div>
          )}
          {verification_status === "basic_complete" && verification_results && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-[var(--foreground-muted)]">Scope</span>
              <span className="text-white">Public records</span>
            </div>
          )}
          <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-3">
            All sections reflect the same submitted record.
          </p>
          <p className="text-xs text-[var(--foreground-muted)] mt-2">
            Sections are aligned to this record version.
          </p>
        </div>

        {/* Documents */}
        <section className="mb-8">
          <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            Documents
          </h3>
          <ul className="flex flex-col gap-4">
            {(["ine", "registration", "invoice"] as const).map((docType) => {
              const doc = documents[docType];
              return (
                <li key={docType} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-white">{DOCUMENT_LABELS[docType]}</p>
                    {doc.status === "uploaded" && (
                      <div className="mt-0.5">
                        <p className="text-xs text-[var(--foreground-muted)] font-mono truncate max-w-[240px]">
                          {doc.file_name}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">Uploaded</p>
                      </div>
                    )}
                  </div>
                  {doc.status !== "uploaded" && (
                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed shrink-0">Not available</p>
                  )}
                </li>
              );
            })}
          </ul>

          {contract.status === "generated" && (
            <div className="mt-6">
              <p className="text-xs text-[var(--foreground-muted)] mb-2">AGREEMENT</p>
              <div className="space-y-1">
                <p className="text-sm text-white">{contract.file_name}</p>
                <p className="text-xs text-[var(--foreground-muted)]">Generated</p>
                <button onClick={handleDownload} className="text-sm text-white underline mt-1">
                  Download purchase agreement
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Verification */}
        <section className="border-t border-[var(--border)] py-6 mb-2">
          <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            Verification
          </h3>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--foreground-muted)]">Status</p>
            <p className="text-sm text-[var(--foreground-muted)]">
              {verification_status === "not_started" && "Not started"}
              {verification_status === "basic_complete" && "Basic complete"}
              {verification_status === "professional_complete" && "Professional complete"}
              {(verification_status === "basic_processing" || verification_status === "professional_processing") && "In progress"}
            </p>
          </div>
          {verification_results && (
            <>
              {verification_results.findings.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-2">Findings</p>
                  <ul className="flex flex-col gap-2">
                    {verification_results.findings.map((f, i) => (
                      <li key={i} className="text-sm text-[var(--foreground-muted)]">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4">
                <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-1">Confidence</p>
                <p className="text-sm text-[var(--foreground-muted)]">{verification_results.confidence}%</p>
              </div>
            </>
          )}
        </section>

        {/* Activity */}
        <section className="border-t border-[var(--border)] py-6">
          <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-1">
            Activity
          </h3>
          <p className="text-xs text-[var(--foreground-muted)] mb-4">
            Activity history
          </p>
          {activity_log.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">No activity recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {[...activity_log].reverse().map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-4">
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {entry.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-[var(--border)] shrink-0 font-mono">
                    {new Date(entry.timestamp).toLocaleDateString("en-MX", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {maintenance.records.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-3">
                Maintenance
              </h3>
              <ul className="flex flex-col gap-3">
                {[...maintenance.records].reverse().map((record) => (
                  <li key={record.id} className="flex items-start justify-between gap-4">
                    <p className="text-sm text-[var(--foreground-muted)]">{record.title}</p>
                    <p className="text-xs text-[var(--border)] shrink-0 font-mono">
                      {new Date(record.date).toLocaleDateString("en-MX", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-10">
          This record reflects submitted information, verification results, and recorded activity.
        </p>

      </div>
    </main>
  );
}
