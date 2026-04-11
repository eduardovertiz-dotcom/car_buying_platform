/**
 * Central mode switch for the verification system.
 *
 * Allowed values: "manual" | "automated"
 * Default:        "manual"
 *
 * To switch to automated:
 *   VERIFICATION_MODE=automated   (in .env.local or Vercel env vars)
 *
 * This is the only place in the codebase that reads VERIFICATION_MODE.
 */
export function isManualMode(): boolean {
  return (process.env.VERIFICATION_MODE ?? "manual") === "manual";
}
