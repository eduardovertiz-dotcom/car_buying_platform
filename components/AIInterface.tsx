"use client";

import { useEffect, useRef, useState } from "react";
import { useTransaction } from "@/context/TransactionContext";
import { STEPS, Step, MaintenanceRecordType } from "@/lib/types";
import { mockBasicResults, mockProfessionalResults } from "@/lib/mock";

type StepContent = {
  heading: string;
  body: string;
  action: string;
  completedAction: string;
};

const stepContent: Record<Step, StepContent> = {
  understand: {
    heading: "Before you move forward",
    body: "Buying a car from a private seller in Mexico carries real risks — hidden debt, ownership mismatches, falsified factura, cloned or stolen vehicles, and payment fraud. Most buyers don't check all of this. This system will guide you through each step so you don't miss anything important.",
    action: "I understand — begin the process",
    completedAction: "Step completed",
  },
  find: {
    heading: "Finding the right vehicle",
    body: "Before evaluating a specific car, define what you're looking for and where to look. Knowing the year, make, and model that fits your budget and needs reduces exposure to bad deals.",
    action: "I have a vehicle in mind — continue",
    completedAction: "Step completed",
  },
  evaluate: {
    heading: "Evaluating this vehicle",
    body: "Assess the vehicle critically. Review the physical condition, documentation, and seller behavior. Red flags at this stage are easier to walk away from than problems discovered after payment.",
    action: "Evaluation complete — proceed to verification",
    completedAction: "Step completed",
  },
  verify: {
    heading: "",
    body: "",
    action: "",
    completedAction: "",
  },
  complete: {
    heading: "Transaction completed",
    body: "This record will remain accessible whenever you need it.",
    action: "Add first maintenance record",
    completedAction: "Add first maintenance record",
  },
};

function VerifyInterface() {
  const {
    transaction,
    advanceStep,
    requestBasicVerification,
    completeBasicVerification,
    requestProfessionalVerification,
    completeProfessionalVerification,
  } = useTransaction();

  const { verification_status, documents } = transaction;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDocWarning, setShowDocWarning] = useState(false);

  const allDocumentsUploaded =
    documents.ine.status === "uploaded" &&
    documents.registration.status === "uploaded" &&
    documents.invoice.status === "uploaded";

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleRunBasic() {
    requestBasicVerification();
    timerRef.current = setTimeout(() => {
      completeBasicVerification(mockBasicResults);
    }, 3000);
  }

  function handleRunProfessional() {
    if (!allDocumentsUploaded) {
      setShowDocWarning(true);
      return;
    }
    setShowDocWarning(false);
    requestProfessionalVerification();
    timerRef.current = setTimeout(() => {
      completeProfessionalVerification(mockProfessionalResults);
    }, 4000);
  }

  if (verification_status === "not_started") {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          This is where important issues are often overlooked.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
          Basic verification checks REPUVE, outstanding liens, VIN registry, and
          factura structure against public databases. Results come back
          immediately. What it cannot check: document manipulation, identity
          mismatches, or risks that don&apos;t appear in official records.
        </p>
        <button
          onClick={handleRunBasic}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left"
        >
          Run basic verification — $49
        </button>
      </>
    );
  }

  if (verification_status === "basic_processing") {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Running basic verification
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Checking REPUVE, outstanding liabilities, factura validity, and VIN
          registry. This will take a moment.
        </p>
        <div className="border border-[var(--border)] rounded-lg px-5 py-4">
          <p className="text-sm text-[var(--foreground-muted)]">
            Querying registries — do not close this page.
          </p>
        </div>
      </>
    );
  }

  if (verification_status === "basic_complete") {
    return (
      <>
        <p className="text-sm text-white leading-relaxed mb-4">
          Based on the checks, there is an outstanding lien associated with this vehicle.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          This does not necessarily prevent the transaction, but it should be clarified
          with the seller before proceeding. Liens can delay or block ownership transfer
          if unresolved.
        </p>

        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Public records checked. Some risks won&apos;t appear here.
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
          Basic verification queries official databases — it cannot detect
          document alterations, confirm the seller&apos;s true identity, or flag
          risks that exist outside the public record. These are the issues that
          typically surface after the transaction is completed.
        </p>
        <button
          onClick={handleRunProfessional}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left mb-4"
        >
          Get professional verification — $79
        </button>
        {showDocWarning && (
          <p className="text-xs text-amber-400 leading-relaxed mb-3">
            Upload the required documents to continue with professional verification.
          </p>
        )}
        {allDocumentsUploaded && !showDocWarning && (
          <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-3">
            Documents ready. You can proceed with professional verification.
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
          Continue without professional verification
        </button>
      </>
    );
  }

  if (verification_status === "professional_processing") {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Professional verification in progress
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          The Nexcar team is reviewing documents, validating identity, and
          running advanced fraud checks. This may take a few minutes.
        </p>
        <div className="border border-[var(--border)] rounded-lg px-5 py-4">
          <p className="text-sm text-[var(--foreground-muted)]">
            Human review in progress — you will be notified when complete.
          </p>
        </div>
      </>
    );
  }

  if (verification_status === "professional_complete") {
    return (
      <>
        <h2 className="text-lg font-semibold text-white mb-4 leading-snug">
          Professional verification complete
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
          Full results are shown below. Review the findings before proceeding
          to complete the transaction.
        </p>
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

function CompleteInterface() {
  const { transaction, generateContract, addMaintenanceRecord, enableShare, revokeShare } = useTransaction();
  const { contract, share } = transaction;
  const content = stepContent["complete"];

  const [showForm, setShowForm] = useState(false);
  const [showMaintenanceSaved, setShowMaintenanceSaved] = useState(false);
  const [showShared, setShowShared] = useState(false);

  function handleShare() {
    const token =
      share.token ??
      `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!share.enabled) {
      enableShare(token);
    }
    navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
    setShowShared(true);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleRevokeShare() {
    revokeShare();
    setShowShared(false);
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
        {content.heading}
      </h2>

      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
        {content.body}
      </p>

      {contract.status === "generated" ? (
        <>
          <p className="text-sm text-[var(--foreground-muted)] mb-2">
            Purchase agreement generated
          </p>
          <button className="text-sm text-white underline mb-4">
            Download purchase agreement
          </button>
          <div className="mb-8">
            <button
              onClick={handleShare}
              className="text-sm text-[var(--accent)] hover:text-blue-400 transition-colors"
            >
              Copy share link
            </button>
            {showShared && (
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mt-3">
                Share link copied.
              </p>
            )}
          </div>
        </>
      ) : (
        <button
          onClick={generateContract}
          className="w-full bg-[var(--accent)] hover:bg-blue-600 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors text-left mb-8"
        >
          Generate purchase agreement
        </button>
      )}

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

export default function AIInterface() {
  const { transaction, advanceStep } = useTransaction();
  const { current_step } = transaction;
  const currentIndex = STEPS.findIndex((s) => s.key === current_step);

  if (current_step === "verify") {
    return (
      <section className="py-8">
        <div className="mb-2">
          <span className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)]">
            Verify
          </span>
        </div>
        <VerifyInterface />
      </section>
    );
  }

  if (current_step === "complete") {
    return <CompleteInterface />;
  }

  const content = stepContent[current_step];

  return (
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
    </section>
  );
}
