import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS.
 *
 * Use ONLY in server-side code (API routes, Server Components).
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY to the client.
 *
 * Use for:
 *  - Admin operations (verify, queue, next-pending)
 *  - Transaction reads that must work without user auth session
 *  - Notification lookups
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
