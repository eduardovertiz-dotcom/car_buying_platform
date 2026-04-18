import { createAdminClient } from "@/lib/supabase/admin";

export async function logError(
  source: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const adminDb = createAdminClient();
    await adminDb.from("error_logs").insert({ source, message, context: context ?? null });
  } catch {
    console.error("[logError] failed to write to error_logs:", { source, message });
  }
}
