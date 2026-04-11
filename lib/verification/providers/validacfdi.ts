import type { ProviderResult, FacturaResult, VerifyInput } from "@/lib/verification/types";

const VALIDACFDI_URL = "https://api.valida-cfdi.com.mx/v1/validate";
const TIMEOUT_MS = 6_000;

type FacturaInput = NonNullable<VerifyInput["factura"]>;

export async function validateFactura(
  factura: FacturaInput
): Promise<ProviderResult<FacturaResult>> {
  // Validate required fields before calling API
  if (
    !factura.uuid?.trim() ||
    !factura.rfc_emisor?.trim() ||
    !factura.rfc_receptor?.trim() ||
    typeof factura.total !== "number" ||
    !isFinite(factura.total) ||
    factura.total <= 0
  ) {
    console.error("VALIDACFDI: invalid input fields");
    return { ok: false, error: "invalid_response", source: "validacfdi" };
  }

  const apiKey = process.env.VALIDACFDI_API_KEY;

  if (!apiKey) {
    console.error("VALIDACFDI: VALIDACFDI_API_KEY is not set");
    return { ok: false, error: "provider_error", source: "validacfdi" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(VALIDACFDI_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(factura),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("VALIDACFDI: HTTP error", { status: res.status });
      return { ok: false, error: "provider_error", source: "validacfdi" };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      console.error("VALIDACFDI: failed to parse response");
      return { ok: false, error: "invalid_response", source: "validacfdi" };
    }

    const raw = json as Record<string, unknown>;

    if (typeof raw.valid !== "boolean") {
      console.error("VALIDACFDI: unexpected response shape");
      return { ok: false, error: "invalid_response", source: "validacfdi" };
    }

    const valid: boolean = raw.valid;
    const status: string =
      typeof raw.status === "string" ? raw.status : "unknown";

    return { ok: true, data: { valid, status } };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("VALIDACFDI: timeout");
      return { ok: false, error: "timeout", source: "validacfdi" };
    }
    console.error("VALIDACFDI: network error");
    return { ok: false, error: "network_error", source: "validacfdi" };
  } finally {
    clearTimeout(timer);
  }
}
