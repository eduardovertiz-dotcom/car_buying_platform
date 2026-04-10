import Link from "next/link";
import { Hero, Navbar } from "@/components/Hero";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconShield({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L3 6v6c0 5.5 3.9 10.65 9 12 5.1-1.35 9-6.5 9-12V6l-9-4z" />
    </svg>
  );
}

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
      <Navbar />

      <main>

        {/* ── HERO ── */}
        <Hero />

        <Divider />

        {/* ── WHY IT MATTERS ── */}
        <section className="py-20 lg:py-28">
          <Container>
            <div className="mb-10 lg:mb-14">
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
        {/*
          Mobile:  1 col
          md:      2 col (wraps gracefully)
          lg:      5 col row
        */}
        <section className="py-20 lg:py-28" id="how-it-works">
          <Container>
            <div className="mb-10 lg:mb-14">
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-3">Process</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight">
                A structured path from interest to purchase
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
              {[
                { step: "01", label: "Understand", description: "Define your budget, use case, and risk tolerance before engaging with a seller." },
                { step: "02", label: "Find", description: "Evaluate listings with AI assistance. Identify red flags, missing information, and unrealistic pricing." },
                { step: "03", label: "Evaluate", description: "Assess condition signals, pricing context, and negotiation exposure before committing." },
                { step: "04", label: "Verify", description: "Run checks across REPUVE, ownership records, fines, and lien databases. Validate documents and identity consistency." },
                { step: "05", label: "Complete", description: "Generate a structured purchase agreement and finalize with a documented, verifiable transaction record." },
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
        {/*
          Mobile:  stacked (narrative → list)
          Desktop: two-column, narrative anchors left, list fills right
        */}
        <section className="py-20 lg:py-28">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-start">

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
        {/*
          Mobile:  1 col stats → closing card
          Desktop: left = header + closing statement, right = stat grid (2-col)
        */}
        <section className="py-20 lg:py-28">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[360px_1fr] gap-12 lg:gap-20 items-start">

              {/* Left: header + closing statement */}
              <div className="lg:sticky lg:top-28">
                <div className="flex items-center gap-2.5 text-[var(--foreground-muted)] mb-3">
                  <IconBar />
                  <p className="text-xs uppercase tracking-widest">What the data shows</p>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight mb-8 lg:mb-10">
                  This is not a rare edge case
                </h2>
                <div className="bg-white/[0.06] rounded-xl px-5 py-5 lg:px-6 lg:py-6">
                  <p className="text-base lg:text-lg font-semibold text-white mb-1.5">
                    Most problems are discovered after payment.
                  </p>
                  <p className="text-sm lg:text-base text-[var(--foreground-muted)]">At that point, they are yours.</p>
                </div>
              </div>

              {/* Right: stat grid */}
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
        <section className="py-20 lg:py-28" id="pricing">
          <Container>
            <div className="max-w-[980px] mx-auto">

            <div className="mb-10 lg:mb-14 text-center">
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight mb-2">
                Choose your level of certainty
              </h2>
              <p className="text-sm lg:text-base text-[var(--foreground-muted)]">
                Start with guided verification or validate at a professional level before you commit.
              </p>
            </div>

            <div className="flex flex-col md:flex-row justify-center gap-8 lg:gap-12">

              {/* $49 */}
              <div className="flex flex-col bg-white/[0.04] rounded-xl px-6 py-8 lg:px-8 lg:py-10 w-full max-w-[460px]">
                {/* Title block */}
                <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-1">Guided Purchase</p>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
                  Understand the deal and check what&apos;s visible.
                </p>

                {/* Price — primary focal point */}
                <div className="flex items-end gap-1.5 mb-6">
                  <span className="text-[3.5rem] lg:text-[4rem] font-semibold text-white leading-none tracking-tight">$49</span>
                  <span className="text-sm text-[var(--foreground-muted)] mb-2">one-time</span>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.08] mb-6" />

                {/* Features */}
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

                {/* Caveat */}
                <p className="text-xs text-[var(--foreground-muted)] opacity-60 leading-relaxed mb-6">
                  Does not include human review or document inspection. Limited to available database information.
                </p>

                {/* CTA */}
                <Link
                  href="/transactions"
                  className="block w-full bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-4 py-3 text-center hover:opacity-90 transition-opacity"
                >
                  Start verification
                </Link>
              </div>

              {/* $79 */}
              <div className="flex flex-col bg-white/[0.04] rounded-xl px-6 py-8 lg:px-8 lg:py-10 w-full max-w-[460px]">
                {/* Title block */}
                <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-1">Professional Verification</p>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
                  Verify at a professional level before you commit.
                </p>

                {/* Price — primary focal point */}
                <div className="flex items-end gap-1.5 mb-6">
                  <span className="text-[3.5rem] lg:text-[4rem] font-semibold text-white leading-none tracking-tight">$79</span>
                  <span className="text-sm text-[var(--foreground-muted)] mb-2">one-time</span>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.08] mb-6" />

                {/* Features */}
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

                {/* Caveat */}
                <p className="text-xs text-[var(--foreground-muted)] opacity-60 leading-relaxed mb-6">
                  Not a guarantee. Highest level of verification available to a buyer.
                </p>

                {/* CTA */}
                <Link
                  href="/transactions"
                  className="block w-full bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-4 py-3 text-center hover:opacity-90 transition-opacity"
                >
                  Start verification
                </Link>
              </div>

            </div>

            <p className="text-xs lg:text-sm text-[var(--foreground-muted)] leading-relaxed mt-6 text-center">
              <span className="text-white">Progressive certainty:</span>{" "}
              Start with system-based validation or escalate to professional verification for higher confidence.
            </p>

            </div>
          </Container>
        </section>

        <Divider />

        {/* ── FINAL CTA ── */}
        <section className="pt-16 pb-20 lg:pt-20 lg:pb-28 border-t border-white/[0.08]">
          <Container>
            <div className="max-w-[520px] mx-auto text-center">

              {/* Label */}
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-5">
                Get started
              </p>

              {/* Headline — locked two lines */}
              <h2 className="text-3xl sm:text-[2.25rem] font-semibold text-white tracking-tight leading-[1.1] mb-4">
                Know what you&apos;re buying<br />before you pay.
              </h2>

              {/* Subtext — two clean lines */}
              <p className="text-[15px] text-[var(--foreground-muted)] leading-relaxed max-w-[360px] mx-auto">
                Open a transaction and walk through each step<br className="hidden sm:block" /> with structured guidance. Verify before you commit.
              </p>

              {/* CTA */}
              <div className="mt-8">
                <Link
                  href="/transactions"
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
        <Container className="py-14 lg:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16 mb-12 lg:mb-14">

            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 text-white mb-4">
                <IconShield size={16} />
                <span className="text-sm font-semibold uppercase tracking-widest">MexGuardian</span>
              </div>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                Structured verification for used car purchases in Mexico. Know what you&apos;re buying before you commit.
              </p>
            </div>

            <div>
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-4">Product</p>
              <ul className="flex flex-col gap-3">
                {["How it works", "Pricing"].map((label) => (
                  <li key={label}>
                    <Link href="#" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-4">Resources</p>
              <ul className="flex flex-col gap-3">
                {["Verification explained", "Fraud risks"].map((label) => (
                  <li key={label}>
                    <Link href="#" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-4">Company</p>
              <ul className="flex flex-col gap-3">
                {["About", "Contact"].map((label) => (
                  <li key={label}>
                    <Link href="#" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          <Divider />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-8">
            <p className="text-sm text-[var(--foreground-muted)]">© 2026 MexGuardian. All rights reserved.</p>
            <div className="flex gap-6">
              {["Privacy", "Terms"].map((label) => (
                <Link key={label} href="#" className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </footer>
    </>
  );
}
