"use client";

import { TransactionProvider } from "@/context/TransactionContext";
import AIInterface from "@/components/AIInterface";
import Header from "@/components/Header";
import DocumentsPanel from "@/components/panels/DocumentsPanel";
import VerificationPanel from "@/components/panels/VerificationPanel";
import ActivityPanel from "@/components/panels/ActivityPanel";

function FullEngine({ plan }: { plan: "39" | "69" }) {
  return (
    <TransactionProvider transactionId="txn_001">
      <Header plan={plan} />
      <main className="px-6 pb-16">
        <div className="max-w-[680px] mx-auto">
          <AIInterface plan={plan} dbStatus="paid" />
          <DocumentsPanel />
          <VerificationPanel />
          <ActivityPanel />
        </div>
      </main>
    </TransactionProvider>
  );
}

export default function DevPreview() {
  return <FullEngine plan="39" />;
}
