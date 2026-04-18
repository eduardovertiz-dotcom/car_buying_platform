/**
 * Ownership is determined solely by user_id.
 * Email is never used for access control.
 */
export function ownsTransaction(
  tx: { user_id: string | null },
  user: { id: string }
): boolean {
  return tx.user_id === user.id;
}
