"use client";

import Link from "next/link";
import { PRICING } from "@/lib/pricing";

// ─── Checkout ─────────────────────────────────────────────────────────────────

const handleCheckout = async (plan: "39" | "69") => {
  if (process.env.NODE_ENV === "development") {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    window.location.href = `/transaction/${data.id}`;
    return;
  }
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Checkout failed");
    window.location.href = data.url;
  } catch {
    alert("Something went wrong. Please try again.");
  }
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCheck({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`max-w-[1140px] mx-auto px-5 sm:px-8 lg:px-12 ${className}`}>
      {children}
    </div>
  );
}

function Rule() {
  return <div className="h-px bg-slate-200" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingV2() {
  return (
    <div className="bg-white text-slate-900 min-h-screen font-[family-name:var(--font-geist-sans)]">

      {/* ════════════════════════════════════════════════════════════
          NAVBAR
      ════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <Container>
          <nav className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/MexGuardian_logo.png" alt="MexGuardian" className="h-5 w-auto" />
              <span className="text-[15px] font-semibold text-slate-900">MexGuardian</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="#how-it-works"
                className="hidden md:block text-[15px] text-slate-600 hover:text-slate-900 transition-colors"
              >
                How it works
              </Link>
              <Link
                href="#pricing"
                className="hidden md:block text-[15px] text-slate-600 hover:text-slate-900 transition-colors"
              >
                Pricing
              </Link>
              <button
                onClick={() => handleCheckout("69")}
                className="bg-[#3b7dd8] text-white text-[14px] font-semibold rounded-lg px-4 py-2 hover:bg-[#2d6bc4] transition-colors"
              >
                Start verification
              </button>
            </div>
          </nav>
        </Container>
      </header>

      <main>

        {/* ════════════════════════════════════════════════════════════
            HERO
        ════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-32">
          <Container>
            <div className="max-w-[820px]">
              <p className="text-[14px] font-semibold text-[#3b7dd8] uppercase tracking-widest mb-5">
                Vehicle verification · Mexico
              </p>

              <h1
                className="font-bold text-slate-900 leading-[1.05] tracking-tight mb-6"
                style={{ fontSize: "clamp(2.75rem, 7vw, 5rem)" }}
              >
                Don&apos;t get scammed<br className="hidden sm:block" /> buying a car in Mexico.
              </h1>

              <p className="text-xl md:text-2xl text-slate-700 leading-relaxed max-w-[600px] mb-10">
                We verify the vehicle, the seller, and all documents before you hand over any money.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 mb-10">
                <button
                  onClick={() => handleCheckout("69")}
                  className="bg-[#3b7dd8] text-white text-[18px] font-semibold rounded-lg px-8 py-4 hover:bg-[#2d6bc4] transition-colors"
                >
                  Start verification — from ${PRICING.basic}
                </button>
                <Link
                  href="#how-it-works"
                  className="text-[18px] text-slate-600 hover:text-slate-900 transition-colors py-4"
                >
                  See how it works →
                </Link>
              </div>

              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {[
                  "Results in under 24 hours",
                  "No technical knowledge required",
                  "Plain-language recommendation",
                ].map((item) => (
                  <p key={item} className="flex items-center gap-2 text-[15px] text-slate-600">
                    <span className="text-[#3b7dd8]"><IconCheck /></span>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <Rule />

        {/* ════════════════════════════════════════════════════════════
            PROBLEMS
        ════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28">
          <Container>
            <div className="mb-14">
              <p className="text-[14px] font-semibold text-[#3b7dd8] uppercase tracking-widest mb-4">
                The risks
              </p>
              <h2
                className="font-bold text-slate-900 tracking-tight leading-tight max-w-[560px]"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
              >
                Buying a used car in Mexico is risky if you don&apos;t verify first.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
              {[
                {
                  icon: <IconMoney />,
                  title: "Debts come with the car",
                  body: "Unpaid fines, traffic tickets, and outstanding taxes are legally attached to the vehicle — not the seller. You inherit them the moment you sign.",
                },
                {
                  icon: <IconDoc />,
                  title: "Documents can be forged",
                  body: "Ownership papers, invoices, and registration records can be altered or fabricated. A document that looks official is not always legitimate.",
                },
                {
                  icon: <IconAlert />,
                  title: "Once you pay, it's too late",
                  body: "Recovering money after a fraudulent car purchase in Mexico is extremely difficult. Most victims never see their money again.",
                },
              ].map(({ icon, title, body }) => (
                <div key={title} className="border-t-2 border-slate-900 pt-7">
                  <div className="text-slate-400 mb-5">{icon}</div>
                  <h3 className="text-[22px] font-semibold text-slate-900 mb-3">{title}</h3>
                  <p className="text-[18px] text-slate-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <Rule />

        {/* ════════════════════════════════════════════════════════════
            HOW IT WORKS
        ════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28 bg-slate-50" id="how-it-works">
          <Container>
            <div className="mb-14">
              <p className="text-[14px] font-semibold text-[#3b7dd8] uppercase tracking-widest mb-4">
                How it works
              </p>
              <h2
                className="font-bold text-slate-900 tracking-tight leading-tight mb-4"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
              >
                Four simple steps.
              </h2>
              <p className="text-[20px] text-slate-600">
                No technical knowledge needed. We do the hard part.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {[
                {
                  step: "1",
                  label: "You upload",
                  body: "Share the vehicle details and any documents the seller has given you. Takes about 5 minutes.",
                },
                {
                  step: "2",
                  label: "We check",
                  body: "We run the vehicle through REPUVE, SAT, traffic records, and ownership databases.",
                },
                {
                  step: "3",
                  label: "We analyze",
                  body: "We look for inconsistencies, hidden debts, fraud signals, and anything that does not add up.",
                },
                {
                  step: "4",
                  label: "You decide",
                  body: "You get a clear report with a plain-language recommendation: safe to proceed, or walk away.",
                },
              ].map(({ step, label, body }) => (
                <div key={step}>
                  <div className="w-11 h-11 rounded-full bg-[#3b7dd8] text-white flex items-center justify-center text-[18px] font-bold mb-5 shrink-0">
                    {step}
                  </div>
                  <h3 className="text-[21px] font-semibold text-slate-900 mb-3">{label}</h3>
                  <p className="text-[18px] text-slate-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <Rule />

        {/* ════════════════════════════════════════════════════════════
            WHAT GETS VERIFIED
        ════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-14 lg:gap-20 items-start">

              {/* Left column — heading */}
              <div className="lg:sticky lg:top-28">
                <p className="text-[14px] font-semibold text-[#3b7dd8] uppercase tracking-widest mb-4">
                  What we check
                </p>
                <h2
                  className="font-bold text-slate-900 tracking-tight leading-tight mb-6"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
                >
                  We check what most buyers never think to verify.
                </h2>
                <p className="text-[20px] text-slate-600 leading-relaxed">
                  Our Full Protection plan covers every major fraud vector in the Mexican used car market.
                </p>
              </div>

              {/* Right column — checklist */}
              <div className="flex flex-col gap-10">
                {[
                  {
                    category: "Vehicle",
                    items: [
                      "REPUVE registration and status",
                      "Hidden liens and outstanding debts",
                      "Traffic fines and penalties",
                      "SAT tax compliance",
                      "VIN integrity and tampering detection",
                      "Accident and total-loss history",
                    ],
                  },
                  {
                    category: "Seller & Documents",
                    items: [
                      "Seller identity verification",
                      "Ownership history and chain of title",
                      "Invoice and registration validation",
                      "Cross-referenced across official sources",
                    ],
                  },
                  {
                    category: "Report",
                    items: [
                      "Expert review by a verification specialist",
                      "Clear go / no-go recommendation",
                      "Full downloadable dossier",
                      "Purchase agreement included",
                    ],
                  },
                ].map(({ category, items }, i) => (
                  <div key={category}>
                    {i > 0 && <div className="h-px bg-slate-200 mb-10" />}
                    <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-5">
                      {category}
                    </p>
                    <ul className="flex flex-col gap-3.5">
                      {items.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span className="text-[#3b7dd8] shrink-0 mt-0.5"><IconCheck /></span>
                          <span className="text-[18px] text-slate-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

            </div>
          </Container>
        </section>

        <Rule />

        {/* ════════════════════════════════════════════════════════════
            TESTIMONIALS
        ════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28 bg-slate-50">
          <Container>
            <div className="mb-14">
              <p className="text-[14px] font-semibold text-[#3b7dd8] uppercase tracking-widest mb-4">
                Real buyers
              </p>
              <h2
                className="font-bold text-slate-900 tracking-tight leading-tight"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
              >
                What buyers say.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote: "The report caught a pending lien the seller never mentioned. I almost paid $180,000 pesos for a car with an active bank loan on it.",
                  name: "Roberto M.",
                  location: "Guadalajara, Jalisco",
                },
                {
                  quote: "I have bought three cars in my life and always felt nervous. This was the first time I felt completely sure before signing anything.",
                  name: "Carmen V.",
                  location: "Ciudad de México",
                },
                {
                  quote: "The recommendation was very clear. No confusion. They told me exactly what was wrong and what to ask the seller to resolve before I paid.",
                  name: "Jorge T.",
                  location: "Monterrey, NL",
                },
              ].map(({ quote, name, location }) => (
                <div key={name} className="bg-white border border-slate-200 rounded-xl p-7 lg:p-8 flex flex-col">
                  <p className="text-[18px] text-slate-700 leading-relaxed flex-1 mb-7">
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="border-t border-slate-200 pt-5">
                    <p className="text-[16px] font-semibold text-slate-900">{name}</p>
                    <p className="text-[14px] text-slate-500 mt-0.5">{location}</p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <Rule />

        {/* ════════════════════════════════════════════════════════════
            PRICING
        ════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28" id="pricing">
          <Container>
            <div className="mb-14">
              <p className="text-[14px] font-semibold text-[#3b7dd8] uppercase tracking-widest mb-4">
                Pricing
              </p>
              <h2
                className="font-bold text-slate-900 tracking-tight leading-tight mb-4"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
              >
                Know before you pay.
              </h2>
              <p className="text-[20px] text-slate-600">
                One small payment now. Or a very large problem later.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[860px]">

              {/* ── Basic $39 ── */}
              <div className="border border-slate-200 rounded-xl p-8 lg:p-10 flex flex-col">
                <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Basic Vehicle Check
                </p>
                <p className="text-[18px] text-slate-600 leading-relaxed mb-7">
                  Verify the vehicle records and ownership before engaging with the seller.
                </p>

                <div className="flex items-end gap-2 mb-6">
                  <span className="text-[4rem] font-bold text-slate-900 leading-none tracking-tight">
                    ${PRICING.basic}
                  </span>
                  <span className="text-[16px] text-slate-500 mb-2">one-time</span>
                </div>

                <div className="h-px bg-slate-200 mb-7" />

                <ul className="flex flex-col gap-4 mb-8 flex-1">
                  {[
                    "Vehicle registry and status",
                    "Ownership verification",
                    "REPUVE and lien check",
                    "Inconsistency detection",
                    "Risk summary",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="text-slate-400 shrink-0 mt-0.5"><IconCheck /></span>
                      <span className="text-[17px] text-slate-700">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout("39")}
                  className="w-full border-2 border-[#3b7dd8] text-[#3b7dd8] text-[17px] font-semibold rounded-lg px-4 py-3.5 hover:bg-[#3b7dd8] hover:text-white transition-colors"
                >
                  Start Basic Check
                </button>
              </div>

              {/* ── Full Protection $69 ── */}
              <div className="border-2 border-[#3b7dd8] rounded-xl p-8 lg:p-10 flex flex-col relative">
                <div className="absolute -top-4 left-6">
                  <span className="bg-[#3b7dd8] text-white text-[12px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                    Most popular
                  </span>
                </div>

                <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Full Protection
                </p>
                <p className="text-[18px] text-slate-600 leading-relaxed mb-7">
                  Verify seller, documents, and fraud risk. Get a clear answer before you commit.
                </p>

                <div className="flex items-end gap-2 mb-6">
                  <span className="text-[4rem] font-bold text-slate-900 leading-none tracking-tight">
                    ${PRICING.pro}
                  </span>
                  <span className="text-[16px] text-slate-500 mb-2">one-time</span>
                </div>

                <div className="h-px bg-slate-200 mb-7" />

                <ul className="flex flex-col gap-4 mb-8 flex-1">
                  {[
                    "Everything in Basic",
                    "Seller identity verification",
                    "Document validation",
                    "SAT, REPUVE, OCRA checks",
                    "Cross-referenced sources",
                    "Expert review",
                    "Go / no-go recommendation",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="text-[#3b7dd8] shrink-0 mt-0.5"><IconCheck /></span>
                      <span className="text-[17px] font-medium text-slate-900">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout("69")}
                  className="w-full bg-[#3b7dd8] text-white text-[17px] font-semibold rounded-lg px-4 py-3.5 hover:bg-[#2d6bc4] transition-colors"
                >
                  Start Full Verification
                </button>
                <p className="text-[14px] text-slate-500 text-center mt-3">
                  This is the step most buyers skip.
                </p>
              </div>

            </div>
          </Container>
        </section>

        <Rule />

        {/* ════════════════════════════════════════════════════════════
            FINAL CTA
        ════════════════════════════════════════════════════════════ */}
        <section className="py-24 md:py-36">
          <Container>
            <div className="max-w-[620px]">
              <h2
                className="font-bold text-slate-900 tracking-tight leading-[1.05] mb-5"
                style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
              >
                Verify before you pay.<br />Not after.
              </h2>
              <p className="text-[20px] text-slate-600 leading-relaxed mb-10 max-w-[460px]">
                A few minutes and a small fee now. Or a very large problem you cannot undo.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <button
                  onClick={() => handleCheckout("69")}
                  className="bg-[#3b7dd8] text-white text-[20px] font-semibold rounded-lg px-10 py-5 hover:bg-[#2d6bc4] transition-colors"
                >
                  Start verification
                </button>
              </div>
              <p className="text-[16px] text-slate-500 mt-5">
                From ${PRICING.basic}. One-time payment. Results in under 24 hours.
              </p>
            </div>
          </Container>
        </section>

      </main>

      {/* ════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-200">
        <Container className="py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-[16px] font-semibold text-slate-900 mb-1">MexGuardian</p>
              <p className="text-[15px] text-slate-500">
                Vehicle verification for used car purchases in Mexico.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <Link href="/privacy" className="text-[15px] text-slate-500 hover:text-slate-900 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-[15px] text-slate-500 hover:text-slate-900 transition-colors">
                Terms of Service
              </Link>
              <a href="mailto:support@mexguardian.com" className="text-[15px] text-slate-500 hover:text-slate-900 transition-colors">
                support@mexguardian.com
              </a>
            </div>
          </div>
          <div className="h-px bg-slate-200 mt-8 mb-6" />
          <p className="text-[13px] text-slate-400">© 2026 MexGuardian. All rights reserved.</p>
        </Container>
      </footer>

    </div>
  );
}
