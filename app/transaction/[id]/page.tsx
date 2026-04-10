import AIInterface from "@/components/AIInterface";
import Header from "@/components/Header";
import DocumentsPanel from "@/components/panels/DocumentsPanel";
import VerificationPanel from "@/components/panels/VerificationPanel";
import ActivityPanel from "@/components/panels/ActivityPanel";

export default function TransactionPage() {
  return (
    <>
      <Header />
      <main className="px-6 pb-16">
        <div className="max-w-[680px] mx-auto">
          <AIInterface />
          <DocumentsPanel />
          <VerificationPanel />
          <ActivityPanel />
        </div>
      </main>
    </>
  );
}
