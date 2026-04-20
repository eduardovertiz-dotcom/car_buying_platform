"use client";

import { TransactionProvider } from "@/context/TransactionContext";
import AnalyzePanel from "@/components/panels/AnalyzePanel";

export default function DevPreview() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-10 max-w-md mx-auto">
      <p className="text-xs text-[#666] mb-6 uppercase tracking-widest">Dev Preview — AnalyzePanel</p>

      <div className="mb-12">
        <p className="text-xs text-[#888] mb-3">Plan: $69 (no upsell, VIN provided)</p>
        <TransactionProvider transactionId="txn_001">
          <AnalyzePanel plan="69" />
        </TransactionProvider>
      </div>

      <div>
        <p className="text-xs text-[#888] mb-3">Plan: $39 (upsell shown, VIN provided)</p>
        <TransactionProvider transactionId="txn_001">
          <AnalyzePanel plan="39" />
        </TransactionProvider>
      </div>
    </div>
  );
}
