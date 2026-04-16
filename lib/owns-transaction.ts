/**
 * Single source of truth for transaction ownership.
 *
 * A user owns a transaction when EITHER:
 *   1. The transaction has been bound to their Supabase user_id, OR
 *   2. The transaction's email matches their authenticated email (case-insensitive).
 *
 * The email path intentionally does NOT require user_id === null —
 * it handles the window between checkout (unbound) and bind execution,
 * as well as any edge cases where bind ran against a stale session.
 */
export function ownsTransaction(
  tx: { user_id: string | null; email: string | null },
  user: { id: string; email?: string | null }
): boolean {
  if (tx.user_id === user.id) return true;

  const txEmail   = (tx.email   ?? "").toLowerCase().trim();
  const authEmail = (user.email ?? "").toLowerCase().trim();
  return txEmail !== "" && authEmail !== "" && txEmail === authEmail;
}
