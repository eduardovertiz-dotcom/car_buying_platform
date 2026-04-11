import type { ProviderResult, RepuveResult } from "@/lib/verification/types";

const VERIFIK_URL = "https://api.verifik.co/v2/mexico/repuve";
const TIMEOUT_MS = 6_000;

export async function checkRepuve(
  plate: string
): Promise<ProviderResult<RepuveResult>> {
  const apiKey = process.env.VERIFIK_API_KEY;

  if (!apiKey) {
    console.error("VERIFIK: VERIFIK_API_KEY is not set");
    return { ok: false, error: "provider_error" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${VERIFIK_URL}?plate=${encodeURIComponent(plate)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      console.error("VERIFIK: HTTP error", { status: res.status });
      return { ok: false, error: "provider_error" };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      console.error("VERIFIK: failed to parse response");
      return { ok: false, error: "invalid_response" };
    }

    const data = (json as Record<string, unknown>)?.data as Record<string, unknown> | undefined;

    if (!data || typeof data !== "object") {
      console.error("VERIFIK: unexpected response shape");
      return { ok: false, error: "invalid_response" };
    }

    const theft: boolean =
      data.hasTheftReport === true ||
      data.reporteRobo === true ||
      data.stolen === true;

    const status: string =
      typeof data.status === "string"
        ? data.status
        : typeof data.estado === "string"
        ? data.estado
        : theft
        ? "reported_stolen"
        : "clean";

    return { ok: true, data: { theft, status } };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("VERIFIK: timeout");
      return { ok: false, error: "timeout" };
    }
    console.error("VERIFIK: network error");
    return { ok: false, error: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
