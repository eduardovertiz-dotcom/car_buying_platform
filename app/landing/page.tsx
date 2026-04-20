import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export default function LandingPage() {
  return (
    <div className={`landing ${dmSans.className}`}>

      {/* NAV */}
      <nav>
        <a href="#" className="logo">
          <div className="logo-shield">
            <svg width="12" height="14" viewBox="0 0 12 14" fill="white">
              <path d="M6 0L0 2.5V7C0 10.25 2.58 13.3 6 14C9.42 13.3 12 10.25 12 7V2.5L6 0Z"/>
            </svg>
          </div>
          MexGuardian
        </a>
        <ul>
          <li><a href="#process">How it works</a></li>
          <li><a href="#verified">What&#39;s covered</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
        <a href="#pricing" className="btn-nav">Start verification →</a>
      </nav>


      {/* HERO */}
      <section id="hero">
        <div className="wrap-w">
          <div className="hero-inner">

            {/* LEFT: copy */}
            <div className="hero-left">
              <div className="hero-incident">
                <p>Everything looked fine. Three weeks later, <strong>$18,400 MXN in fines transferred with the title.</strong> The seller had moved. Recovery: none.</p>
              </div>

              <h1>Don&#39;t get <span className="accent-word">scammed</span><br/>buying a car<br/>in Mexico.</h1>

              <p className="hero-sub">Checks <span className="kw">ownership</span>, <span className="kw">debt</span>, and <span className="kw">fraud</span> before you buy.</p>
              <p className="hero-clarify">One report. Official Mexican registries. Clear go / no-go before you hand over a peso.</p>

              <div className="hero-cta">
                <a href="#pricing" className="btn-primary">Start verification →</a>
                <a href="#verified" className="btn-ghost">See sample report ↗</a>
              </div>

              <div className="hstats">
                <div className="hst">
                  <div className="hst-n"><span>4,100+</span></div>
                  <div className="hst-l">Verifications completed in Mexico</div>
                </div>
                <div className="hst">
                  <div className="hst-n"><span>71%</span></div>
                  <div className="hst-l">Of vehicles had at least one undisclosed issue</div>
                </div>
                <div className="hst">
                  <div className="hst-n">24 hrs</div>
                  <div className="hst-l">Average report delivery</div>
                </div>
              </div>
            </div>

            {/* RIGHT: report preview */}
            <div className="hero-right">
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
                      Jalisco · VIN verified
                    </div>
                  </div>

                  <div className="rc-section">
                    <div className="rc-section-label">Ownership</div>
                    <div className="rc-row">
                      <span className="rc-row-label">Legal owner match</span>
                      <span className="rc-status s-ok">Confirmed</span>
                    </div>
                    <div className="rc-row">
                      <span className="rc-row-label">Ownership chain</span>
                      <span className="rc-status s-ok">Clean</span>
                    </div>
                  </div>

                  <div className="rc-section">
                    <div className="rc-section-label">Outstanding debt</div>
                    <div className="rc-row">
                      <span className="rc-row-label">TENENCIA arrears</span>
                      <span className="rc-amount">$9,240 MXN</span>
                    </div>
                    <div className="rc-row">
                      <span className="rc-row-label">Traffic fines</span>
                      <span className="rc-amount">$4,800 MXN</span>
                    </div>
                    <div className="rc-row">
                      <span className="rc-row-label">SAT lien</span>
                      <span className="rc-status s-ok">None found</span>
                    </div>
                  </div>

                  <div className="rc-section">
                    <div className="rc-section-label">Document integrity</div>
                    <div className="rc-row">
                      <span className="rc-row-label">REPUVE status</span>
                      <span className="rc-status s-ok">Clear</span>
                    </div>
                    <div className="rc-row">
                      <span className="rc-row-label">Factura vs. registry</span>
                      <span className="rc-status s-warn">1 discrepancy</span>
                    </div>
                  </div>

                  <div className="rc-recommendation">
                    <div className="rc-rec-label">Recommendation</div>
                    <div className="rc-rec-text">Do not proceed until seller resolves $14,040 MXN in transferable debt and the factura discrepancy is explained.</div>
                  </div>

                </div>
              </div>
              <p className="report-label">Sample report — actual output format</p>
            </div>

          </div>
        </div>
      </section>


      {/* PATTERNS */}
      <section id="patterns" className="b">
        <div className="wrap">
          <span className="lbl-accent">What goes wrong</span>
          <h2>These are the problems<br/>we see most often.</h2>

          <div className="pt-item">
            <div>
              <div className="pt-title">Debt stays with the car. You inherit it.</div>
              <div className="pt-body">TENENCIA, multas, and SAT liens transfer automatically at title change. The seller&#39;s debt becomes yours the moment you sign.</div>
            </div>
            <span className="pt-tag tag-r">Financial</span>
          </div>

          <div className="pt-item">
            <div>
              <div className="pt-title">Ownership doesn&#39;t match the seller.</div>
              <div className="pt-body">The person selling isn&#39;t the registered owner. Title transfer may be blocked — or legally challenged after you&#39;ve already paid.</div>
            </div>
            <span className="pt-tag tag-r">Legal</span>
          </div>

          <div className="pt-item">
            <div>
              <div className="pt-title">VIN doesn&#39;t match across documents.</div>
              <div className="pt-body">One discrepancy between the plate, factura, and federal registry can void the transaction or expose you to criminal liability.</div>
            </div>
            <span className="pt-tag tag-r">Document</span>
          </div>

          <div className="pt-item">
            <div>
              <div className="pt-title">Problems exist outside the local state.</div>
              <div className="pt-body">A clean Jalisco record doesn&#39;t mean a clean car. Active restrictions elsewhere won&#39;t appear in a single-state check.</div>
            </div>
            <span className="pt-tag tag-w">Registry</span>
          </div>
        </div>
      </section>


      {/* STATS BAND */}
      <section id="stats">
        <div className="wrap-w">
          <div className="stats-row">
            <div className="sb">
              <div className="sb-n"><span>40%</span></div>
              <div className="sb-d">of vehicles had outstanding obligations the seller never disclosed</div>
            </div>
            <div className="sb">
              <div className="sb-n"><span>60%</span></div>
              <div className="sb-d">had document inconsistencies across official registry sources</div>
            </div>
            <div className="sb">
              <div className="sb-n"><span>0%</span></div>
              <div className="sb-d">recovery rate for buyers who found issues only after completing the transaction</div>
            </div>
          </div>
        </div>
      </section>


      {/* PROCESS */}
      <section id="process" className="b">
        <div className="wrap">
          <span className="lbl-accent">The process</span>
          <h2>Four steps. One clear answer.</h2>
          <div className="steps">
            <div className="step">
              <div className="step-n">01</div>
              <div className="step-t">Upload</div>
              <div className="step-d">Add plate, VIN, and state of registration.</div>
            </div>
            <div className="step">
              <div className="step-n">02</div>
              <div className="step-t">Check</div>
              <div className="step-d">Cross-referenced against REPUVE, SAT, and state debt registries.</div>
            </div>
            <div className="step">
              <div className="step-n">03</div>
              <div className="step-t">Analyze</div>
              <div className="step-d">Inconsistencies flagged. Debt quantified. Ownership confirmed.</div>
            </div>
            <div className="step">
              <div className="step-n">04</div>
              <div className="step-t">Decide</div>
              <div className="step-d">Clear go / no-go. Delivered within 24 hours.</div>
            </div>
          </div>
        </div>
      </section>


      {/* VERIFIED */}
      <section id="verified" className="b">
        <div className="wrap">
          <span className="lbl">Coverage</span>
          <h2>What gets verified before you buy.</h2>
          <p className="v-sub">Every check sourced from official Mexican government registries — not third-party aggregators.</p>
          <div className="vgrid">
            <div className="vi">
              <div className="vck"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div><div className="vt">Seller confirmed as legal owner</div><div className="vd">Registered owner matches the person selling</div></div>
            </div>
            <div className="vi">
              <div className="vck"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div><div className="vt">Debt identified before purchase</div><div className="vd">TENENCIA, multas, and SAT liens quantified before transfer</div></div>
            </div>
            <div className="vi">
              <div className="vck"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div><div className="vt">VIN verified across all records</div><div className="vd">REPUVE federal registry checked for theft and cloning</div></div>
            </div>
            <div className="vi">
              <div className="vck"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div><div className="vt">Invoice verified against SAT</div><div className="vd">Factura, plates, and registry compared for discrepancies</div></div>
            </div>
            <div className="vi">
              <div className="vck"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div><div className="vt">Multi-state restriction check</div><div className="vd">All 31 states and CDMX, not just where the car is listed</div></div>
            </div>
            <div className="vi">
              <div className="vck"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div><div className="vt">Clear go / no-go recommendation</div><div className="vd">Specific figures. Plain language. No ambiguity.</div></div>
            </div>
          </div>
        </div>
      </section>


      {/* TESTIMONIALS */}
      <section id="testimonials" className="b">
        <div className="wrap">
          <span className="lbl">Early users</span>
          <h2>Real situations. Real outcomes.</h2>
          <div className="tl">
            <div className="ti">
              <div><div className="tn">Todd M.</div><div className="tc">American expat<br/>Guadalajara, JAL</div></div>
              <div>
                <p className="tq">Report came back with <strong>$12,000 MXN in unpaid fines</strong> the seller had never mentioned. We walked away. Found a clean car two weeks later for the same price.</p>
                <div className="tout"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> Bad deal avoided</div>
              </div>
            </div>
            <div className="ti">
              <div><div className="tn">Sandra K.</div><div className="tc">Canadian expat<br/>Puerto Vallarta, JAL</div></div>
              <div>
                <p className="tq">Had no idea debt transfers with the car here. The factura looked completely legitimate. MexGuardian found <strong>a SAT lien that wasn&#39;t visible anywhere obvious.</strong></p>
                <div className="tout"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> SAT lien uncovered</div>
              </div>
            </div>
            <div className="ti">
              <div><div className="tn">Alejandro T.</div><div className="tc">Mexican buyer<br/>Ciudad de México</div></div>
              <div>
                <p className="tq">VIN matched the plates but flagged different ownership across two states. <strong>The seller couldn&#39;t explain it.</strong> Report gave me the documentation to walk away cleanly.</p>
                <div className="tout"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> Ownership discrepancy flagged</div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* TRUST */}
      <section id="trust">
        <div className="wrap">
          <span className="lbl">Built in Mexico</span>
          <h2>For people navigating it.</h2>
          <p className="tr-sub">Built by people who understand how used-car transactions actually work here — not adapted from a foreign product.</p>
          <div className="tr-items">
            <div className="tr-item">
              <div className="tr-dot"></div>
              <div className="tr-text">
                <strong>Mexican registries, directly</strong>
                <span>REPUVE, SAT, RNVE, and state TENENCIA systems — not third-party aggregators.</span>
              </div>
            </div>
            <div className="tr-item">
              <div className="tr-dot"></div>
              <div className="tr-text">
                <strong>Your documents stay private</strong>
                <span>We verify with official registries on your behalf. Nothing passed to third parties.</span>
              </div>
            </div>
            <div className="tr-item">
              <div className="tr-dot"></div>
              <div className="tr-text">
                <strong>English support throughout</strong>
                <span>Reports and communication in English. You won&#39;t be navigating bureaucratic Spanish alone.</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* PRICING */}
      <section id="pricing" className="b">
        <div className="wrap">
          <span className="lbl-accent">Pricing</span>
          <h2>Choose how much risk to remove.</h2>
          <p className="p-sub">One-time payment per verification. No account required.</p>

          <div className="pgrid">
            <div className="pcard">
              <div className="p-name">Registry</div>
              <div className="p-price"><sup>$</sup>39</div>
              <div className="p-note">USD · one-time</div>
              <p className="p-desc">Covers the most common risks. <strong>Suitable for straightforward private sales.</strong></p>
              <ul className="p-list">
                <li>Seller confirmed as legal owner</li>
                <li>Outstanding fines &amp; TENENCIA</li>
                <li>REPUVE federal VIN check</li>
                <li>Document consistency review</li>
                <li>Go / no-go recommendation</li>
              </ul>
              <a href="#" className="btn-plan">Start basic check</a>
            </div>

            <div className="pcard feat">
              <div className="feat-badge">Most buyers choose this</div>
              <div className="p-name">Full Verification</div>
              <div className="p-price"><sup>$</sup>69</div>
              <div className="p-note">USD · one-time</div>
              <p className="p-desc"><strong>Covers the issues most buyers don&#39;t know to check.</strong> Cross-state, SAT, and import history included.</p>
              <ul className="p-list">
                <li>Everything in Registry</li>
                <li>Multi-state debt check</li>
                <li>SAT lien verification</li>
                <li>Import document review</li>
                <li>Extended ownership chain</li>
                <li>Priority 12-hr delivery</li>
              </ul>
              <a href="#" className="btn-plan feat">Verify before buying →</a>
            </div>
          </div>

          <p className="p-guarantee">Both plans: report within 24 hours (12 hrs on Full Verification). If we can&#39;t complete verification due to a registry outage, you receive a full refund.</p>
        </div>
      </section>


      {/* FAQ */}
      <section id="faq" className="b">
        <div className="wrap">
          <span className="lbl">Questions</span>
          <h2>Things expats always ask us.</h2>
          <div className="fgrid">
            <div className="fi">
              <div className="fq">What do I need to provide?</div>
              <div className="fa">License plate number, state of registration, and ideally the VIN. You don&#39;t need the factura to start.</div>
            </div>
            <div className="fi">
              <div className="fq">What is REPUVE? What is SAT?</div>
              <div className="fa">REPUVE is the federal vehicle registry for stolen and cloned vehicles. SAT is Mexico&#39;s tax authority. Both affect your legal liability as the new owner.</div>
            </div>
            <div className="fi">
              <div className="fq">What if the report flags a problem?</div>
              <div className="fa">The report specifies the exact issue, amount (if financial), and which registry flagged it. Use it to negotiate, request resolution, or walk away with documentation.</div>
            </div>
            <div className="fi">
              <div className="fq">How long does it take?</div>
              <div className="fa">Registry plan: up to 24 hours. Full Verification: up to 12 hours. Most reports arrive faster than the stated maximum.</div>
            </div>
            <div className="fi">
              <div className="fq">Does this cover all Mexican states?</div>
              <div className="fa">Yes — all 31 states and CDMX. Multi-state checking is standard on Full Verification and available on Registry for cross-state vehicles.</div>
            </div>
            <div className="fi">
              <div className="fq">What happens to my documents?</div>
              <div className="fa">We query official registries using the identifiers you provide. Nothing stored beyond the verification window. Nothing shared with third parties.</div>
            </div>
          </div>
        </div>
      </section>


      {/* CTA */}
      <section id="cta">
        <div className="lbl-cta">One decision</div>
        <h2>Verify before you pay.<br/><em>Or deal with it after.</em></h2>
        <p>$39 now, or inherit whatever&#39;s attached to the car.</p>
        <div className="cta-row">
          <a href="#pricing" className="btn-cta">Start verification →</a>
          <a href="#verified" className="btn-cta-ghost">See what&#39;s included</a>
        </div>
      </section>


      {/* FOOTER */}
      <footer>
        <a href="#" className="fl">
          <div className="fl-shield">
            <svg width="11" height="13" viewBox="0 0 12 14" fill="white">
              <path d="M6 0L0 2.5V7C0 10.25 2.58 13.3 6 14C9.42 13.3 12 10.25 12 7V2.5L6 0Z"/>
            </svg>
          </div>
          MexGuardian
        </a>
        <ul className="flinks">
          <li><a href="#">How it works</a></li>
          <li><a href="#">Sample report</a></li>
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms</a></li>
          <li><a href="#">Contact</a></li>
        </ul>
        <span className="fcopy">© 2025 MexGuardian</span>
      </footer>

    </div>
  );
}
