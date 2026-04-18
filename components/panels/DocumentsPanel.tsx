"use client";

import { useRef, useEffect, useState } from "react";
import { useTransaction } from "@/context/TransactionContext";
import { DocumentType, DOCUMENT_LABELS } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";


const DOCUMENT_TYPES: DocumentType[] = ["ine", "registration", "invoice"];

export default function DocumentsPanel() {
  const { transaction, uploadDocument } = useTransaction();
  const { documents } = transaction;
  const [uploading, setUploading] = useState<Partial<Record<DocumentType, boolean>>>({});

  const allUploaded =
    documents.ine?.status === "uploaded" &&
    documents.registration?.status === "uploaded" &&
    documents.invoice?.status === "uploaded";

  const inputRefs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    ine: null,
    registration: null,
    invoice: null,
  });

  // Notify admin when all documents transition to complete for the first time.
  // Guard: localStorage key prevents duplicate alerts across page reloads.
  useEffect(() => {
    if (!allUploaded) return;
    const key = `docs_notified_${transaction.id}`;
    if (localStorage.getItem(key)) return;

    fetch("/api/notify/docs-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionId: transaction.id,
        hasINE: documents.ine?.status === "uploaded",
        hasFactura: documents.invoice?.status === "uploaded",
        hasCirculation: documents.registration?.status === "uploaded",
        plate: transaction.vehicle.plate ?? transaction.vehicle.vin ?? undefined,
      }),
    })
      .then(() => {
        localStorage.setItem(key, "1");
      })
      .catch(() => {
        // Notification failure is non-critical — silently ignore
      });
  }, [allUploaded, transaction.id, documents, transaction.vehicle]);

  // Verify and Complete steps own their own full UI — panels must not bleed in.
  if (transaction.current_step === "verify" || transaction.current_step === "complete") return null;

  async function handleFileChange(docType: DocumentType, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading((prev) => ({ ...prev, [docType]: true }));
    try {
      const supabase = createClient();
      const filePath = `transactions/${transaction.id}/${docType}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("[upload] storage error:", {
          docType,
          filePath,
          message: uploadError.message,
          error: uploadError,
        });
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);
      const file_url = publicUrlData?.publicUrl;

      if (!file_url) {
        throw new Error("[upload] getPublicUrl returned empty URL");
      }

      console.log("[upload] dispatching:", { docType, file_name: file.name, file_url });
      uploadDocument(docType, file.name, file_url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown upload error";
      console.error("[upload] failed:", message, err);
      alert(`Upload failed: ${message}. Please try again.`);
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }));
    }
  }

  return (
    <section className="border-t border-[var(--border)] py-6">
      <h3 className="text-xs uppercase tracking-widest text-[var(--foreground-muted)] mb-4">
        Required documents
      </h3>

      <ul className="flex flex-col gap-4">
        {DOCUMENT_TYPES.map((docType) => {
          const doc = documents[docType] ?? { status: "missing" as const };
          const isUploaded = doc.status === "uploaded";

          return (
            <li key={docType} className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-white">{DOCUMENT_LABELS[docType]}</p>
                {isUploaded && (
                  <div className="mt-0.5">
                    <p className="text-xs text-[var(--foreground-muted)] font-mono truncate max-w-[240px]">
                      {doc.file_name}
                    </p>
                    <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">
                      Uploaded
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <input
                  ref={(el) => { inputRefs.current[docType] = el; }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => handleFileChange(docType, e)}
                />
                {uploading[docType] ? (
                  <span className="text-xs text-[var(--foreground-muted)]">Uploading…</span>
                ) : isUploaded ? (
                  <button
                    onClick={() => inputRefs.current[docType]?.click()}
                    className="text-xs text-[var(--foreground-muted)] hover:text-white transition-colors"
                  >
                    Replace
                  </button>
                ) : (
                  <button
                    onClick={() => inputRefs.current[docType]?.click()}
                    className="text-xs text-[var(--accent)] hover:text-blue-400 transition-colors"
                  >
                    Upload document
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {allUploaded && (
        <p className="text-xs text-[var(--foreground-muted)] mt-4">
          All required documents uploaded.
        </p>
      )}

    </section>
  );
}
