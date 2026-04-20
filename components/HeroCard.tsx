"use client";

import { useState, useEffect, useRef } from "react";

type Lang = "en" | "es";
type ReportRow = { label: string; text: string; cls: "s-ok" | "s-risk" | "s-warn" | "amount" };

type Scenario = {
  id: string;
  plate: string;
  vehicle: string;
  region: string;
  vin: string;
  ownership: ReportRow[];
  debt: ReportRow[];
  docs: ReportRow[];
  recommendation: string;
  recommendation_es: string;
};

// ── Translations ────────────────────────────────────────────────────────────

const UI: Record<Lang, {
  title: string;
  recLabel: string;
  sections: { ownership: string; debt: string; docs: string };
  pills: { critical: string; caution: string; clear: string };
}> = {
  en: {
    title: "Verification\nReport",
    recLabel: "Recommendation",
    sections: { ownership: "Ownership", debt: "Outstanding debt", docs: "Document integrity" },
    pills: { critical: "Do not proceed", caution: "Caution", clear: "Clear" },
  },
  es: {
    title: "Reporte de\nVerificación",
    recLabel: "Recomendación",
    sections: { ownership: "Titularidad", debt: "Adeudos", docs: "Documentos" },
    pills: { critical: "No proceder", caution: "Precaución", clear: "Aprobado" },
  },
};

const ROW_LABELS: Record<string, string> = {
  "Legal owner match":  "Titular legal",
  "Ownership chain":    "Cadena",
  "TENENCIA arrears":   "TENENCIA",
  "Traffic fines":      "Multas",
  "SAT lien":           "Grav. SAT",
  "REPUVE status":      "REPUVE",
  "Factura vs registry":"Factura/reg.",
};

const ROW_VALUES: Record<string, string> = {
  "Not confirmed":       "Sin confirmar",
  "Unregistered gap":    "Brecha no registrada",
  "Confirmed":           "Confirmado",
  "No gaps found":       "Sin brechas",
  "None found":          "Sin adeudos",
  "Flagged — stolen":    "Marcado — robado",
  "No factura presented":"Sin factura",
  "Match confirmed":     "Confirmada",
  "Not flagged":         "Sin reporte",
  "Review needed":       "Revisión",
};

// ── Scenarios ────────────────────────────────────────────────────────────────

const HERO_SCENARIOS: Scenario[] = [
  {
    id: "stolen_no_title",
    plate: "CDMX·3847·KR",
    vehicle: "2020 Honda CR-V",
    region: "Ciudad de México",
    vin: "2HKRW2H83LH612847",
    ownership: [
      { label: "Legal owner match", text: "Not confirmed",    cls: "s-risk" },
      { label: "Ownership chain",   text: "Unregistered gap", cls: "s-risk" },
    ],
    debt: [
      { label: "TENENCIA arrears", text: "$12,800 MXN",         cls: "amount" },
      { label: "Traffic fines",    text: "None found",          cls: "s-ok"   },
      { label: "SAT lien",         text: "Active — $28,000 MXN", cls: "s-risk" },
    ],
    docs: [
      { label: "REPUVE status",       text: "Flagged — stolen",     cls: "s-risk" },
      { label: "Factura vs registry", text: "No factura presented", cls: "s-risk" },
    ],
    recommendation:    "Do not proceed. Vehicle is flagged in REPUVE as stolen. Legal ownership cannot be confirmed and no factura was presented.",
    recommendation_es: "No proceder. El vehículo está marcado en REPUVE como robado. No se pudo confirmar la titularidad y no se presentó factura.",
  },
  {
    id: "debt_caution",
    plate: "JAL·4492·RB",
    vehicle: "2021 Nissan Frontier",
    region: "Jalisco",
    vin: "1N6AD0EV5MN731204",
    ownership: [
      { label: "Legal owner match", text: "Confirmed",     cls: "s-ok" },
      { label: "Ownership chain",   text: "No gaps found", cls: "s-ok" },
    ],
    debt: [
      { label: "TENENCIA arrears", text: "$9,600 MXN", cls: "amount" },
      { label: "Traffic fines",    text: "None found",  cls: "s-ok"   },
      { label: "SAT lien",         text: "None found",  cls: "s-ok"   },
    ],
    docs: [
      { label: "REPUVE status",       text: "Not flagged",     cls: "s-ok" },
      { label: "Factura vs registry", text: "Match confirmed", cls: "s-ok" },
    ],
    recommendation:    "Proceed only if seller clears the $9,600 MXN TENENCIA balance before transfer — debt is legally transferable to buyer at title change.",
    recommendation_es: "Proceder solo si el vendedor liquida los $9,600 MXN de TENENCIA antes del cambio de nombre — la deuda es transferible al comprador.",
  },
  {
    id: "all_clear",
    plate: "MTY·8815·ZK",
    vehicle: "2020 Toyota RAV4",
    region: "Nuevo León",
    vin: "2T3F1RFV5LC088421",
    ownership: [
      { label: "Legal owner match", text: "Confirmed",     cls: "s-ok" },
      { label: "Ownership chain",   text: "No gaps found", cls: "s-ok" },
    ],
    debt: [
      { label: "TENENCIA arrears", text: "None found", cls: "s-ok" },
      { label: "Traffic fines",    text: "None found", cls: "s-ok" },
      { label: "SAT lien",         text: "None found", cls: "s-ok" },
    ],
    docs: [
      { label: "REPUVE status",       text: "Not flagged",     cls: "s-ok" },
      { label: "Factura vs registry", text: "Match confirmed", cls: "s-ok" },
    ],
    recommendation:    "Clear to proceed. Ownership confirmed, no outstanding debt, factura matches registry, and no stolen vehicle flags detected.",
    recommendation_es: "Aprobado para proceder. Titularidad confirmada, sin adeudos, factura válida y sin reporte de robo.",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function derivePill(rec: string, lang: Lang): { text: string; cls: "caution" | "critical" | "clear" } {
  const { pills } = UI[lang];
  if (rec.startsWith("Do not proceed"))   return { text: pills.critical, cls: "critical" };
  if (rec.startsWith("Proceed only if"))  return { text: pills.caution,  cls: "caution"  };
  if (rec.startsWith("Clear to proceed")) return { text: pills.clear,    cls: "clear"    };
  return { text: pills.caution, cls: "caution" };
}

const getInitialScenario = (): Scenario => {
  try {
    const stored = sessionStorage.getItem("heroScenario");
    if (stored) {
      const match = HERO_SCENARIOS.find(s => s.id === JSON.parse(stored).id);
      if (match) return match;
    }
  } catch {}
  const random = HERO_SCENARIOS[Math.floor(Math.random() * HERO_SCENARIOS.length)];
  try { sessionStorage.setItem("heroScenario", JSON.stringify(random)); } catch {}
  return random;
};

function Row({ row, lang }: { row: ReportRow; lang: Lang }) {
  const label = lang === "es" ? (ROW_LABELS[row.label] ?? row.label) : row.label;
  const rawText = lang === "es" && row.cls !== "amount"
    ? (ROW_VALUES[row.text] ?? row.text.replace(/^Active — /, "Activo — "))
    : row.text;
  const text = rawText;
  return (
    <div className="rc-row">
      <span className="rc-row-label">{label}</span>
      {row.cls === "amount"
        ? <span className="rc-amount">{text}</span>
        : <span className={`rc-status ${row.cls}`}>{text}</span>
      }
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HeroCard({ lang = "en" }: { lang?: Lang }) {
  const [scenario, setScenario] = useState<Scenario>(HERO_SCENARIOS[0]);
  const [opacity, setOpacity] = useState(1);
  const hovered = useRef(false);
  const t = UI[lang];

  useEffect(() => {
    setScenario(getInitialScenario());
  }, []);

  useEffect(() => {
    if (window.innerWidth <= 900) return;
    const rotate = () => {
      if (hovered.current) return;
      setOpacity(0);
      setTimeout(() => {
        setScenario(prev => {
          const idx = HERO_SCENARIOS.findIndex(s => s.id === prev.id);
          const next = HERO_SCENARIOS[(idx + 1) % HERO_SCENARIOS.length];
          try { sessionStorage.setItem("heroScenario", JSON.stringify(next)); } catch {}
          return next;
        });
        setOpacity(1);
      }, 150);
    };
    const id = setInterval(rotate, 7000);
    return () => clearInterval(id);
  }, []);

  const rec  = lang === "es" ? scenario.recommendation_es : scenario.recommendation;
  const pill = derivePill(scenario.recommendation, lang);

  return (
    <div
      className="hero-phone"
      onMouseEnter={() => { hovered.current = true; }}
      onMouseLeave={() => { hovered.current = false; }}
    >
      <div className="hero-phone-frame">
        <div className="hero-phone-screen" style={{ opacity, transition: "opacity 150ms ease" }}>

          <div className="rc-header">
            <span className="rc-title">
              {t.title.split("\n").map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </span>
            <span className={`rc-badge ${pill.cls}`}>{pill.text}</span>
          </div>

          <div className="rc-body">
            <div className="rc-vehicle">
              <div className="rc-plate">{scenario.plate}</div>
              <div className="rc-vinfo">
                <strong>{scenario.vehicle}</strong>
                {scenario.region} · VIN {scenario.vin}
              </div>
            </div>

            <div className="rc-section">
              <div className="rc-section-label">{t.sections.ownership}</div>
              {scenario.ownership.map((row, i) => <Row key={i} row={row} lang={lang} />)}
            </div>

            <div className="rc-section">
              <div className="rc-section-label">{t.sections.debt}</div>
              {scenario.debt.map((row, i) => <Row key={i} row={row} lang={lang} />)}
            </div>

            <div className="rc-section">
              <div className="rc-section-label">{t.sections.docs}</div>
              {scenario.docs.map((row, i) => <Row key={i} row={row} lang={lang} />)}
            </div>

            <div className="rc-recommendation">
              <div className="rc-rec-label">{t.recLabel}</div>
              <div className="rc-rec-text">{rec}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
