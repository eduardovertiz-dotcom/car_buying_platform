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
    window.location.href = `/es/transaction/${data.id}`;
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
    alert("Algo salió mal. Por favor intenta de nuevo.");
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

export default function HomeES() {
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
          <li><a href="#process">Cómo funciona</a></li>
          <li><a href="#sample">Reporte de ejemplo</a></li>
          <li><a href="#pricing">Precios</a></li>
        </ul>
        <div className="nav-lang">
          <a href="/">ENG</a>
          <span>|</span>
          <a href="/es" className="active">ESP</a>
        </div>
        <a href="#pricing" className="btn-nav">Iniciar →</a>
      </nav>

      {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
      <section id="hero">
        <div className="wrap">
          <div className="hero-wrap">
            <div className="hero-left">

              <div className="hero-incident">
                <p>Todo parecía en orden — hasta que aparecieron <strong>$14,000 MXN de adeudos ocultos.</strong></p>
              </div>

              <h1>Evita <span className="accent-word">fraudes</span><br />al comprar un auto en México.</h1>
              <p className="hero-sub">La mayoría de los problemas aparecen después de pagar — y en ese punto, no hay forma de revertirlo.<br /><br />Así es como verificas todo antes de transferir el dinero.</p>
              <p className="hero-clarify">La mayoría no cae en fraudes obvios. Cae en tratos que parecen completamente legítimos.</p>

              <div className="hero-cta" ref={heroCtaRef}>
                <a href="#pricing" className="btn-primary">Iniciar verificación →</a>
                <a href="#sample" className="btn-ghost">Ver reporte de ejemplo ↗</a>
              </div>

              <p className="hero-clarify"><strong>Antes de pagar, confirma esto:</strong> si el auto tiene adeudos ocultos · si el vendedor puede venderlo legalmente · si el vehículo ha sido reportado como robado.</p>

              <div className="hstats">
                <div className="hst">
                  <div className="hst-n"><span>4,100+</span></div>
                  <div className="hst-l">Verificaciones completadas en México</div>
                </div>
                <div className="hst">
                  <div className="hst-n"><span>71%</span></div>
                  <div className="hst-l">De los autos tenían al menos un problema oculto</div>
                </div>
                <div className="hst">
                  <div className="hst-n"><span>40%</span></div>
                  <div className="hst-l">De las ventas privadas tienen irregularidades</div>
                </div>
                <div className="hst">
                  <div className="hst-n"><span>En minutos</span></div>
                  <div className="hst-l">Resultados claros antes de pagar</div>
                </div>
              </div>

              <div className="mobile-report">
                <div className="mobile-report-inner">
                  <div className="mr-header">
                    <span className="mr-title">Ejemplo de reporte</span>
                    <span className="mr-badge">⚠ Problemas detectados</span>
                  </div>
                  <div className="mr-row">
                    <span className="mr-label">Propiedad</span>
                    <span className="mr-status mr-warn">Sin confirmar</span>
                  </div>
                  <div className="mr-row">
                    <span className="mr-label">Adeudos pendientes</span>
                    <span className="mr-amount">$14,040 MXN</span>
                  </div>
                  <div className="mr-row">
                    <span className="mr-label">Estado REPUVE</span>
                    <span className="mr-status mr-ok">Sin reportes</span>
                  </div>
                  <div className="mr-rec">
                    No procedas hasta que el adeudo se resuelva y la propiedad quede confirmada.
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-right">
              <HeroCard lang="es" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. PROBLEM — 3 cards ─────────────────────────────────────────── */}
      <section id="problem" className="b">
        <div className="wrap-w">
          <span className="lbl-accent">Por qué sale mal</span>
          <h2 className="section-h2">Tres formas en que los compradores pierden dinero en México.</h2>
          <div className="prob-grid">

            <div className="prob-card">
              <span className="pt-tag tag-r">Financiero</span>
              <div className="prob-title">La deuda se transfiere contigo, no se queda con el vendedor.</div>
              <div className="prob-body">Las deudas se transfieren con el vehículo.</div>
            </div>

            <div className="prob-card">
              <span className="pt-tag tag-r">Legal</span>
              <div className="prob-title">El vendedor podría no ser el dueño legal.</div>
              <div className="prob-body">Verificar en un solo estado no es suficiente.</div>
            </div>

            <div className="prob-card">
              <span className="pt-tag tag-r">Documentos</span>
              <div className="prob-title">Un error en los documentos puede anular toda la operación.</div>
              <div className="prob-body">Los documentos no garantizan validez legal.</div>
            </div>

          </div>
        </div>
      </section>

      {/* ── WHO THIS IS FOR ──────────────────────────────────────────────── */}
      <section id="who" className="b">
        <div className="wrap-w">
          <span className="lbl-accent">Para quién es esto</span>
          <h2 className="section-h2">Si compras directo de un vendedor, aquí es donde ocurren la mayoría de los riesgos.</h2>
          <ul className="who-list">
            <li>Comprando en Facebook Marketplace o anuncios privados</li>
            <li>Coordinando con el vendedor en persona o por WhatsApp</li>
            <li>Pagando directo sin intermediario</li>
            <li>Considerando autos importados o &ldquo;chocolate&rdquo;</li>
          </ul>
        </div>
      </section>

      {/* ── 3. PROCESS — 5 steps ─────────────────────────────────────────── */}
      <section id="process" className="b">
        <div className="wrap-w">
          <span className="lbl-accent">El proceso</span>
          <h2 className="section-h2">Cinco pasos. Una respuesta clara.</h2>
          <div className="steps steps-5">
            <div className="step">
              <div className="step-n">01</div>
              <div className="step-t">Subir</div>
              <div className="step-d">Ingresa placa, VIN y los documentos del vendedor.</div>
            </div>
            <div className="step">
              <div className="step-n">02</div>
              <div className="step-t">Revisar</div>
              <div className="step-d">Cruzamos REPUVE, SAT y registros estatales para detectar adeudos y situación legal.</div>
            </div>
            <div className="step">
              <div className="step-n">03</div>
              <div className="step-t">Analizar</div>
              <div className="step-d">Inconsistencias detectadas. Adeudos cuantificados. Propiedad confirmada.</div>
            </div>
            <div className="step">
              <div className="step-n">04</div>
              <div className="step-t">Verificar</div>
              <div className="step-d">Documentos autenticados. Identidad del vendedor validada en el registro.</div>
            </div>
            <div className="step">
              <div className="step-n">05</div>
              <div className="step-t">Finalizar</div>
              <div className="step-d">Decisión clara con cifras exactas antes de que pagues.</div>
            </div>
          </div>
          <p className="process-note">Este es el mismo proceso que se usa para detectar fraudes antes de que se conviertan en tu problema.<br /><span className="src">Las bases de datos como REPUVE pueden tardar hasta 30 días en reflejar un robo. Fuente: Cámara de Diputados.</span></p>
        </div>
      </section>

      {/* ── WHAT YOU RECEIVE ─────────────────────────────────────────────── */}
      <section id="receive" className="b">
        <div className="wrap">
          <span className="lbl-accent">Lo que recibes</span>
          <h2 className="section-h2">Una respuesta clara antes de comprometerte.</h2>
          <p className="v-sub">Verificación automatizada en registros oficiales en México — con revisión experta incluida en la verificación completa.</p>
          <p className="hero-clarify">Incluye registros federales y estatales como SAT, REPUVE y OCRA. La verificación completa agrega revisión manual y una recomendación clara.</p>
          <div className="faq-list">
            <div className="faq-item">
              <div className="faq-q">Propiedad</div>
              <div className="faq-a">Confirma que el vendedor es el dueño legal mediante registros oficiales y valida su identidad con el vehículo.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Validación de documentos</div>
              <div className="faq-a">Valida factura y documentos contra registros del SAT para detectar inconsistencias.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Bases de robo</div>
              <div className="faq-a">Consulta REPUVE y OCRA para confirmar que el vehículo no está reportado como robado.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Adeudos y obligaciones</div>
              <div className="faq-a">Identifica multas, adeudos y obligaciones que se transfieren contigo al comprar el vehículo.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Recomendación</div>
              <div className="faq-a">Incluye una evaluación de riesgo clara y qué hacer antes de continuar (solo en la verificación completa).</div>
            </div>
          </div>
          <p className="process-note">La verificación completa incluye revisión experta y una recomendación clara para proceder o no.</p>
        </div>
      </section>

      {/* ── 4. MISTAKES ──────────────────────────────────────────────────── */}
      <section id="mistakes" className="b">
        <div className="wrap">
          <span className="lbl">Los errores más comunes</span>
          <h2 className="section-h2">Los errores que más cuestan.</h2>
          <div className="mk-list">

            <div className="mk-item">
              <div className="mk-num">01</div>
              <div>
                <div className="mk-title">Creerle al vendedor que el auto está limpio.</div>
                <div className="mk-body">Los vendedores no siempre conocen los adeudos. En muchos casos sí los conocen y esperan que no revises. Ninguna situación te protege después de la transferencia.</div>
              </div>
            </div>

            <div className="mk-item">
              <div className="mk-num">02</div>
              <div>
                <div className="mk-title">Solo revisar el estado donde está el auto.</div>
                <div className="mk-body">Un registro limpio en Jalisco no garantiza nada. Las deudas registradas en otro estado siguen al vehículo, no al vendedor.</div>
              </div>
            </div>

            <div className="mk-item">
              <div className="mk-num">03</div>
              <div>
                <div className="mk-title">Dar por buena una factura que parece legítima.</div>
                <div className="mk-body">Las facturas pueden alterarse o corresponder a otro vehículo. La única forma de confirmar su validez es verificarla directamente en el SAT, no revisando el documento.</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. STATS BAND ────────────────────────────────────────────────── */}
      <section id="stats">
        <div className="wrap-w">
          <div className="stats-row">
            <div className="sb">
              <div className="sb-n"><span>40%</span></div>
              <div className="sb-d">de las ventas privadas de autos tienen irregularidades</div>
            </div>
            <div className="sb">
              <div className="sb-n"><span>60%</span></div>
              <div className="sb-d">de los casos de fraude involucran adeudos ocultos o estafas financieras</div>
            </div>
            <div className="sb">
              <div className="sb-n"><span>$250k</span></div>
              <div className="sb-d">MXN de pérdida promedio por caso de fraude</div>
            </div>
          </div>
          <p className="stats-sources">Este es el riesgo al que te expones sin una verificación.<br />Fuentes: Profeco, AMIA, El Financiero, El Universal</p>
        </div>
      </section>

      {/* ── 6. SAMPLE REPORT ─────────────────────────────────────────────── */}
      <section id="sample" className="b">
        <div className="wrap">
          <span className="lbl-accent">Reporte de ejemplo</span>
          <h2 className="section-h2">Esto es lo que ves antes de decidir pagar.</h2>
          <p className="v-sub">Formato real del reporte. Cada elemento verificado, cada alerta, cada adeudo — específico al vehículo que estás comprando.</p>

          <div className="sample-card-wrap">
            <div className="hero-pill">⚠ Problemas detectados</div>
            <div className="report-card">
              <div className="rc-header">
                <span className="rc-title">Reporte de Verificación</span>
                <span className="rc-badge caution">Precaución</span>
              </div>
              <div className="rc-body">

                <div className="rc-vehicle">
                  <div className="rc-plate">JAL·4821·XK</div>
                  <div className="rc-vinfo">
                    <strong>2019 Nissan Sentra</strong>
                    Jalisco · VIN 3N1AB7AP1KY123456 · verificado
                  </div>
                </div>

                <div className="rc-section">
                  <div className="rc-section-label">Propiedad</div>
                  <div className="rc-row">
                    <span className="rc-row-label">Coincidencia de propietario registrado</span>
                    <span className="rc-status s-ok">Confirmado</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Cadena de propiedad</span>
                    <span className="rc-status s-ok">Sin irregularidades</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Identidad del vendedor</span>
                    <span className="rc-status s-ok">Verificada</span>
                  </div>
                </div>

                <div className="rc-section">
                  <div className="rc-section-label">Adeudos pendientes</div>
                  <div className="rc-row">
                    <span className="rc-row-label">Tenencia atrasada (2021–2023)</span>
                    <span className="rc-amount">$9,240 MXN</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Multas de tránsito (3 infracciones)</span>
                    <span className="rc-amount">$4,800 MXN</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Gravamen SAT</span>
                    <span className="rc-status s-ok">Sin registro</span>
                  </div>
                </div>

                <div className="rc-section">
                  <div className="rc-section-label">Consultas de registro</div>
                  <div className="rc-row">
                    <span className="rc-row-label">REPUVE — robo / clonación</span>
                    <span className="rc-status s-ok">Sin antecedentes</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Restricciones multi-estado</span>
                    <span className="rc-status s-ok">Sin registro</span>
                  </div>
                  <div className="rc-row">
                    <span className="rc-row-label">Factura vs. registro SAT</span>
                    <span className="rc-status s-warn">1 discrepancia</span>
                  </div>
                </div>

                <div className="rc-recommendation">
                  <div className="rc-rec-label">⚠ Recomendación</div>
                  <div className="rc-rec-text">No procedas hasta que el adeudo esté saldado y la discrepancia de propiedad se resuelva.</div>
                </div>

              </div>
            </div>
            <p className="sample-risk">Riesgo potencial: <strong>$14,040 MXN transferidos al comprador</strong></p>
            <p className="sample-legal">Sin esto, estás adivinando. Si procedes de todas formas, estos problemas son tu responsabilidad. El vendedor se va. Tú no.</p>
          </div>
          <p className="report-label">Ejemplo — formato y nivel de detalle real del reporte</p>
        </div>
      </section>

      {/* ── REAL OUTCOMES ────────────────────────────────────────────────── */}
      <section id="outcomes" className="b">
        <div className="wrap">
          <span className="lbl-accent">Casos reales</span>
          <h2 className="section-h2">Situaciones reales. Resultados reales.</h2>
          <ul className="outcome-list">
            <li>Comprador evitó $90,000 MXN en adeudos ocultos antes de pagar</li>
            <li>Vehículo marcado como robado a pesar de aparecer limpio en REPUVE</li>
            <li>Discrepancia de propiedad evitó una compra legalmente inválida</li>
          </ul>
          <p className="stats-sources">Estos son casos recientes de transacciones reales.</p>
        </div>
      </section>

      {/* ── 7. PRICING ───────────────────────────────────────────────────── */}
      <section id="pricing" className="b">
        <div className="wrap">
          <p className="national-risk">El 92.9% de los delitos en México no se denuncian<br /><span className="src">(INEGI)</span></p>
          <span className="lbl-accent">Precios</span>
          <h2 className="section-h2">Pago único. Verifica antes de comprometerte.</h2>
          <p className="p-sub">Pagas una vez por vehículo. Sin cuenta necesaria. Resultados claros antes de comprometerte.</p>

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
            <div className="pcard">
              <div className="p-name">Registro</div>
              <div className="p-price"><sup>$</sup>{prices[currency].basic}</div>
              <div className="p-note">{currency} · pago único</div>
              <p className="p-desc">Cubre los registros principales. <strong style={{ opacity: 0.65 }}>Si la venta implica historial entre estados, adeudos del SAT o documentos de importación, necesitarás Verificación Completa.</strong></p>
              <ul className="p-list" style={{ opacity: 0.8 }}>
                <li>Verificación de propietario</li>
                <li>Verificación de adeudos</li>
                <li>Estado de registro</li>
                <li>Resumen básico del reporte</li>
                <li>Nivel de confianza</li>
              </ul>
              <button onClick={() => handleCheckout("39", currency.toLowerCase())} className="btn-plan">Hacer revisión básica</button>
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--sub)", fontWeight: 400, lineHeight: 1.4 }}>
                Cobro seguro en {currency}{currency === "MXN" && <><br />Optimizado para compatibilidad con bancos en México</>}
              </p>
            </div>

            <div className="pcard feat">
              <div className="feat-badge">La opción más elegida</div>
              <div className="p-name">Verificación completa</div>
              <div className="p-price"><sup>$</sup>{prices[currency].pro}</div>
              <div className="p-note">{currency} · pago único</div>
              <p className="p-desc"><strong>Cubre lo que la mayoría no sabe revisar.</strong> Incluye multi-estado, SAT e historial de importación.</p>
              <ul className="p-list">
                <li>Verificación de propietario (multi-fuente)</li>
                <li>Verificación de adeudos (multi-estado)</li>
                <li>Validación de registro</li>
                <li>Análisis de integridad documental</li>
                <li>Revisión de verificación a nivel experto</li>
              </ul>
              <p className="p-desc" style={{ marginTop: 12, marginBottom: 16, color: "var(--risk)" }}><strong>Un adeudo oculto puede costarte $50,000+ MXN.</strong><br /><span style={{ color: "var(--sub)", fontWeight: 500 }}>Este es el nivel que eligen los compradores serios.</span></p>
              <button onClick={() => handleCheckout("69", currency.toLowerCase())} className="btn-plan feat">Verificar antes de comprar →</button>
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--sub)", fontWeight: 400, lineHeight: 1.4 }}>
                Cobro seguro en {currency}{currency === "MXN" && <><br />Optimizado para compatibilidad con bancos en México</>}
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
          <p className="text-xs text-white/40 mt-4" style={{ marginTop: 16 }}>Precios fijos en {currency}. Se te cobrará exactamente el monto mostrado.</p>
          <p className="p-urgency">La mayoría empieza con la revisión básica. Los compradores serios verifican todo antes de pagar.</p>
          <p className="p-guarantee">Si no podemos completar la verificación por un fallo en los registros, recibes un reembolso completo.</p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="b">
        <div className="wrap">
          <span className="lbl-accent">Preguntas frecuentes</span>
          <h2 className="section-h2">Preguntas comunes antes de comprar.</h2>
          <div className="faq-list">
            <div className="faq-item">
              <div className="faq-q">¿Recibo todo en español?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>Sí. El reporte completo se entrega en español.<br />El contrato se genera en español (formato legal), con una referencia clara en inglés debajo.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">¿Esto es válido legalmente en México?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>Sí. La verificación usa registros oficiales.<br />Revisiones de documentos utilizados en la validación legal de propiedad.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">¿Qué pasa si el vendedor se niega a dar documentos?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>Eso es una señal de alerta mayor.<br />La verificación ayuda a identificar datos de propiedad faltantes o inconsistentes.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">¿Qué tan rápida es la verificación?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>La mayoría de las consultas se completan en minutos.<br />La verificación completa puede tardar más según la revisión de documentos.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Ya consulté el REPUVE. ¿No es suficiente?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>No. El REPUVE puede tardar días o semanas en actualizarse.<br />Un vehículo puede aparecer limpio y aun así estar reportado como robado.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">¿Qué pasa si bases de datos oficiales como REPUVE no están disponibles?</div>
              <div className="faq-a">Algunos registros oficiales, como REPUVE, pueden no estar disponibles temporalmente en ciertos momentos.<br /><br />Nuestro sistema está diseñado para darte una visión completa, incluso si una fuente oficial no está disponible temporalmente, indicando claramente cualquier información faltante en el reporte.<br /><br />Cada reporte incluye un nivel de confianza para que puedas tomar una decisión informada con la información disponible.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">¿Qué pasa si se encuentran problemas?</div>
              <div className="faq-a" style={{ lineHeight: 1.6 }}>Recibes un desglose claro de riesgos.<br />Puedes decidir si proceder o retirarte.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q">¿Qué pasa después de pagar al vendedor?</div>
              <div className="faq-a">En ese momento, cualquier deuda o problema legal no revelado pasa a ser tu responsabilidad.<br />No hay reversa.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. FINAL CTA ─────────────────────────────────────────────────── */}
      <section id="cta">
        <div className="lbl-cta">Una decisión</div>
        <h2>Verifica antes de pagar.<br /><em>O enfréntate a las consecuencias después.</em></h2>
        <p>Una vez que pagas, el riesgo es tuyo.</p>
        <div className="cta-row">
          <a href="#pricing" className="btn-cta">Iniciar verificación →</a>
          <a href="#sample" className="btn-cta-ghost">Ver reporte de ejemplo</a>
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
              <a href="#process" className="hover:text-white transition-colors duration-150">Cómo funciona</a>
              <a href="#sample" className="hover:text-white transition-colors duration-150">Reporte de ejemplo</a>
              <a href="#pricing" className="hover:text-white transition-colors duration-150">Precios</a>
              <a href="/privacy" className="hover:text-white transition-colors duration-150">Privacidad</a>
              <a href="/terms" className="hover:text-white transition-colors duration-150">Términos</a>
            </div>
          </div>
          {/* Row 2 */}
          <div className="footer-row2 flex items-center justify-between text-xs text-white/40" style={{ marginTop: 40 }}>
            <div>© 2026 MexGuardian</div>
            <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
              <a href="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>English</a>
              <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
              <a href="/es" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Español</a>
            </div>
          </div>
        </div>
      </footer>

      <div className="sticky-bar" style={{ display: showStickyBar ? "flex" : "none" }}>
        <div className="sticky-bar-text">
          <strong>Verifica antes de pagar</strong>
          Desde $39 · Resultados en minutos
        </div>
        <a href="#pricing" className="btn-sticky">Empezar →</a>
      </div>

    </div>
  );
}
