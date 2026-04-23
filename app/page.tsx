"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DM_Sans } from "next/font/google";
import HeroCard from "@/components/HeroCard";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const handleCheckout = async (plan: "39" | "69" | "test", currency: string) => {
  if (process.env.NODE_ENV === "development" && plan !== "test") {
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
      body: JSON.stringify({ plan, currency }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Checkout failed");
    window.location.href = data.url;
  } catch (err) {
    console.error("CHECKOUT FAILURE", err);
    alert("Something went wrong. Please try again.");
  }
};

function ShieldIcon({ width = 12, height = 14 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 12 14" fill="white">
      <path d="M6 0L0 2.5V7C0 10.25 2.58 13.3 6 14C9.42 13.3 12 10.25 12 7V2.5L6 0Z" />
    </svg>
  );
}

const STRIPE_PRICES = {
  USD: { basic: 39,  pro: 69   },
  CAD: { basic: 54,  pro: 95   },
  MXN: { basic: 680, pro: 1210 },
};

export default function Home() {
  const router = useRouter();
  const [currency, setCurrency] = useState<"USD" | "CAD" | "MXN">("USD");
  const [showStickyBar, setShowStickyBar] = useState(false);
  const heroCtaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/transactions");
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/geo-currency")
      .then((r) => r.json())
      .then(({ currency: geo }: { currency: string }) => {
        const up = geo.toUpperCase() as "USD" | "CAD" | "MXN";
        setCurrency(up);
      })
      .catch(() => {});
  }, []);

  const prices = STRIPE_PRICES;

  return (
    <div className={`mg-page ${dmSans.className}`}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav>
        <a href="#" className="logo">
          <div className="logo-shield"><ShieldIcon /></div>
          MexGuardian
        </a>
        <ul>
          <li><a href="#process">How it works</a></li>
          <li><a href="#sample">Sample report</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <div className="nav-lang">
          <a href="/" className="active">ENG</a>
          <span>|</span>
          <a href="/es">ESP</a>
        </div>
        <a href="#pricing" className="btn-nav">Start →</a>
      </nav>

      {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
      <section id="hero">
        <div className="wrap">
          <div className="hero-wrap">
            <div className="hero-left">

              <div className="hero-incident">
                <p>Everything looked fine — until <strong>$14,000 MXN in hidden debt appeared.</strong></p>
              </div>

              <h1>Don&apos;t get <span className="accent-word">scammed</span><br />buying a car in Mexico.</h1>
              <p className="hero-clarify">Everything looks fine — until the debt becomes yours.</p>
              <p className="hero-sub">Most problems are discovered after you pay — and at that point, there is no reversal.<br /><br />This is how you check everything before you transfer the money.</p>
              <p className="hero-clarify">Most buyers don&apos;t get scammed by strangers. They get scammed by deals that look completely legitimate.</p>

              <div className="hero-cta" ref={heroCtaRef} style={{ marginTop: 16 }}>
                <a href="#pricing" className="btn-primary">Start verification →</a>
                <a href="#sample" className="btn-ghost">See sample report ↗</a>
              </div>

              <p className="hero-clarify"><strong>Before you pay, confirm this:</strong> if the car has hidden debt · if the seller can legally sell it · if the vehicle has been reported stolen.</p>

              <div className="hstats">
                <div className="hst">
                  <div className="hst-n"><span>4,100+</span></div>
                  <div className="hst-l">Verifications completed in Mexico</div>
                </div>
                <div className="hst">
                  <div className="hst-n"><span style={{ fontWeight: 700, fontSize: "110%", color: "#F9FAFB" }}>7 out of 10</span></div>
                  <div className="hst-l">vehicles we check have a hidden issue</div>
                </div>
                <div className="hst">
                  <div className="hst-n"><span>Nearly half</span></div>
                  <div className="hst-l">of private car sales have irregularities</div>
                </div>
                <div className="hst">
                  <div className="hst-n"><span>In Minutes</span></div>
                  <div className="hst-l">Clear risk results before you pay</div>
                </div>
              </div>

              <div className="hero-clarify" style={{ marginTop: 24, marginBottom: 8 }}>
                <p>Once you transfer the money, there is no reversal.</p>
                <p>The debt transfers with the vehicle.<br />The seller disappears.<br />The responsibility becomes yours.</p>
                <p>This is exactly why a structured verification process exists.</p>
              </div>

              <div className="mobile-report">
                <div className="mobile-report-inner">
                  <div className="mr-header">
                    <span className="mr-title">Sample report output</span>
                    <span className="mr-badge">⚠ Issues found</span>
                  </div>
                  <div className="mr-row">
                    <span className="mr-label">Ownership</span>
                    <span className="mr-status mr-warn">Not confirmed</span>
                  </div>
                  <div className="mr-row">
                    <span className="mr-label">Outstanding debt</span>
                    <span className="mr-amount">$14,040 MXN</span>
                  </div>
                  <div className="mr-row">
                    <span className="mr-label">REPUVE status</span>
                    <span className="mr-status mr-ok">Clear</span>
                  </div>
                  <div className="mr-rec">
                    Do not proceed until debt is resolved and ownership is confirmed.
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-right">
              <HeroCard />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. PROBLEM — 3 cards ─────────────────────────────────────────── */}
      <section id="problem" className="b">
        <div className="wrap-w">
          <span className="lbl-accent">Why it goes wrong</span>
          <h2 className="section-h2">Three ways buyers lose money in Mexico.</h2>
          <div className="prob-grid">

            <div className="prob-card" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="pt-tag tag-r">Financial</span>
              <div className="prob-title">You inherit the debt — not the seller.</div>
              <div className="prob-body">→ This is where most buyers lose money.</div>
              <div className="prob-body">Debt transfers with the vehicle.</div>
            </div>

            <div className="prob-card" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="pt-tag tag-r">Legal</span>
              <div className="prob-title">The seller may not legally own the car.</div>
              <div className="prob-body">→ Debt follows the car, not the location.</div>
              <div className="prob-body">Invalid ownership can result in losing the vehicle.</div>
            </div>

            <div className="prob-card" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="pt-tag tag-r">Document</span>
              <div className="prob-title">One mismatch can void the entire deal.</div>
              <div className="prob-body">→ Documents don&apos;t prove validity. Registries do.</div>
              <div className="prob-body">You may have no legal recourse to recover your money.</div>
            </div>

          </div>
          <p className="process-note" style={{ marginTop: 24 }}>None of these problems are visible during a normal inspection.</p>
        </div>
      </section>

      {/* ── WHO THIS IS FOR ──────────────────────────────────────────────── */}
      <section id="who" className="b">
        <div className="wrap-w">
          <span className="lbl-accent">Who this is for</span>
          <h2 className="section-h2">If you&apos;re buying directly from a seller, this is where most risks happen.</h2>
          <p className="hero-clarify">This is where most fraud happens.</p>
          <ul className="who-list">
            <li>Buying from Facebook Marketplace or private listings</li>
            <li>Meeting a seller in person or via WhatsApp</li>
            <li>Paying directly without a dealership</li>
            <li>Considering imported or &ldquo;chocolate&rdquo; vehicles</li>
          </ul>
        </div>
      </section>

      {/* ── 3. PROCESS — 5 steps ─────────────────────────────────────────── */}
      <section id="process" className="b">
        <div className="wrap-w">
          <span className="lbl-accent">The process</span>
          <h2 className="section-h2">Five checks. One decision: proceed or walk away.</h2>
          <div className="steps steps-5">
            <div className="step">
              <div className="step-n">01</div>
              <div className="step-t">Upload</div>
              <div className="step-d">Add plate, VIN, and any documents from the seller.</div>
            </div>
            <div className="step">
              <div className="step-n">02</div>
              <div className="step-t">Cross-check</div>
              <div className="step-d">Cross-check REPUVE, SAT, and state registries for debt and legal status.</div>
            </div>
            <div className="step">
              <div className="step-n">03</div>
              <div className="step-t">Analyze</div>
              <div className="step-d">Inconsistencies flagged. Debt quantified. Ownership confirmed.</div>
            </div>
            <div className="step">
              <div className="step-n">04</div>
              <div className="step-t">Verify</div>
              <div className="step-d">Documents authenticated. Seller identity validated against registry.</div>
            </div>
            <div className="step">
              <div className="step-n">05</div>
              <div className="step-t">Complete Purchase</div>
              <div className="step-d">
                Clear go / no-go with exact figures before you pay.
                <ul style={{ marginTop: 8, paddingLeft: 16, listStyleType: "disc", fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
                  <li>Spanish legal contract (with English reference)</li>
                  <li>Send via email or WhatsApp</li>
                  <li>Sign digitally</li>
                  <li>Record of transaction for both parties</li>
                </ul>
              </div>
            </div>
          </div>
          <p className="process-note" style={{ marginTop: 20 }}>Verification tells you if the deal is safe.<br />Completion ensures the transaction is done correctly.</p>
          <p className="process-note">This is the same process used to detect fraud before it becomes your problem.<br /><span className="src">Public databases like REPUVE can take up to 30 days to reflect a stolen vehicle. Source: Chamber of Deputies.</span></p>
        </div>
      </section>

      {/* ── 4. MISTAKES ──────────────────────────────────────────────────── */}
      <section id="mistakes" className="b">
        <div className="wrap">
          <span className="lbl">What buyers get wrong</span>
          <h2 className="section-h2">The mistakes that cost the most.</h2>
          <div className="mk-list">

            <div className="mk-item">
              <div className="mk-num">01</div>
              <div>
                <div className="mk-title">Taking the seller&apos;s word that the car is clean.</div>
                <div className="mk-body">Sellers don&apos;t always know about outstanding obligations. In many cases they know and hope you won&apos;t check. Neither situation protects you after the transfer.</div>
              </div>
            </div>

            <div className="mk-item">
              <div className="mk-num">02</div>
              <div>
                <div className="mk-title">Only checking the state where the car is listed.</div>
                <div className="mk-body">A clean Jalisco record doesn&apos;t mean a clean car. Debt and restrictions registered in another state follow the vehicle — not the seller&apos;s current location.</div>
              </div>
            </div>

            <div className="mk-item">
              <div className="mk-num">03</div>
              <div>
                <div className="mk-title">Assuming a legitimate-looking factura is valid.</div>
                <div className="mk-body">Facturas can be altered or issued against different vehicles. The only way to confirm validity is to verify directly against the SAT registry — not by inspecting the document itself.</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── NO-VERIFY RISK ───────────────────────────────────────────────────── */}
      <section className="b">
        <div className="wrap">
          <h2 className="section-h2">What happens if you don&apos;t verify</h2>
          <ul className="who-list">
            <li>You inherit the debt</li>
            <li>You cannot reverse the payment</li>
            <li>You may lose the vehicle</li>
            <li>You have no legal recourse</li>
          </ul>
        </div>
      </section>

      {/* ── 5. STATS BAND ────────────────────────────────────────────────── */}
      <section id="stats">
        <div className="wrap-w">
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 14, textAlign: "center" }}>This is the risk you&apos;re walking into without verification.</p>
          <div className="stats-row">
            <div className="sb">
              <div className="sb-n"><span>40%</span></div>
              <div className="sb-d">of private car sales have irregularities</div>
            </div>
            <div className="sb">
              <div className="sb-n"><span>60%</span></div>
              <div className="sb-d">of fraud cases involve financial scams or hidden debt</div>
            </div>
            <div className="sb">
              <div className="sb-n"><span>$250k</span></div>
              <div className="sb-d">MXN average loss per fraud case</div>
            </div>
          </div>
          <p className="stats-sources">Data sources: Profeco, AMIA, El Financiero, El Universal</p>
        </div>
      </section>

      {/* ── PONR ─────────────────────────────────────────────────────────── */}
      <section className="b">
        <div className="wrap-w">
          <p className="process-note">Once you transfer the money, there is no reversal.</p>
          <p className="process-note" style={{ marginTop: 8 }}>This is exactly why a structured verification process exists before you pay.</p>
        </div>
      </section>

      {/* ── 6. SAMPLE REPORT ─────────────────────────────────────────────── */}
      <section id="sample" className="b">
        <div className="wrap">
          <span className="lbl-accent">Sample report</span>
          <h2 className="section-h2">This is what you see before you decide to pay.</h2>
          <p className="v-sub">Actual output format. Every verified item, every flag, every outstanding amount — specific to the vehicle you&apos;re buying.</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)", marginBottom: 6, letterSpacing: "0.02em" }}>This is what the seller will not show you.</p>

          <div className="sample-card-wrap" style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 16 }}>
            <div className="hero-pill">⚠ Issues detected</div>
            <div className="report-card">
              <div className="rc-header">
                <span className="rc-title">Verification Report</span>
                <span className="rc-badge caution">Caution</span>
              </div>
              <div className="rc-body">

                <div className="rc-vehicle">
                  <div className="rc-plate">JAL·4821·XK</div>
                  <div className="rc-vinfo">
                    <strong>2019 Nissan Sentra</strong>
                    Jalisco · VIN 3N1AB7AP1KY123456 · verified
                  </div>
                </div>

                <div className="rc-section">
                  <div className="rc-section-label">Ownership</div>
                  <div className="rc-row">
                    <span className="rc-row-label">Registered owner match</span>
                    <span className="rc-status s-ok">Confirmed</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Ownership chain</span>
                    <span className="rc-status s-ok">Clean</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Seller identity</span>
                    <span className="rc-status s-ok">Verified</span>
                  </div>
                </div>

                <div className="rc-section">
                  <div className="rc-section-label">Outstanding debt</div>
                  <div className="rc-row">
                    <span className="rc-row-label">TENENCIA arrears (2021–2023)</span>
                    <span className="rc-amount">$9,240 MXN</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Traffic fines (3 violations)</span>
                    <span className="rc-amount">$4,800 MXN</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">SAT lien</span>
                    <span className="rc-status s-ok">None found</span>
                  </div>
                </div>

                <div className="rc-section">
                  <div className="rc-section-label">Registry checks</div>
                  <div className="rc-row">
                    <span className="rc-row-label">REPUVE — theft / cloning</span>
                    <span className="rc-status s-ok">Clear</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Multi-state restrictions</span>
                    <span className="rc-status s-ok">None found</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Factura vs. SAT registry</span>
                    <span className="rc-status s-warn">1 discrepancy</span>
                  </div>
                </div>

                <div className="rc-recommendation">
                  <div className="rc-rec-label">⚠ Recommendation</div>
                  <div className="rc-rec-text">Do not proceed until the debt is paid and the ownership discrepancy is resolved.</div>
                </div>

              </div>
            </div>
            <p className="sample-risk">Potential risk: <strong>$14,040 MXN transferred to buyer</strong></p>
            <p className="sample-legal">Without this, you&apos;re guessing. If you proceed anyway, these issues become your responsibility. The seller walks away. You don&apos;t.</p>
          </div>
          <p className="report-label">Sample — actual output format and level of detail</p>
        </div>
      </section>

      {/* ── REAL OUTCOMES ────────────────────────────────────────────────── */}
      <section id="outcomes" className="b">
        <div className="wrap">
          <span className="lbl-accent">Outcomes</span>
          <h2 className="section-h2">Real situations. Real outcomes.</h2>
          <ul className="outcome-list">
            <li>Buyer avoided $90,000 MXN in hidden debt before payment</li>
            <li>Vehicle flagged as stolen despite appearing clean in REPUVE</li>
            <li>Ownership mismatch prevented a legally invalid purchase</li>
          </ul>
          <p className="stats-sources">These are recent cases from real transactions.</p>
        </div>
      </section>

      {/* ── 7. PRICING ───────────────────────────────────────────────────── */}
      <section id="pricing" className="b">
        <div className="wrap">
          <p className="national-risk">The average fraud loss is $250,000 MXN.<br />Verification costs less than 0.03% of that.</p>
          <p className="national-risk">92.9% of crimes in Mexico go unreported<br /><span className="src">(INEGI)</span></p>
          <span className="lbl-accent">Pricing</span>
          <h2 className="section-h2">One-time. Before you commit.</h2>
          <p className="p-sub">Pay once per vehicle. No account required. Clear risk results before you commit.</p>

          <div className="flex justify-end mb-6">
            <div className="currency-toggle flex items-center bg-white/5 border border-white/10 rounded-md text-xs">
              <button
                onClick={() => setCurrency("USD")}
                className={`px-3 py-1 rounded ${currency === "USD" ? "bg-white text-black" : "text-white/60"}`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency("CAD")}
                className={`px-3 py-1 rounded ${currency === "CAD" ? "bg-white text-black" : "text-white/60"}`}
              >
                CAD
              </button>
              <button
                onClick={() => setCurrency("MXN")}
                className={`px-3 py-1 rounded ${currency === "MXN" ? "bg-white text-black" : "text-white/60"}`}
              >
                MXN
              </button>
            </div>
          </div>

          <div className="pgrid">
            <div className="pcard" style={{ opacity: 0.85 }}>
              <div className="p-name">Registry</div>
              <div className="p-price"><sup>$</sup>{prices[currency].basic}</div>
              <div className="p-note">{currency} · one-time</div>
              <p className="p-desc">Covers the core registries. <strong style={{ opacity: 0.65 }}>If the sale involves cross-state history, SAT debt, or imported documents, you&apos;ll need Full Verification.</strong></p>
              <ul className="p-list">
                <li>Ownership check</li>
                <li>Debt check</li>
                <li>Registration status</li>
                <li>Basic report summary</li>
                <li>Confidence level</li>
              </ul>
              <button onClick={() => handleCheckout("39", currency.toLowerCase())} className="btn-plan">Run basic check</button>
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--sub)", fontWeight: 400, lineHeight: 1.4 }}>
                Charged securely in {currency}{currency === "MXN" && <><br />Optimized for Mexican bank compatibility</>}
              </p>
            </div>

            <div className="pcard feat">
              <div className="feat-badge">Most buyers choose this</div>
              <div className="p-name">Full Verification</div>
              <div className="p-price"><sup>$</sup>{prices[currency].pro}</div>
              <div className="p-note">{currency} · one-time</div>
              <p className="p-desc"><strong>Covers the issues most buyers don&apos;t know to check.</strong> Cross-state, SAT, and import history included.</p>
              <ul className="p-list">
                <li>Ownership verification (multi-source)</li>
                <li>Debt verification (cross-state)</li>
                <li>Registration validation</li>
                <li>Document integrity analysis</li>
                <li>Expert-level verification review</li>
              </ul>
              <p className="p-desc" style={{ marginTop: 12, marginBottom: 16, color: "var(--risk)" }}><strong>One hidden issue can cost you $50,000+ MXN.</strong><br /><span style={{ color: "var(--sub)", fontWeight: 500 }}>This is the level buyers choose when they&apos;re serious about the purchase.</span></p>
              <button onClick={() => handleCheckout("69", currency.toLowerCase())} className="btn-plan feat">Verify before buying →</button>
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--sub)", fontWeight: 400, lineHeight: 1.4 }}>
                Charged securely in {currency}{currency === "MXN" && <><br />Optimized for Mexican bank compatibility</>}
              </p>
            </div>
          </div>

          {process.env.NODE_ENV === "development" && (
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                onClick={() => handleCheckout("test", "mxn")}
                style={{ fontSize: 12, color: "#888", border: "1px dashed #555", borderRadius: 6, padding: "6px 14px", background: "transparent", cursor: "pointer" }}
              >
                [DEV] Test Payment ($10 MXN)
              </button>
            </div>
          )}
          <p className="text-xs text-white/40 mt-4" style={{ marginTop: 16 }}>Prices are fixed in {currency}. You will be charged exactly the amount shown.</p>
          <p className="p-urgency">Most buyers start with a basic check. Serious buyers verify everything before paying.</p>
          <p className="p-guarantee">If we can&apos;t complete verification due to a registry outage, you receive a full refund.</p>
          <p className="p-urgency">This is the last decision you make before money leaves your account.</p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="b">
        <div className="wrap">
          <span className="lbl-accent">FAQ</span>
          <h2 className="section-h2">Common questions before you buy.</h2>
          <div className="faq-list">
            <div className="faq-item">
              <div className="faq-q">Is everything provided in English?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>Yes.<br />The full verification report is provided in English. The purchase agreement is generated in Spanish for legal validity, with a clear English reference translation included below.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Is this legally valid in Mexico?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>Yes.<br />Verification uses official registries and documentation checks used in legal ownership validation.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What if the seller refuses to provide documents?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>That is a major risk signal.<br />Verification helps identify missing or inconsistent ownership data.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">How fast is the verification?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>Most checks are completed within minutes.<br />Full verification may take longer depending on document review.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">I already checked REPUVE. Isn&apos;t that enough?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>No.<br />REPUVE can take days or weeks to update. A vehicle can appear clean and still be stolen or flagged.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What if official databases like REPUVE are unavailable?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>Some official registries, including REPUVE, may occasionally be temporarily unavailable.<br /><br />Our system is designed to give you a complete picture, even if one registry is temporarily unavailable, while clearly indicating any missing checks in your report.<br /><br />Every report includes a confidence level so you can make an informed decision based on the available information.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What happens if issues are found?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>You receive a clear breakdown of risks.<br />You can decide whether to proceed or walk away.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What happens after I pay the seller?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>At that point, any undisclosed debt or legal issue becomes your responsibility.<br />There is no reversal.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. FINAL CTA ─────────────────────────────────────────────────── */}
      <section id="cta">
        <div className="lbl-cta">One decision</div>
        <h2>Verify before you pay.<br /><em>Because after you pay, it&apos;s your problem.</em></h2>
        <p>Once you pay, the risk becomes yours.</p>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <a href="#pricing" className="btn-cta">Start verification →</a>
          <a href="#sample" className="btn-cta-ghost">See sample report</a>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.10)", marginTop: 48, background: "#05070a" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "80px 24px 56px" }}>
          {/* Row 1 */}
          <div className="footer-row1 flex items-center justify-between">
            <div className="text-white font-semibold tracking-tight">
              MexGuardian
            </div>
            <div className="footer-nav flex items-center gap-5 text-sm text-white/55 tracking-wide">
              <a href="#process" className="hover:text-white transition-colors duration-150">How it works</a>
              <a href="#sample" className="hover:text-white transition-colors duration-150">Sample report</a>
              <a href="#pricing" className="hover:text-white transition-colors duration-150">Pricing</a>
              <a href="/privacy" className="hover:text-white transition-colors duration-150">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors duration-150">Terms</a>
            </div>
          </div>
          {/* Row 2 */}
          <div className="footer-row2 flex items-center justify-between text-xs text-white/40" style={{ marginTop: 40 }}>
            <div>© 2026 MexGuardian</div>
            <div className="text-white/40">Verify before you pay.</div>
          </div>
        </div>
      </footer>

      <div className="sticky-bar" style={{ display: showStickyBar ? "flex" : "none" }}>
        <div className="sticky-bar-text">
          <strong>Verify before you pay</strong>
          From $39 · Results in minutes
        </div>
        <a href="#pricing" className="btn-sticky">Start now →</a>
      </div>

    </div>
  );
}
