"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Transaction } from "@/lib/types";
import { DOCUMENT_LABELS } from "@/lib/types";

interface Props {
  transactionId: string;
}

export default function RecordClient({ transactionId }: Props) {
  const [transaction, setTransaction] = useState<Transaction | null | undefined>(undefined);

  useEffect(() => {
    const raw = localStorage.getItem(`transaction_${transactionId}`);
    if (!raw) { setTransaction(null); return; }
    try {
      setTransaction(JSON.parse(raw) as Transaction);
    } catch {
      setTransaction(null);
    }
  }, [transactionId]);

  if (transaction === undefined) return null;

  if (!transaction) {
    return (
      <p className="text-sm text-[var(--foreground-muted)] mt-10">
        Record data not available on this device. Open the transaction to load it first.
      </p>
    );
  }

  const { vehicle, verification_results, verification_status, documents, contract } = transaction;

  const riskColor =
    verification_results?.status === "high_risk" ? "text-red-400" :
    verification_results?.status === "review"     ? "text-yellow-400" :
    verification_results?.status === "safe"       ? "text-green-400" :
    "text-[var(--foreground-muted)]";

  const verificationLabel: Record<string, string> = {
    not_started:              "Not started",
    basic_processing:         "In progress",
    basic_complete:           "Complete",
    professional_processing:  "In progress",
    professional_complete:    "Complete",
  };

  return (
    <div>
      {/* Vehicle header */}
      <div className="py-6 border-b border-[var(--border)] mb-8">
        <h1 className="text-lg font-semibold text-white">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h1>
        {vehicle.vin && (
          <p className="text-xs text-[var(--foreground-muted)] font-mono mt-0.5">{vehicle.vin}</p>
        )}
        {vehicle.plate && (
          <p className="text-xs text-[var(--foreground-muted)] font-mono mt-0.5">{vehicle.plate}</p>
        )}
        <p className="text-xs text-[var(--foreground-muted)] mt-1 font-mono">
          {transactionId.slice(0, 8).toUpperCase()}
        </p>
      </div>

      {/* Verification */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
          Verification
        </h2>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-[var(--foreground-muted)]">Status</span>
          <span className="text-white">{verificationLabel[verification_status] ?? verification_status}</span>
        </div>
        {verification_results && (
          <>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-[var(--foreground-muted)]">Risk level</span>
              <span className={riskColor}>{verification_results.status.replace("_", " ")}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-[var(--foreground-muted)]">Confidence</span>
              <span className="text-white">{verification_results.confidence}%</span>
            </div>
            {verification_results.summary && (
              <p className="text-xs text-[var(--foreground-muted)] mt-3 leading-relaxed">
                {verification_results.summary}
              </p>
            )}
          </>
        )}
      </section>

      {/* Documents */}
      <section className="border-t border-[var(--border)] pt-6 mb-8">
        <h2 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
          Documents
        </h2>
        <ul className="flex flex-col gap-4">
          {(["ine", "registration", "invoice"] as const).map((docType) => {
            const doc = documents[docType];
            return (
              <li key={docType} className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-white">{DOCUMENT_LABELS[docType]}</p>
                  {doc.status === "uploaded" && (
                    <p className="text-xs text-[var(--foreground-muted)] font-mono mt-0.5 truncate max-w-[240px]">
                      {doc.file_name}
                    </p>
                  )}
                </div>
                <span className="text-xs shrink-0">
                  {doc.status === "uploaded"
                    ? <span className="text-green-400">Uploaded</span>
                    : <span className="text-[var(--foreground-muted)]">Missing</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Agreement */}
      {contract.status === "generated" && (
        <section className="border-t border-[var(--border)] pt-6 mb-8">
          <h2 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
            Agreement
          </h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white">Purchase agreement</span>
            <span className="text-green-400 text-xs">Generated</span>
          </div>
        </section>
      )}

      {/* Download */}
      <div className="border-t border-[var(--border)] pt-8">
        <Link
          href={`/transaction/${transactionId}`}
          className="inline-block text-sm text-[var(--accent)] hover:text-blue-400 transition-colors"
        >
          Download full record →
        </Link>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Opens the transaction to generate and download the complete dossier ZIP.
        </p>
      </div>
    </div>
  );
}
