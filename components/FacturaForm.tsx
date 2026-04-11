"use client";

import { useState } from "react";

interface FacturaFormProps {
  transactionId: string;
  prefillEmail: string | null;
}

type FormStatus = "idle" | "loading" | "success" | "already_exists" | "error";

export default function FacturaForm({ transactionId, prefillEmail }: FacturaFormProps) {
  const [rfc, setRfc]                   = useState("");
  const [razonSocial, setRazonSocial]   = useState("");
  const [regimenFiscal, setRegimenFiscal] = useState("601");
  const [usoCfdi, setUsoCfdi]           = useState("G03");
  const [address, setAddress]           = useState("");

  const [status, setStatus]             = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileApplied, setProfileApplied] = useState(false);

  function handleUseProfile() {
    setRfc("XAXX010101000");
    setRazonSocial("Eduardo Vertiz");
    setProfileApplied(true);
  }

  function handleEditProfile() {
    setRfc("");
    setRazonSocial("");
    setProfileApplied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id:  transactionId,
          rfc:             rfc.trim(),
          razon_social:    razonSocial.trim(),
          regimen_fiscal:  regimenFiscal.trim(),
          uso_cfdi:        usoCfdi.trim(),
          address:         address.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus(data.already_exists ? "already_exists" : "success");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  }

  // ── Terminal states ───────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div className="border border-white/[0.08] rounded-xl px-6 py-6">
        <p className="text-sm font-medium text-white mb-1">Factura request received</p>
        <p className="text-sm text-[var(--foreground-muted)]">
          We will process your request and send the factura to the email associated with this transaction.
        </p>
      </div>
    );
  }

  if (status === "already_exists") {
    return (
      <div className="border border-white/[0.08] rounded-xl px-6 py-6">
        <p className="text-sm font-medium text-white mb-1">Factura already requested for this transaction</p>
        <p className="text-sm text-[var(--foreground-muted)]">
          If you need to make changes, please contact support.
        </p>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const isLoading = status === "loading";

  return (
    <div className="border border-white/[0.08] rounded-xl px-6 py-6">
      <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-1">Factura</p>
      <p className="text-sm font-medium text-white mb-2">Request a factura for this transaction</p>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-5">
        We'll use this information to generate your factura. You can edit it anytime.
      </p>

      {/* Read-only email display */}
      {prefillEmail && (
        <div className="mb-5">
          <p className="text-xs text-[var(--foreground-muted)] mb-1">Email</p>
          <p className="text-sm text-white/70">{prefillEmail}</p>
        </div>
      )}

      {/* Saved billing profile */}
      <div className="mb-5">
        <p className="text-xs text-[var(--foreground-muted)] mb-2">Saved billing profile</p>
        <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3">
          <p className="text-sm text-white/70">Eduardo Vertiz — XAXX010101000</p>
          <div className="flex items-center gap-3">
            {!profileApplied ? (
              <button
                type="button"
                onClick={handleUseProfile}
                disabled={isLoading}
                className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                Use this
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEditProfile}
                disabled={isLoading}
                className="text-xs text-[var(--foreground-muted)] hover:text-white transition-colors disabled:opacity-40"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* 1. RFC */}
        <div>
          <label className="text-xs text-[var(--foreground-muted)] block mb-1">RFC <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={rfc}
            onChange={(e) => setRfc(e.target.value)}
            required
            disabled={isLoading}
            placeholder="XAXX010101000"
            className="w-full bg-white/[0.04] border border-white/[0.10] text-white text-sm rounded-lg px-3 py-2 placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
        </div>

        {/* 2. Razón Social */}
        <div>
          <label className="text-xs text-[var(--foreground-muted)] block mb-1">Razón Social <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            required
            disabled={isLoading}
            placeholder="Nombre o empresa"
            className="w-full bg-white/[0.04] border border-white/[0.10] text-white text-sm rounded-lg px-3 py-2 placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
        </div>

        {/* 3. Uso CFDI */}
        <div>
          <label className="text-xs text-[var(--foreground-muted)] block mb-1">Uso CFDI <span className="text-red-400">*</span></label>
          <select
            value={usoCfdi}
            onChange={(e) => setUsoCfdi(e.target.value)}
            required
            disabled={isLoading}
            className="w-full bg-white/[0.04] border border-white/[0.10] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          >
            <option value="G03">G03 — Gastos en general</option>
            <option value="I01">I01 — Construcciones</option>
            <option value="I02">I02 — Mobiliario y equipo</option>
            <option value="I03">I03 — Equipo de transporte</option>
            <option value="P01">P01 — Por definir</option>
          </select>
        </div>

        {/* 4. Régimen Fiscal */}
        <div>
          <label className="text-xs text-[var(--foreground-muted)] block mb-1">Régimen Fiscal <span className="text-red-400">*</span></label>
          <select
            value={regimenFiscal}
            onChange={(e) => setRegimenFiscal(e.target.value)}
            required
            disabled={isLoading}
            className="w-full bg-white/[0.04] border border-white/[0.10] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          >
            <option value="601">601 — General de Ley Personas Morales</option>
            <option value="603">603 — Personas Morales con Fines no Lucrativos</option>
            <option value="605">605 — Sueldos y Salarios</option>
            <option value="606">606 — Arrendamiento</option>
            <option value="612">612 — Personas Físicas con Actividades Empresariales</option>
          </select>
        </div>

        {/* 5. Dirección (optional) */}
        <div>
          <label className="text-xs text-[var(--foreground-muted)] block mb-1">Dirección <span className="text-white/30 font-normal">(opcional)</span></label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isLoading}
            placeholder="Calle, número, ciudad, CP"
            className="w-full bg-white/[0.04] border border-white/[0.10] text-white text-sm rounded-lg px-3 py-2 placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
        </div>

        {status === "error" && errorMessage && (
          <p className="text-sm text-red-400">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-4 py-3 hover:opacity-90 transition-opacity disabled:opacity-50 mt-1"
        >
          {isLoading ? "Submitting…" : "Generate factura"}
        </button>

        <p className="text-xs text-[var(--foreground-muted)] leading-relaxed text-center opacity-70">
          Your information is processed securely and used only for invoice generation.
        </p>

      </form>
    </div>
  );
}
