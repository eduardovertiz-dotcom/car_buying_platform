"use client";

import { useEffect, useState } from "react";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

interface InvoiceRequest {
  id: string;
  created_at: string;
  email: string | null;
  amount: number | null;
  plan: string | null;
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  uso_cfdi: string;
  codigo_postal: string;
  transaction_id: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    "#f59e0b",
  processing: "#3b82f6",
  completed:  "#22c55e",
};

function fmt(amount: number | null) {
  if (amount == null) return "—";
  return `$${(amount / 100).toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

async function updateStatus(transaction_id: string, status: string) {
  await fetch("/api/update-invoice-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction_id, status }),
  });
  window.location.reload();
}

export default function AdminFacturasPage() {
  const [rows, setRows] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `${SUPABASE_URL}/rest/v1/invoice_requests?order=created_at.desc&limit=200`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "monospace", fontSize: "13px" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Factura Requests</h1>
      <p style={{ color: "#888", marginBottom: "1.5rem" }}>
        {loading ? "Loading…" : `${rows.length} record${rows.length !== 1 ? "s" : ""}`}
      </p>

      {!loading && rows.length === 0 && <p>No requests yet.</p>}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1000px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
                <th style={th}>Date</th>
                <th style={th}>Status</th>
                <th style={th}>Email</th>
                <th style={th}>Amount</th>
                <th style={th}>Plan</th>
                <th style={th}>RFC</th>
                <th style={th}>Razón Social</th>
                <th style={th}>CP</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #222" }}>
                  <td style={td}>{fmtDate(r.created_at)}</td>
                  <td style={td}>
                    <span style={{
                      color: STATUS_COLORS[r.status] ?? "#888",
                      fontWeight: "bold",
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={td}>{r.email ?? "—"}</td>
                  <td style={td}>{fmt(r.amount)}</td>
                  <td style={td}>{r.plan ?? "—"}</td>
                  <td style={td}>{r.rfc}</td>
                  <td style={td}>{r.razon_social}</td>
                  <td style={td}>{r.codigo_postal}</td>
                  <td style={{ ...td, display: "flex", gap: "6px" }}>
                    {r.status !== "processing" && (
                      <button
                        onClick={() => updateStatus(r.transaction_id, "processing")}
                        style={btn("#3b82f6")}
                      >
                        Processing
                      </button>
                    )}
                    {r.status !== "completed" && (
                      <button
                        onClick={() => updateStatus(r.transaction_id, "completed")}
                        style={btn("#22c55e")}
                      >
                        Completed
                      </button>
                    )}
                    {r.status === "completed" && (
                      <span style={{ color: "#444" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const th: React.CSSProperties = { padding: "8px 12px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "7px 12px", whiteSpace: "nowrap" };
const btn = (color: string): React.CSSProperties => ({
  background: color,
  color: "#000",
  border: "none",
  borderRadius: "4px",
  padding: "3px 10px",
  fontSize: "12px",
  cursor: "pointer",
  fontWeight: "bold",
  fontFamily: "monospace",
});
