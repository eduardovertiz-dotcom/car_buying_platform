import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isManualMode } from "@/lib/verification/mode";
import { checkRepuve } from "@/lib/verification/providers/verifik";
import { validateFactura } from "@/lib/verification/providers/validacfdi";
import type {
  ProviderResult,
  RepuveResult,
  FacturaResult,
  VerifyInput,
} from "@/lib/verification/types";

// ── Mode — read once at module load ──────────────────────────────────────────
// Switch between "manual" and "automated" via VERIFICATION_MODE env var.
// Default: "manual". No other code needs to change when switching.
const MANUAL = isManualMode();

// ── Manual-mode response shape ────────────────────────────────────────────────
// Returned immediately — no external API calls are made.
// `checks` preserves the expected shape so the frontend always destructures safely.
const MANUAL_RESPONSE = {
  success: true,
  mode: "manual" as const,
  message: "Verification in progress",
  checks: {
    repuve: { ok: false, error: "pending", source: "manual" },
    factura: { ok: false, error: "pending", source: "manual" },
  },
};

// ── Automated-mode fallback constants ─────────────────────────────────────────
// Used only in automated mode when an adapter unexpectedly throws.
const REPUVE_FALLBACK: ProviderResult<RepuveResult> = {
  ok: false,
  error: "network_error",
  source: "verifik",
};

const FACTURA_NOT_PROVIDED: ProviderResult<FacturaResult> = {
  ok: false,
  error: "not_provided",
  source: "validacfdi",
};

const FACTURA_FALLBACK: ProviderResult<FacturaResult> = {
  ok: false,
  error: "network_error",
  source: "validacfdi",
};

export async function POST(req: Request) {
  // Require authenticated session
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: Partial<VerifyInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasPlate = typeof body.plate === "string" && !!body.plate.trim();
  const hasDocuments = body.hasDocuments === true;

  // Docs-only path: no plate but documents present → return manual-mode response
  if (!hasPlate && hasDocuments) {
    return NextResponse.json({
      success: true,
      mode: "manual" as const,
      message: "Verification in progress",
      checks: {
        repuve: { ok: false, error: "no_identifier", source: "manual" },
        factura: { ok: false, error: "no_identifier", source: "manual" },
      },
    });
  }

  // Neither plate nor documents — reject
  if (!hasPlate) {
    return NextResponse.json({ error: "plate or hasDocuments is required" }, { status: 400 });
  }

  // ── Manual mode: return immediately, no external calls ───────────────────
  if (MANUAL) {
    return NextResponse.json(MANUAL_RESPONSE);
  }

  // ── Automated mode: run providers in parallel ────────────────────────────
  // Normalize once, centrally, before any provider call.
  // body.plate is guaranteed non-empty here — hasPlate guard above ensures it.
  const plate = body.plate!.trim().toUpperCase();

  // Each call is guarded with .catch() so an unexpected throw
  // never crashes the route — checks object is always complete.
  const [repuve, factura] = await Promise.all([
    checkRepuve(plate).catch((): ProviderResult<RepuveResult> => {
      console.error("VERIFIK: unexpected throw in adapter");
      return REPUVE_FALLBACK;
    }),
    body.factura
      ? validateFactura(body.factura).catch((): ProviderResult<FacturaResult> => {
          console.error("VALIDACFDI: unexpected throw in adapter");
          return FACTURA_FALLBACK;
        })
      : Promise.resolve(FACTURA_NOT_PROVIDED),
  ]);

  return NextResponse.json({
    success: true,
    mode: "automated" as const,
    checks: {
      repuve,
      factura,
    },
  });
}
