"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, FormEvent, Suspense } from "react";

interface SessionData {
  id: string;
  customer_email: string | null;
  amount_total: number | null;
  metadata: { plan?: string } | null;
}

const REGIMEN_OPTIONS = [
  { value: "601", label: "601 – General de Ley Personas Morales" },
  { value: "603", label: "603 – Personas Morales con Fines no Lucrativos" },
  { value: "605", label: "605 – Sueldos y Salarios e Ingresos Asimilados" },
  { value: "606", label: "606 – Arrendamiento" },
  { value: "608", label: "608 – Demás ingresos" },
  { value: "612", label: "612 – Personas Físicas con Actividades Empresariales" },
  { value: "616", label: "616 – Sin obligaciones fiscales" },
  { value: "621", label: "621 – Incorporación Fiscal" },
  { value: "625", label: "625 – Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { value: "626", label: "626 – Régimen Simplificado de Confianza" },
];

const CFDI_OPTIONS = [
  { value: "G01", label: "G01 – Adquisición de mercancias" },
  { value: "G02", label: "G02 – Devoluciones, descuentos o bonificaciones" },
  { value: "G03", label: "G03 – Gastos en general" },
  { value: "I01", label: "I01 – Construcciones" },
  { value: "I04", label: "I04 – Equipo de cómputo y accesorios" },
  { value: "I08", label: "I08 – Otra maquinaria y equipo" },
  { value: "D01", label: "D01 – Honorarios médicos" },
  { value: "D10", label: "D10 – Pagos por servicios educativos" },
  { value: "S01", label: "S01 – Sin efectos fiscales" },
  { value: "CP01", label: "CP01 – Pagos" },
];

function planLabel(plan?: string) {
  return plan === "69" ? "MexGuardian Report + Verification" : "MexGuardian Report";
}

function FacturaForm() {
  const searchParams = useSearchParams();
  const txn = searchParams.get("txn");

  const [session, setSession] = useState<SessionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState({
    rfc: "",
    razon_social: "",
    regimen_fiscal: "",
    uso_cfdi: "",
    codigo_postal: "",
  });

  useEffect(() => {
    if (!txn) { setLoadError("Missing transaction"); return; }

    fetch(`/api/get-session?session_id=${txn}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSession)
      .catch(() => setLoadError("Invalid transaction"));
  }, [txn]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setSubmitError(null);

    const res = await fetch("/api/create-invoice-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_id: session.id,
        email: session.customer_email,
        amount: session.amount_total,
        plan: session.metadata?.plan,
        ...form,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const { error } = await res.json();
      setSubmitError(error ?? "Something went wrong. Please try again.");
    }
  }

  // ── Error states ──────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24">
        <p className="text-sm text-red-400">{loadError}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24">
        <p className="text-sm text-[var(--foreground-muted)]">Cargando…</p>
      </main>
    );
  }

  // ── Success confirmation ───────────────────────────────────────────────────
  if (submitted) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24">
        <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-4">Solicitud recibida</p>
        <h1 className="text-2xl font-semibold text-white mb-3">
          Recibirás tu factura en 24–48 horas hábiles.
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Se enviará a <span className="text-white">{session.customer_email}</span>
        </p>
      </main>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const amount = session.amount_total != null
    ? `$${(session.amount_total / 100).toFixed(2)} USD`
    : "—";

  return (
    <main className="max-w-xl mx-auto px-6 py-24">
      <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-4">Solicitud de factura</p>
      <h1 className="text-2xl font-semibold text-white mb-8">
        Factura por: {amount} — {planLabel(session.metadata?.plan)}
      </h1>

      {/* Locked transaction info */}
      <div className="flex flex-col gap-2 mb-8 text-sm">
        <div className="flex justify-between border-b border-white/[0.06] pb-2">
          <span className="text-[var(--foreground-muted)]">Email</span>
          <span className="text-white">{session.customer_email ?? "—"}</span>
        </div>
        <div className="flex justify-between pb-2">
          <span className="text-[var(--foreground-muted)]">Transacción</span>
          <span className="text-white font-mono text-xs">{session.id.slice(0, 24)}…</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        <Field
          label="RFC"
          value={form.rfc}
          onChange={(v) => setForm({ ...form, rfc: v })}
          placeholder="XAXX010101000"
          required
        />

        <Field
          label="Nombre / Razón Social"
          value={form.razon_social}
          onChange={(v) => setForm({ ...form, razon_social: v })}
          placeholder="Nombre completo o razón social"
          required
        />

        <SelectField
          label="Régimen Fiscal"
          value={form.regimen_fiscal}
          onChange={(v) => setForm({ ...form, regimen_fiscal: v })}
          options={REGIMEN_OPTIONS}
          required
        />

        <Field
          label="Código Postal Fiscal"
          value={form.codigo_postal}
          onChange={(v) => setForm({ ...form, codigo_postal: v })}
          placeholder="06600"
          maxLength={5}
          required
        />

        <SelectField
          label="Uso CFDI"
          value={form.uso_cfdi}
          onChange={(v) => setForm({ ...form, uso_cfdi: v })}
          options={CFDI_OPTIONS}
          required
        />

        {submitError && (
          <p className="text-sm text-red-400">{submitError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg px-5 py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Enviando…" : "Solicitar factura"}
        </button>

      </form>
    </main>
  );
}

// ── Small reusable field components ──────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, required, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 appearance-none"
      >
        <option value="" disabled className="bg-black">Seleccionar…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-black">{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function FacturaPage() {
  return (
    <Suspense fallback={
      <main className="max-w-xl mx-auto px-6 py-24">
        <p className="text-sm text-[var(--foreground-muted)]">Cargando…</p>
      </main>
    }>
      <FacturaForm />
    </Suspense>
  );
}
