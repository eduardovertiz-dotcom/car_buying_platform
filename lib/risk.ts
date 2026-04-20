import type { Transaction } from "@/lib/types";
import { stepEngineCopy } from "@/lib/i18n/stepEngine";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH";

export type RiskOutput = {
  riskLevel: RiskLevel;
  confidence: number;
  confidenceLabel: string;
  issues: string[];
  unknowns: string[];
  resolved: string[];
};

// ─── Confidence label ─────────────────────────────────────────────────────────

export function confidenceLabel(n: number): string {
  if (n >= 90) return "High confidence — all key sources verified";
  if (n >= 70) return "Moderate confidence — most sources verified";
  if (n > 60)  return "Partial confidence — limited data available";
  if (n >= 30) return "Some important data could not be verified. Risk assessment may be incomplete.";
  if (n > 0)   return "Very limited data available. Most critical information could not be verified.";
  return "No data — analysis could not run";
}

// ─── Status → risk level ──────────────────────────────────────────────────────

export function statusToRiskLevel(status: "safe" | "review" | "high_risk"): RiskLevel {
  if (status === "high_risk") return "HIGH";
  if (status === "review")    return "MODERATE";
  return "LOW";
}

// ─── Core engine ──────────────────────────────────────────────────────────────

export function computeRisk(transaction: Transaction, lang: 'en' | 'es' = 'en'): RiskOutput {
  const { documents, vehicle, verification_results } = transaction;
  const r = stepEngineCopy[lang].risk;

  // ── Confidence ─────────────────────────────────────────────────────────────
  // Based purely on data completeness — what we can verify, not what we assume.
  let confidence = 0;
  if (documents.ine.status === "uploaded")          confidence += 30;
  if (documents.registration.status === "uploaded") confidence += 30;
  if (documents.invoice.status === "uploaded")      confidence += 30;
  if (vehicle.vin?.trim() || vehicle.plate?.trim()) confidence += 10;
  confidence = Math.min(confidence, 100);

  // ── Unknowns — gaps we cannot resolve without more data ───────────────────
  const unknowns: string[] = [];
  if (documents.invoice.status !== "uploaded")
    unknowns.push(r.ownershipUnverified);
  if (!vehicle.vin?.trim() && !vehicle.plate?.trim())
    unknowns.push(r.theftNotPerformed);
  if (documents.registration.status !== "uploaded")
    unknowns.push(r.registrationUnverified);
  if (documents.ine.status !== "uploaded")
    unknowns.push(r.sellerIdentityUnverified);

  // ── Issues + Resolved ──────────────────────────────────────────────────────
  const issues: string[] = [];
  const resolved: string[] = [];
  let riskLevel: RiskLevel;

  if (verification_results) {
    // Categorize each finding into issues vs resolved
    const issuePatterns = [
      "theft", "invalid", "mismatch", "failed", "not valid",
      "cancelled", "unresolved", "concern", "could not",
    ];
    const resolvedPatterns = [
      "no theft", "valid", "verified", "authenticated", "confirmed",
      "no fraud", "no cloning", "successfully",
    ];

    for (const finding of verification_results.findings) {
      const lower = finding.toLowerCase();
      if (issuePatterns.some((p) => lower.includes(p))) {
        issues.push(finding);
      } else if (resolvedPatterns.some((p) => lower.includes(p))) {
        resolved.push(finding);
      } else {
        // Unrecognized findings are surfaced as issues — conservative, nothing hidden
        issues.push(finding);
      }
    }

    // Risk level is authoritative from verification status
    riskLevel = statusToRiskLevel(verification_results.status);

    // Integrity guard: LOW is only valid with real confidence — prevents false green badge
    if (riskLevel === "LOW" && confidence === 0) {
      riskLevel = "MODERATE";
    }
  } else {
    // Pre-verification — derive risk from document presence alone
    if (documents.ine.status === "uploaded")
      resolved.push(r.sellerIdSubmitted);
    if (documents.registration.status === "uploaded")
      resolved.push(r.registrationSubmitted);
    if (documents.invoice.status === "uploaded")
      resolved.push(r.invoiceSubmitted);

    // Any unknown = moderate; full data with no issues = low
    riskLevel = unknowns.length > 0 ? "MODERATE" : "LOW";
  }

  return {
    riskLevel,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    issues,
    unknowns,
    resolved,
  };
}
