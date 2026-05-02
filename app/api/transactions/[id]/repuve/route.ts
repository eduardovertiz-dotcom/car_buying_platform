import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logError";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // A. Validate input
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  }

  let plate: string | undefined;
  try {
    const body = await req.json();
    plate =
      typeof body.plate === "string"
        ? body.plate.toUpperCase().replace(/\s/g, "").replace(/-/g, "")
        : undefined;
  } catch {
    // ignore parse errors
  }

  if (!plate) {
    return NextResponse.json({ error: "plate is required" }, { status: 400 });
  }

  // B. Fetch transaction
  const adminDb = createAdminClient();

  const { data: tx, error: fetchError } = await adminDb
    .from("transactions")
    .select("id, plan, verifik_repuve")
    .eq("id", id)
    .single();

  if (fetchError || !tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // C. Enforce plan
  if (tx.plan !== "69") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // D. Hard duplicate prevention — atomic claim
  const { data: locked } = await adminDb
    .from("transactions")
    .update({ verifik_repuve: "processing" })
    .eq("id", id)
    .is("verifik_repuve", null)
    .select("id")
    .maybeSingle();

  if (!locked) {
    // Another request holds the lock or result is already cached.
    // Frontend polls DB directly — no data needed in response.
    return NextResponse.json({ ok: true });
  }

  // E. Call Verifik
  console.log("[verifik] request", { plate, transactionId: id });

  const verifik_url = `https://api.verifik.co/v2/mx/vehiculo/placa?plate=${encodeURIComponent(plate)}`;
  let repuve: { ok: boolean; data?: Record<string, unknown>; error?: string };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(verifik_url, {
      headers: {
        Authorization: `Bearer ${process.env.VERIFIK_API_KEY?.trim()}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = await resp.json();

    // F. Handle response
    if (!json.success) {
      repuve = { ok: false, error: json.error || "provider_error" };
    } else {
      // G. Normalize success response
      const d = json.data ?? {};
      const theft: boolean =
        typeof d.hasTheftReport === "boolean" ? d.hasTheftReport :
        typeof d.reporteRobo    === "boolean" ? d.reporteRobo    :
        typeof d.stolen         === "boolean" ? d.stolen         : false;
      repuve = {
        ok: true,
        data: {
          plate,
          theft,
          make: d.make ?? d.marca ?? null,
          model: d.model ?? d.modelo ?? null,
          year: d.year ?? d.anio ?? null,
          vin: d.vin ?? d.serie ?? null,
          status: d.status ?? d.estado ?? null,
          raw: json,
        },
      };
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    repuve = { ok: false, error: isTimeout ? "timeout" : "network_error" };
  }

  console.log("[verifik] result", repuve.ok ? "ok" : repuve.error);

  // H. Store result (only on success)
  if (repuve.ok) {
    try {
      const { error: writeError } = await adminDb
        .from("transactions")
        .update({
          verifik_repuve: repuve,
          verifik_repuve_fetched_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (writeError) {
        await logError("repuve_route", writeError.message, { id, code: writeError.code });
      }
    } catch {
      // Do not fail the user if DB write fails
    }
  } else {
    // Reset marker so user can retry
    await adminDb
      .from("transactions")
      .update({ verifik_repuve: null })
      .eq("id", id);
  }

  // I. Return — HTTP status signals success/failure; data lives in DB
  if (!repuve.ok) {
    return NextResponse.json({ ok: false, error: repuve.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
