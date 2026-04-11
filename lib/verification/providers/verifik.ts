import type { ProviderResult, RepuveResult } from "@/lib/verification/types";

const VERIFIK_URL = "https://api.verifik.co/v2/mexico/repuve";
const TIMEOUT_MS = 6_000;

export async function checkRepuve(
  plate: string
): Promise<ProviderResult<RepuveResult>> {
  const apiKey = process.env.VERIFIK_API_KEY;

  if (!apiKey) {
    console.error("VERIFIK: VERIFIK_API_KEY is not set");
    return { ok: false, error: "Provider not configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${VERIFIK_URL}?plate=${encodeURIComponent(plate)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("VERIFIK: HTTP error", { status: res.status, body });
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();

    // Normalize raw Verifik response → RepuveResult
    const theft: boolean =
      json?.data?.hasTheftReport === true ||
      json?.data?.reporteRobo === true ||
      json?.data?.stolen === true ||
      false;

    const status: string =
      json?.data?.status ??
      json?.data?.estado ??
      (theft ? "reported_stolen" : "clean");

    console.error("VERIFIK: success", { plate, theft, status });

    return { ok: true, data: { theft, status } };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const message = isTimeout ? "timeout" : (err instanceof Error ? err.message : "unknown error");
    console.error("VERIFIK: fetch failed", { plate, error: message });
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
