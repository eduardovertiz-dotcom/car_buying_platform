"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import FacturaForm from "@/components/FacturaForm";

interface TransactionCompleteProps {
  transactionId: string;
  email: string | null;
}

export default function TransactionComplete({ transactionId, email }: TransactionCompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const facturaRef = useRef<HTMLDivElement>(null);

  function handleOpen() {
    setIsOpen(true);
    // Scroll into view after React paints the revealed section
    setTimeout(() => {
      facturaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <>
      <div className="pt-10 pb-8">
        <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-3">
          Payment confirmed
        </p>
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
          Your verification is ready
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Your transaction has been created. You can begin the verification process or request a factura below.
        </p>
      </div>

      {/* Primary CTA */}
      <div className="mb-8">
        <Link
          href={`/transaction/${transactionId}`}
          className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-5 py-3 hover:opacity-90 transition-opacity"
        >
          Start verification →
        </Link>
      </div>

      <div className="h-px bg-white/[0.06] mb-8" />

      {/* Secondary toggle */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors"
        >
          Request Invoice (Factura)
        </button>
      )}

      {/* Factura form — revealed on toggle */}
      {isOpen && (
        <div ref={facturaRef}>
          <FacturaForm transactionId={transactionId} prefillEmail={email} />
        </div>
      )}
    </>
  );
}
