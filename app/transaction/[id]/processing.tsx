"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_ATTEMPTS = 5;
const INTERVAL_MS = 2000;

export default function PaymentProcessing() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      setAttempts((a) => a + 1);
      router.refresh();
    }, INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [attempts, router]);

  const gaveUp = attempts >= MAX_ATTEMPTS;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <p className="text-white font-semibold">
          {gaveUp ? "Still confirming your payment…" : "Processing your payment…"}
        </p>
        <p className="text-sm text-[var(--foreground-muted)]">
          {gaveUp
            ? "This is taking longer than expected. You can refresh the page or wait a moment."
            : "Please wait — this page will update automatically."}
        </p>
        {gaveUp && (
          <button
            onClick={() => router.refresh()}
            className="mt-4 text-sm underline text-white/60 hover:text-white transition-colors"
          >
            Refresh now
          </button>
        )}
      </div>
    </main>
  );
}
