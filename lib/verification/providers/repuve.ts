import type { Provider } from "./index";

export const repuveProvider: Provider = async ({ plate }) => {
  if (!plate || typeof plate !== "string") {
    return { ok: false, error: "plate_required" };
  }

  const url = `https://api.verifik.co/v2/mx/vehiculo/placa?plate=${encodeURIComponent(plate)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let json: Record<string, unknown>;
  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.VERIFIK_API_KEY?.trim()}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    json = await resp.json();
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return { ok: false, error: isTimeout ? "timeout" : "network_error" };
  }

  if (!json.success) {
    return { ok: false, error: (json.error as string) || "provider_error" };
  }

  const d = (json.data as Record<string, unknown>) ?? {};
  const theft: boolean =
    typeof d.hasTheftReport === "boolean" ? d.hasTheftReport :
    typeof d.reporteRobo    === "boolean" ? d.reporteRobo    :
    typeof d.stolen         === "boolean" ? d.stolen         : false;

  return {
    ok: true,
    data: {
      plate,
      theft,
      make:   (d.make  ?? d.marca  ?? null) as string | null,
      model:  (d.model ?? d.modelo ?? null) as string | null,
      year:   (d.year  ?? d.anio   ?? null) as number | null,
      vin:    (d.vin   ?? d.serie  ?? null) as string | null,
      status: (d.status ?? d.estado ?? null) as string | null,
    },
  };
};
