import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logError";
import { repuveProvider } from "@/lib/verification/providers/repuve";
import { vinProvider } from "@/lib/verification/providers/vin";
import { facturaProvider } from "@/lib/verification/providers/factura";
import type { Provider } from "@/lib/verification/providers/index";
import { computeVerificationRisk } from "@/lib/verification/computeRisk";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProviderState = {
  status: "pending" | "processing" | "done" | "error" | "missing";
  data?: Record<string, unknown>;
  error?: string;
};

type Verifications = Record<string, ProviderState>;

const SYSTEM_ERROR_RISK = {
  score: 0,
  level: "high_risk" as const,
  flags: ["system_error"],
  explanations: ["No se pudo completar la verificación"],
  checks: [] as [],
  recommendation: "No se recomienda continuar",
  confidence: "low" as const,
};

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  }

  let plate: string | undefined;
  let vin: string | undefined;
  try {
    const body = await req.json();
    plate =
      typeof body.plate === "string" && body.plate.trim()
        ? body.plate.toUpperCase().replace(/\s/g, "").replace(/-/g, "")
        : undefined;
    vin =
      typeof body.vin === "string" && body.vin.trim()
        ? body.vin.toUpperCase().trim()
        : undefined;
  } catch {
    // proceed with undefined inputs
  }

  const adminDb = createAdminClient();

  const { data: tx, error: fetchError } = await adminDb
    .from("transactions")
    .select("id, plan, verifications, verification_status, risk_output")
    .eq("id", id)
    .single();

  if (fetchError || !tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Idempotency guard — skip only when both complete AND risk_output exists.
  // If risk_output is missing despite "complete" status, fall through to recompute.
  if (tx.verification_status === "complete" && tx.risk_output) {
    return NextResponse.json({ ok: true });
  }

  const plan = tx.plan as string;
  const verifications: Verifications = (tx.verifications as Verifications) ?? {};

  // Compose provider set based on plan and available input.
  // Guards are explicit here — do not rely on downstream provider logic.
  const providerEntries: Array<{ key: string; fn: Provider; input: Record<string, unknown> }> = [];

  if (plan === "69") {
    if (plate) providerEntries.push({ key: "repuve", fn: repuveProvider, input: { plate } });
    providerEntries.push(         { key: "factura", fn: facturaProvider, input: {} });
  }

  if (vin) {
    providerEntries.push({ key: "vin", fn: vinProvider, input: { vin } });
  }

  if (providerEntries.length === 0) {
    return NextResponse.json({ ok: true, message: "no_providers" });
  }

  // Skip providers already done or in-flight (idempotency)
  const toRun = providerEntries.filter(({ key }) => {
    const state = verifications[key];
    return !state || (state.status !== "done" && state.status !== "processing");
  });

  if (toRun.length === 0) {
    return NextResponse.json({ ok: true, message: "all_complete" });
  }

  // Mark all pending providers as "processing" in one write
  const updatedVerifications: Verifications = { ...verifications };
  for (const { key } of toRun) {
    updatedVerifications[key] = { status: "processing" };
  }

  await adminDb
    .from("transactions")
    .update({ verifications: updatedVerifications, verification_status: "processing" })
    .eq("id", id);

  console.log("[verify] starting", { providers: toRun.map((e) => e.key), transactionId: id });

  // Execute providers in parallel
  const settled = await Promise.allSettled(
    toRun.map(async ({ key, fn, input }) => {
      console.log("[verify] provider start", { provider: key, transactionId: id });
      try {
        const result = await fn(input);
        if (result.ok) {
          console.log("[verify] provider success", { provider: key, transactionId: id });
        } else {
          console.log("[verify] provider error", { provider: key, error: result.error, transactionId: id });
        }
        return { key, result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[verify] provider exception", { provider: key, message, transactionId: id });
        await logError("verify_provider", message, { provider: key, transactionId: id });
        return { key, result: { ok: false as const, error: "exception" } };
      }
    })
  );

  // Write results — never overwrite "done"
  const finalVerifications: Verifications = { ...updatedVerifications };
  for (const s of settled) {
    if (s.status === "fulfilled") {
      const { key, result } = s.value;
      if (finalVerifications[key]?.status !== "done") {
        finalVerifications[key] = result.ok
          ? { status: "done",  data:  result.data ?? {} }
          : { status: "error", error: result.error ?? "unknown" };
      }
    }
  }

  // Derive global status
  const allStates = Object.values(finalVerifications);
  const isComplete =
    allStates.length > 0 &&
    allStates.every((v) => v.status === "done" || v.status === "error");
  const globalStatus = isComplete ? "complete" : "processing";

  const { error: writeError } = await adminDb
    .from("transactions")
    .update({ verifications: finalVerifications, verification_status: globalStatus })
    .eq("id", id);

  if (writeError) {
    console.error("[verify] DB write failed", { error: writeError.message, transactionId: id });
    await logError("verify_orchestrator", writeError.message, { id, code: writeError.code });
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  // Compute and persist risk output when verification is complete.
  // risk_output is ALWAYS written — never left null after completion.
  if (isComplete) {
    // Ensure full provider coverage: any expected provider absent from finalVerifications
    // gets a "missing" entry so the risk engine has complete input.
    const verfsForRisk: Verifications = { ...finalVerifications };
    for (const { key } of providerEntries) {
      if (!verfsForRisk[key]) {
        verfsForRisk[key] = { status: "missing" };
      }
    }

    // Normalize statuses:
    //   absent/undefined → "missing" (provider was never involved; degrades confidence, not score)
    //   not "done" and not "error" → "error" (provider got stuck; treat as failed)
    for (const key of Object.keys(verfsForRisk)) {
      const s = verfsForRisk[key].status;
      if (!s) {
        verfsForRisk[key] = { ...verfsForRisk[key], status: "missing" };
      } else if (s !== "done" && s !== "error" && s !== "missing") {
        verfsForRisk[key] = { ...verfsForRisk[key], status: "error" };
      }
    }

    let risk: ReturnType<typeof computeVerificationRisk>;
    try {
      risk = computeVerificationRisk(verfsForRisk);
    } catch {
      risk = SYSTEM_ERROR_RISK;
    }
    if (!risk) {
      risk = SYSTEM_ERROR_RISK;
    }

    const riskWithTimestamp = { ...risk, generated_at: new Date().toISOString() };

    await adminDb
      .from("transactions")
      .update({ risk_output: riskWithTimestamp })
      .eq("id", id);

    console.log("[verify:complete]", {
      id,
      verification_status: globalStatus,
      providers: Object.keys(finalVerifications),
      risk_score: risk.score,
      risk_level: risk.level,
    });
  }

  return NextResponse.json({ ok: true });
}
