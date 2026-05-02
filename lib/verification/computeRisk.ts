export type ProviderState = {
  status: "pending" | "processing" | "done" | "error" | "missing";
  data?: Record<string, unknown>;
  error?: string;
};

export type Verifications = Record<string, ProviderState>;

export type CheckStatus = "ok" | "warning" | "error";

export type RiskCheck = {
  label: string;
  status: CheckStatus;
  message: string;
};

export type VerificationRiskLevel = "safe" | "review" | "high_risk";

export type VerificationRisk = {
  score: number;
  level: VerificationRiskLevel;
  flags: string[];
  explanations: string[];
  checks: RiskCheck[];
  recommendation: string;
  confidence: "high" | "medium" | "low";
};

export function computeVerificationRisk(verifications: Verifications): VerificationRisk {
  const flags: string[] = [];
  const explanations: string[] = [];
  const checks: RiskCheck[] = [];

  const repuve  = verifications.repuve;
  const vin     = verifications.vin;
  const factura = verifications.factura;

  // ── REPUVE ────────────────────────────────────────────────────────────────
  if (repuve?.status === "done" && repuve.data?.theft === true) {
    flags.push("theft_record");
    explanations.push("El vehículo está reportado como robado en REPUVE");
    checks.push({ label: "REPUVE", status: "error", message: "Reporte de robo activo" });
  } else if (repuve?.status === "done" && repuve.data?.theft === false) {
    checks.push({ label: "REPUVE", status: "ok", message: "Sin reporte de robo" });
  } else {
    checks.push({ label: "REPUVE", status: "warning", message: "REPUVE no disponible" });
  }

  // ── VIN ───────────────────────────────────────────────────────────────────
  if (vin?.status === "done" && vin.data?.validLength) {
    const year = vin.data.inferredYear ? ` (${vin.data.inferredYear})` : "";
    checks.push({ label: "VIN", status: "ok", message: `VIN válido${year}` });
  } else if (vin?.status === "error") {
    flags.push("vin_invalid");
    explanations.push("VIN inválido o incompleto");
    checks.push({ label: "VIN", status: "error", message: "VIN inválido" });
  } else {
    checks.push({ label: "VIN", status: "warning", message: "VIN no proporcionado" });
  }

  // ── FACTURA ───────────────────────────────────────────────────────────────
  if (factura?.status === "error") {
    flags.push("missing_factura");
    explanations.push("No se proporcionó factura del vehículo");
    checks.push({ label: "Factura", status: "warning", message: "Factura no proporcionada" });
  } else if (factura?.status === "done") {
    checks.push({ label: "Factura", status: "ok", message: "Factura válida" });
  } else {
    checks.push({ label: "Factura", status: "warning", message: "Factura no disponible" });
  }

  // ── Scoring ───────────────────────────────────────────────────────────────
  let score = 100;
  if (flags.includes("theft_record")) {
    score = 0;
  } else {
    if (flags.includes("vin_invalid"))     score -= 30;
    if (flags.includes("missing_factura")) score -= 20;
  }
  score = Math.max(0, Math.min(100, score));

  // ── Level ─────────────────────────────────────────────────────────────────
  const level: VerificationRiskLevel =
    score >= 80 ? "safe" : score >= 50 ? "review" : "high_risk";

  // ── Recommendation ────────────────────────────────────────────────────────
  const recommendation =
    level === "safe" ? "Proceder con la compra" :
    level === "review" ? "Revisar detalles antes de continuar" :
    "No se recomienda continuar";

  // ── Confidence ────────────────────────────────────────────────────────────
  const hasRepuve = repuve?.status === "done" || repuve?.status === "error";
  const hasVin    = vin?.status    === "done" || vin?.status    === "error";
  const confidence: "high" | "medium" | "low" =
    hasRepuve && hasVin ? "high" :
    hasRepuve || hasVin ? "medium" : "low";

  return { score, level, flags, explanations, checks, recommendation, confidence };
}
