import type { Transaction } from "@/lib/types";

// Canonical minimum-input predicate — shared across Upload, Check, Analyze, and Verify.
// A transaction has minimum input when the user has provided at least one verifiable signal:
// an identifier (VIN or plate) OR at least one uploaded document.
export function hasMinimumInput(transaction: Transaction): boolean {
  const uploadedDocs = Object.values(transaction.documents).filter(
    (d) => d.status === "uploaded"
  ).length;
  return !!(transaction.vehicle?.vin || transaction.vehicle?.plate) || uploadedDocs > 0;
}
