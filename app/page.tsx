"use client";

import Link from "next/link";
import Hero from "@/components/Hero";

// 🔥 STRIPE HANDLER
const handleCheckout = async (priceId: string) => {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });

    const data = await res.json();
    console.log("[checkout] response:", data);

    if (!res.ok || !data.url) {
      console.error("[checkout] missing url:", data);
      return;
    }

    window.location.href = data.url;
  } catch (err) {
    console.error("[checkout] fetch failed:", err);
  }
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconAlert() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconBar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-16 ${className}`}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-white/[0.06]" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <main>

        {/* ── HERO ── */}
        <Hero />

        <Divider />

        {/* ── WHY IT MATTERS ── */}
        <section className="py-14 md:py-24">
          <Container>
            <div className="mb-8 lg:mb-14">
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-3">Why it matters</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight">
                What you&apos;re actually buying
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
              {[
                {
                  icon: <IconAlert />,
                  title: "Debts transfer with the vehicle",
                  body: "Outstanding fines, loans, and tax obligations follow the car. They become your responsibility after purchase.",
                },
                {
                  icon: <IconFile />,
                  title: "Documents can be falsified",
                  body: "Facturas are altered. VINs are cloned. Official seals and QR validations are replicated with fake portals.",
                },
                {
                  icon: <IconEye />,
                  title: "What you see is incomplete",
                  body: "Most buyers rely on seller-provided documents. Fraud happens in what isn't cross-checked.",
                },
              ].map(({ icon, title, body }) => (
                <div key={title} className="bg-white/[0.04] rounded-xl px-6 py-6 lg:px-7 lg:py-8">
                  <div className="text-[var(--foreground-muted)] mb-4 lg:mb-5">{icon}</div>
                  <p className="text-base lg:text-lg font-medium text-white mb-3">{title}</p>
                  <p className="text-sm lg:text-base text-[var(--foreground-muted)] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <Divider />

        {/* ── PROCESS ── */}
        <section className="py-14 md:py-24" id="how-it-works">
          <Container>
            <div className="mb-8 lg:mb-14">
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-3">Process</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight">
                A structured path from interest to purchase
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
              {[
                { step: "01", label: "Understand", description: "Define your budget and risk." },
                { step: "02", label: "Find", description: "Scan listings and spot red flags." },
                { step: "03", label: "Evaluate", description: "Assess condition and pricing." },
                { step: "04", label: "Verify", description: "Check records and validate documents." },
                { step: "05", label: "Complete", description: "Generate and sign a secure agreement." },
              ].map(({ step, label, description }) => (
                <div key={step} className="bg-white/[0.04] rounded-xl px-5 py-5 lg:px-5 lg:py-6">
                  <p className="text-xs font-mono text-[var(--foreground-muted)] mb-3">{step}</p>
                  <p className="text-sm lg:text-base font-medium text-white mb-2">{label}</p>
                  <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <Divider />

        {/* ── WHERE BUYERS GO WRONG ── */}
        <section className="py-14 md:py-24">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 lg:gap-20 items-start">

              <div>
                <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-3">Common failure points</p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight mb-5">
                  Where most buyers get it wrong
                </h2>
                <p className="text-sm lg:text-base text-[var(--foreground-muted)] leading-relaxed max-w-[420px]">
                  The majority of fraud in the Mexican secondary market isn&apos;t hidden — it&apos;s unverified. These are the five most consistent failure patterns.
                </p>
              </div>

              <div className="bg-white/[0.04] rounded-xl overflow-hidden">
                {[
                  "Accepting documents at face value without verification",
                  "Assuming a matching VIN means the vehicle is legitimate",
                  "Relying on REPUVE alone despite reporting delays",
                  "Ignoring suspicious pricing signals",
                  "Underestimating how often fraud actually occurs",
                ].map((item, i, arr) => (
                  <div
                    key={i}
                    className={`flex items-start gap-4 px-6 py-5 lg:py-6 ${i < arr.length - 1 ? "border-b border-white/[0.06]" : ""}`}
                  >
                    <span className="text-[var(--foreground-muted)] shrink-0 mt-0.5"><IconX /></span>
                    <p className="text-sm lg:text-base text-[var(--foreground-muted)] leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>

            </div>
          </Container>
        </section>

        <Divider />

        {/* ── WHAT THE DATA SHOWS ── */}
        <section className="py-12 md:py-20">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[360px_1fr] gap-8 lg:gap-20 items-start">

              <div className="lg:sticky lg:top-28">
                <div className="flex items-center gap-2.5 text-[var(--foreground-muted)] mb-3">
                  <IconBar />
                  <p className="text-xs uppercase tracking-widest">What the data shows</p>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight mb-6 lg:mb-10">
                  This is not a rare edge case
                </h2>
                <div className="bg-white/[0.06] rounded-xl px-5 py-5 lg:px-6 lg:py-6">
                  <p className="text-base lg:text-lg font-semibold text-white mb-1.5">
                    Most problems are discovered after payment.
                  </p>
                  <p className="text-sm lg:text-base text-[var(--foreground-muted)]">At that point, they are yours.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                {[
                  { stat: "Up to 40%", detail: "of transactions contain irregularities" },
                  { stat: "60%", detail: "of fraud cases involve financial manipulation" },
                  { stat: "30–50% below market", detail: "how fake listings are priced to lure buyers" },
                  { stat: "~100 per day", detail: "fake foreign titles detected by authorities" },
                  { stat: "15–30 day lag", detail: "between real theft events and REPUVE updates" },
                ].map(({ stat, detail }) => (
                  <div key={stat} className="bg-white/[0.04] rounded-xl px-5 py-5 lg:px-6 lg:py-6">
                    <p className="text-lg lg:text-xl font-semibold text-white mb-1.5">{stat}</p>
                    <p className="text-sm lg:text-base text-[var(--foreground-muted)] leading-relaxed">{detail}</p>
                  </div>
                ))}
              </div>

            </div>
          </Container>
        </section>

        <Divider />

        {/* ── PRICING ── */}
        <section className="py-12 md:py-20" id="pricing">
          <Container>
            <div className="max-w-[980px] mx-auto">

              <div className="mb-8 lg:mb-14 text-center">
                <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-3">Pricing</p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight mb-2">
                  Avoid costly mistakes before you buy
                </h2>
                <p className="text-sm lg:text-base text-[var(--foreground-muted)]">
                  Verify the vehicle, the seller, and the risk before committing.
                </p>
                <p className="text-sm text-white/60 text-center mt-4 mb-10">Most buyers choose full protection for high-value purchases.</p>
              </div>

              {/* Mobile: $79 first (flex-col-reverse), Desktop: $49 left (flex-row) */}
              <div className="flex flex-col-reverse md:flex-row justify-center gap-8 lg:gap-12">

                {/* $49 — secondary */}
                <div className="flex flex-col bg-white/[0.04] rounded-xl px-6 py-8 lg:px-8 lg:py-10 w-full max-w-[460px]">
                  <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-1">Basic Coverage</p>
                  <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
                    Essential vehicle history and risk overview.
                  </p>

                  <div className="flex items-end gap-1.5 mb-3">
                    <span className="text-[3.5rem] lg:text-[4rem] font-semibold text-white leading-none tracking-tight">$49</span>
                    <span className="text-sm text-[var(--foreground-muted)] mb-2">one-time</span>
                  </div>

                  <p className="text-xs text-[var(--foreground-muted)] leading-relaxed mb-6">
                    Does not include identity or fraud risk verification.
                  </p>

                  <div className="h-px bg-white/[0.08] mb-6" />

                  <ul className="flex flex-col gap-3 mb-6 lg:mb-8 flex-1">
                    {[
                      "Full AI-guided process (Find → Evaluate → Verify → Complete)",
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

                  {/* 🔥 $49 BUTTON */}
                  <button
                    onClick={() => handleCheckout("price_1TKnooBgMSWbEFIIv0Pg5V1P")}
                    className="block w-full bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-4 py-3 text-center hover:opacity-90 transition-opacity"
                  >
                    Get Basic Report
                  </button>
                </div>

                {/* $79 — primary */}
                <div className="flex flex-col bg-white/[0.06] border border-[var(--accent)] shadow-[0_0_24px_0_rgba(99,102,241,0.15)] rounded-xl px-6 py-8 lg:px-8 lg:py-10 w-full max-w-[460px] scale-105">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest">Professional Verification</p>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">Full Fraud Protection</span>
                  </div>
                  <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
                    Verify ownership, identity, and fraud risk before you pay.
                  </p>

                  <div className="flex items-end gap-1.5 mb-2">
                    <span className="text-[3.5rem] lg:text-[4rem] font-semibold text-white leading-none tracking-tight">$79</span>
                    <span className="text-sm text-[var(--foreground-muted)] mb-2">one-time</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed mb-6">Prevents identity fraud and ownership scams.</p>

                  <div className="h-px bg-white/[0.08] mb-6" />

                  <ul className="flex flex-col gap-3 mb-6 lg:mb-8 flex-1">
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

                  {/* 🔥 $79 BUTTON */}
                  <button
                    onClick={() => handleCheckout("price_1TKnpHBgMSWbEFIIbmJUc4C7")}
                    className="block w-full bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-4 py-3 text-center hover:opacity-90 transition-opacity"
                  >
                    Get Full Protection
                  </button>
                </div>

              </div>

              <p className="text-xs lg:text-sm text-[var(--foreground-muted)] leading-relaxed mt-10 text-center">
                <span className="text-white">Progressive certainty:</span>{" "}
                Start with system-based validation or escalate to professional verification for higher confidence.
              </p>

            </div>
          </Container>
        </section>

        <Divider />

        {/* ── FINAL CTA ── */}
        <section className="pt-12 pb-16 lg:pt-20 lg:pb-28 border-t border-white/[0.08]">
          <Container>
            <div className="max-w-[520px] mx-auto text-center">

              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-5">
                Get started
              </p>

              <h2 className="text-3xl sm:text-[2.25rem] font-semibold text-white tracking-tight leading-[1.1] mb-4">
                Know what you&apos;re buying<br />before you pay.
              </h2>

              <p className="text-[15px] text-[var(--foreground-muted)] leading-relaxed max-w-[360px] mx-auto">
                Open a transaction and walk through each step<br className="hidden sm:block" /> with structured guidance. Verify before you commit.
              </p>

              <div className="mt-8">
                <Link
                  href="#pricing"
                  className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-[15px] font-semibold rounded-lg px-7 py-3.5 hover:opacity-90 transition-opacity"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L3 6v6c0 5.5 3.9 10.65 9 12 5.1-1.35 9-6.5 9-12V6l-9-4z" />
                  </svg>
                  Start my verification
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

            </div>
          </Container>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer>
        <Divider />
        <Container className="py-12 lg:py-16">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 mb-10 md:mb-14">

            {/* Brand */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">MexGuardian</p>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                Vehicle verification for used car purchases in Mexico.<br />
                <span className="text-[var(--foreground-muted)] opacity-70">Helping buyers identify risk before committing.</span>
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-3">Product</p>
              <ul className="flex flex-col gap-3">
                <li>
                  <Link href="#how-it-works" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal + Contact */}
            <div>
              <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-3">Legal</p>
              <ul className="flex flex-col gap-3 mb-6">
                <li>
                  <Link href="/privacy" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                For support related to verification or transactions:<br />
                <a href="mailto:support@mexguardian.com" className="hover:text-white transition-colors">
                  support@mexguardian.com
                </a>
              </p>
            </div>

          </div>

          <Divider />

          <p className="text-sm text-[var(--foreground-muted)] pt-8">
            © 2026 MexGuardian. All rights reserved.
          </p>

        </Container>
      </footer>
    </>
  );
}
