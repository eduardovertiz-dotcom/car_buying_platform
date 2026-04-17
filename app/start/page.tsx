"use client";

import Link from "next/link";
import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRICING } from "@/lib/pricing";

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

// Paid-user guard — runs once on mount.
// If the user already has a paid transaction, send them straight to it.
// This prevents paying users from accidentally landing on pricing again.
function usePaidGuard() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return; // unauthenticated users should see pricing

      const userEmail = (user.email ?? "").toLowerCase().trim();
      const orFilter  = userEmail
        ? `user_id.eq.${user.id},email.ilike.${userEmail}`
        : `user_id.eq.${user.id}`;

      const { data } = await supabase
        .from("transactions")
        .select("id")
        .or(orFilter)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.id) {
        router.replace(`/transaction/${data.id}`);
      }
    });
  }, [router]);
}

function StartPageContent() {
  usePaidGuard();
  const router = useRouter();

  const handleCheckout = async (plan: "39" | "69") => {
    console.log("CHECKOUT CLICK", plan);

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
      console.error("CHECKOUT FAILED");
      return;
    }

    const data = await res.json();

    console.log("TRANSACTION RESPONSE", data);

    router.push(`/transaction/${data.id}`);
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-[760px] mx-auto">

        <div className="mb-10">
          <Link
            href="/transactions"
            className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors"
          >
            ← Back to transactions
          </Link>
        </div>

        <div className="mb-10">
          <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-2">
            New verification
          </p>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Choose your level of protection
          </h1>
          <p className="text-sm text-white/75 mt-2">
            Select a plan to start your vehicle verification.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">

          {/* $49 — Basic */}
          <div className="flex flex-col bg-white/[0.04] rounded-xl px-6 py-8 w-full">
            <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-1">
              Basic Coverage
            </p>
            <p className="text-sm text-white/75 leading-relaxed mb-6">
              Essential vehicle history and risk overview.
            </p>

            <div className="flex items-end gap-1.5 mb-3">
              <span className="text-[3rem] font-semibold text-white leading-none tracking-tight">${PRICING.basic}</span>
              <span className="text-sm text-[var(--foreground-muted)] mb-1.5">one-time</span>
            </div>

            <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-6">
              Does not include identity or fraud risk verification.
            </p>

            <div className="h-px bg-white/[0.08] mb-6" />

            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {[
                "Full AI-guided process (Upload → Analyze → Verify → Complete)",
                "AI-assisted deal evaluation (red flags, missing information)",
                "Basic verification (registry, ownership, fines)",
                "Risk interpretation layer",
                "Guided contract generation and transaction record",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 text-[var(--foreground-muted)] opacity-70"><IconCheck /></span>
                  <span className="text-sm text-[var(--foreground-muted)] leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout("39")}
              className="w-full bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-4 py-3 hover:opacity-90 transition-opacity"
            >
              Get Basic Report
            </button>
          </div>

          {/* $79 — Professional */}
          <div className="flex flex-col bg-white/[0.06] border border-[var(--accent)] shadow-[0_0_24px_0_rgba(99,102,241,0.15)] rounded-xl px-6 py-8 w-full">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest">
                Professional Verification
              </p>
              <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                Full Fraud Protection
              </span>
            </div>
            <p className="text-sm text-white/75 leading-relaxed mb-6">
              Verify ownership, identity, and fraud risk before you pay.
            </p>

            <div className="flex items-end gap-1.5 mb-2">
              <span className="text-[3rem] font-semibold text-white leading-none tracking-tight">${PRICING.pro}</span>
              <span className="text-sm text-[var(--foreground-muted)] mb-1.5">one-time</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed mb-6">
              Prevents identity fraud and ownership scams.
            </p>

            <div className="h-px bg-white/[0.08] mb-6" />

            <ul className="flex flex-col gap-3 mb-6 flex-1">
              {[
                "Everything in Guided Purchase",
                "Institutional-level verification (multi-source checks)",
                "Document inspection (factura, ID, consistency validation)",
                "Human expert review",
                "Fraud pattern detection",
                "Structured risk assessment with confidence level",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 text-[var(--foreground-muted)] opacity-70"><IconCheck /></span>
                  <span className="text-sm text-[var(--foreground-muted)] leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-[var(--foreground-muted)] opacity-60 leading-relaxed mb-6">
              Not a guarantee. Highest level of verification available to a buyer.
            </p>

            <button
              onClick={() => handleCheckout("69")}
              className="w-full bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-4 py-3 hover:opacity-90 transition-opacity"
            >
              Get Full Protection
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}

export default function StartPage() {
  return (
    <Suspense>
      <StartPageContent />
    </Suspense>
  );
}
